// Cifrat d'extrem a extrem. Tot passa al dispositiu; el servidor només rep authKey
// i dades xifrades. Només fa servir primitives de libsodium:
//   - Argon2id (crypto_pwhash) per derivar una clau mestra de la contrasenya.
//   - crypto_kdf_derive_from_key per separar-la en authKey (s'envia) i wrapKey (no surt mai).
//   - XChaCha20-Poly1305 per embolicar la clau de dades i xifrar cada registre.
//   - BLAKE2b (crypto_generichash) per a la sal i per a la clau del codi de recuperació.
import sodium from "libsodium-wrappers-sumo";

/** Paràmetres d'Argon2id. Si canvien, cal una versió nova (els usuaris existents fan servir la seva). */
export interface KdfParams {
  opsLimit: number;
  memLimitBytes: number;
}

export const KDF_VERSION = 1;
export const KDF_V1: KdfParams = { opsLimit: 3, memLimitBytes: 64 * 1024 * 1024 };

const KEY_BYTES = 32;
const KDF_CTX_AUTH = "apuntaut"; // libsodium exigeix exactament 8 caràcters
const KDF_CTX_WRAP = "apuntwrp";
const AAD_WRAP_PW = "apunt:keyring:pw:v1";
const AAD_WRAP_RECOVERY = "apunt:keyring:recovery:v1";
const RECOVERY_HASH_KEY = "apunt:recovery:v1";
const RECOVERY_BYTES = 20; // 160 bits → 32 caràcters en Base32

/** Error d'una contrasenya, un codi o unes dades que no es poden obrir. El missatge es pot mostrar. */
export class CryptoError extends Error {}

export interface DerivedKeys {
  /** Es fa servir com a «contrasenya» de Supabase. Base64. */
  authKey: string;
  /** Embolica la clau de dades. No s'envia mai. */
  wrapKey: Uint8Array;
}

/** El que es guarda al servidor (i a les còpies). Cap valor permet llegir les dades sense un secret. */
export interface Keyring {
  version: number;
  wrappedPw: string;
  wrappedRecovery: string;
  /** Embolcall nou mentre es canvia la contrasenya (vegeu el pla, fase 5). */
  pendingWrappedPw?: string | null;
}

export async function ready(): Promise<void> {
  await sodium.ready;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// NFC perquè una «à» escrita al mòbil i a l'ordinador doni els mateixos bytes.
const normalizePassword = (password: string) => password.normalize("NFC");

const b64 = (bytes: Uint8Array) => sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
const unb64 = (text: string) => sodium.from_base64(text, sodium.base64_variants.URLSAFE_NO_PADDING);

function salt(email: string): Uint8Array {
  return sodium.crypto_generichash(sodium.crypto_pwhash_SALTBYTES, `apunt:v1:${normalizeEmail(email)}`, null);
}

export async function deriveKeys(
  email: string,
  password: string,
  params: KdfParams = KDF_V1,
): Promise<DerivedKeys> {
  await ready();
  const master = sodium.crypto_pwhash(
    KEY_BYTES,
    normalizePassword(password),
    salt(email),
    params.opsLimit,
    params.memLimitBytes,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
  const authKey = sodium.crypto_kdf_derive_from_key(KEY_BYTES, 1, KDF_CTX_AUTH, master);
  const wrapKey = sodium.crypto_kdf_derive_from_key(KEY_BYTES, 2, KDF_CTX_WRAP, master);
  sodium.memzero(master);
  const result = { authKey: b64(authKey), wrapKey };
  sodium.memzero(authKey);
  return result;
}

// ------------------------------------------------------------ Xifrat autenticat

/** Xifra amb XChaCha20-Poly1305. Resultat: base64(nonce ‖ text xifrat). */
function seal(key: Uint8Array, plaintext: Uint8Array | string, aad: string): string {
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad, null, nonce, key);
  const out = new Uint8Array(nonce.length + ciphertext.length);
  out.set(nonce);
  out.set(ciphertext, nonce.length);
  return b64(out);
}

/** Desxifra el que ha fet `seal`. Retorna null si la clau o l'AAD no són correctes o s'ha modificat. */
function open(key: Uint8Array, sealed: string, aad: string): Uint8Array | null {
  try {
    const bytes = unb64(sealed);
    const n = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
    if (bytes.length <= n) return null;
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, bytes.subarray(n), aad, bytes.subarray(0, n), key);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ Codi de recuperació

// Base32 de Crockford: sense I, L, O ni U, perquè no es confonguin en copiar-lo a mà.
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string): Uint8Array | null {
  const clean = text
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const v = B32.indexOf(ch);
    if (v < 0) return null;
    value = ((value << 5) | v) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  // Bits sobrants: el codi té caràcters de més o de menys.
  if (bits >= 5 || (value & ((1 << bits) - 1)) !== 0) return null;
  return new Uint8Array(out);
}

/** Codi en grups de 4 per mostrar-lo: «XXXX-XXXX-…» (8 grups). */
function formatRecoveryCode(bytes: Uint8Array): string {
  return base32Encode(bytes).match(/.{4}/g)!.join("-");
}

function recoveryKey(code: string): Uint8Array {
  const bytes = base32Decode(code);
  if (!bytes || bytes.length !== RECOVERY_BYTES) {
    throw new CryptoError("El codi de recuperació no és correcte. Revisa que l'hagis copiat sencer.");
  }
  return sodium.crypto_generichash(KEY_BYTES, bytes, RECOVERY_HASH_KEY);
}

// ------------------------------------------------------------ Clauer

export interface NewAccount {
  keyring: Keyring;
  dataKey: Uint8Array;
  authKey: string;
  /** Es mostra una sola vegada a la tutora. No es guarda enlloc. */
  recoveryCode: string;
}

export async function createKeyring(
  email: string,
  password: string,
  params: KdfParams = KDF_V1,
): Promise<NewAccount> {
  const { authKey, wrapKey } = await deriveKeys(email, password, params);
  const dataKey = sodium.randombytes_buf(KEY_BYTES);
  const recoveryBytes = sodium.randombytes_buf(RECOVERY_BYTES);
  const recoveryCode = formatRecoveryCode(recoveryBytes);
  sodium.memzero(recoveryBytes);
  const keyring: Keyring = {
    version: KDF_VERSION,
    wrappedPw: seal(wrapKey, dataKey, AAD_WRAP_PW),
    wrappedRecovery: seal(recoveryKey(recoveryCode), dataKey, AAD_WRAP_RECOVERY),
  };
  sodium.memzero(wrapKey);
  return { keyring, dataKey, authKey, recoveryCode };
}

/** Obre el clauer amb una wrapKey ja derivada (així l'inici de sessió només fa Argon2 una vegada). */
export function openKeyring(keyring: Keyring, wrapKey: Uint8Array): Uint8Array {
  for (const wrapped of [keyring.wrappedPw, keyring.pendingWrappedPw]) {
    const dataKey = wrapped ? open(wrapKey, wrapped, AAD_WRAP_PW) : null;
    if (dataKey) return dataKey;
  }
  throw new CryptoError("La contrasenya no és correcta.");
}

export async function unlockWithPassword(
  keyring: Keyring,
  email: string,
  password: string,
  params: KdfParams = KDF_V1,
): Promise<Uint8Array> {
  const { wrapKey } = await deriveKeys(email, password, params);
  try {
    return openKeyring(keyring, wrapKey);
  } finally {
    sodium.memzero(wrapKey);
  }
}

export async function unlockWithRecovery(keyring: Keyring, code: string): Promise<Uint8Array> {
  await ready();
  const dataKey = open(recoveryKey(code), keyring.wrappedRecovery, AAD_WRAP_RECOVERY);
  if (!dataKey) throw new CryptoError("El codi de recuperació no és correcte.");
  return dataKey;
}

/** Contrasenya nova: només es torna a embolicar la clau de dades. Les dades no es tornen a xifrar. */
export async function rewrapForNewPassword(
  keyring: Keyring,
  dataKey: Uint8Array,
  email: string,
  newPassword: string,
  params: KdfParams = KDF_V1,
): Promise<{ keyring: Keyring; authKey: string }> {
  const { authKey, wrapKey } = await deriveKeys(email, newPassword, params);
  const wrappedPw = seal(wrapKey, dataKey, AAD_WRAP_PW);
  sodium.memzero(wrapKey);
  return { keyring: { ...keyring, version: KDF_VERSION, wrappedPw, pendingWrappedPw: null }, authKey };
}

// ------------------------------------------------------------ Registres

// L'AAD lliga cada xifrat al seu usuari i al seu id: el servidor no pot intercanviar files.
const itemAad = (userId: string, itemId: string) => `apunt:item:v1:${userId}:${itemId}`;

export function encryptItem(dataKey: Uint8Array, userId: string, itemId: string, value: unknown): string {
  return seal(dataKey, JSON.stringify(value), itemAad(userId, itemId));
}

export function decryptItem<T = unknown>(dataKey: Uint8Array, userId: string, itemId: string, sealed: string): T {
  const bytes = open(dataKey, sealed, itemAad(userId, itemId));
  if (!bytes) throw new CryptoError("No s'han pogut desxifrar les dades.");
  return JSON.parse(sodium.to_string(bytes)) as T;
}
