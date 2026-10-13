import sodium from "libsodium-wrappers-sumo";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createKeyring,
  CryptoError,
  decryptItem,
  deriveKeys,
  encryptItem,
  KDF_V1,
  ready,
  rewrapForNewPassword,
  unlockWithPassword,
  unlockWithRecovery,
  type KdfParams,
} from "./crypto";

// Paràmetres mínims d'Argon2id perquè les proves vagin ràpid. Els reals es proven a part.
const FAST: KdfParams = { opsLimit: 1, memLimitBytes: 8192 };
const EMAIL = "tutora@escola.cat";
const PASSWORD = "Tardor de 5è, 2026";
const USER = "user-1";
const NOTE = { kind: "note", studentId: "s1", text: "Llegeix amb fluïdesa. L'Ona l'ha ajudat." };

const toB64 = (b: Uint8Array) => sodium.to_base64(b, sodium.base64_variants.URLSAFE_NO_PADDING);

beforeAll(ready);

describe("claus derivades", () => {
  it("authKey i wrapKey són diferents i la contrasenya no hi apareix", async () => {
    const { authKey, wrapKey } = await deriveKeys(EMAIL, PASSWORD, FAST);
    expect(authKey).not.toBe(toB64(wrapKey));
    expect(authKey).not.toContain(PASSWORD);
    expect(authKey.length).toBeLessThanOrEqual(72); // límit de bcrypt a Supabase
  });

  it("són deterministes i no depenen de les majúscules de l'email", async () => {
    const a = await deriveKeys(EMAIL, PASSWORD, FAST);
    const b = await deriveKeys(" Tutora@Escola.CAT ", PASSWORD, FAST);
    expect(a.authKey).toBe(b.authKey);
    expect(a.wrapKey).toEqual(b.wrapKey);
  });

  it("una «à» composta o descomposta dona la mateixa clau", async () => {
    const a = await deriveKeys(EMAIL, "mà".normalize("NFC"), FAST);
    const b = await deriveKeys(EMAIL, "mà".normalize("NFD"), FAST);
    expect(a.authKey).toBe(b.authKey);
  });

  it("canvien amb un altre email", async () => {
    const a = await deriveKeys(EMAIL, PASSWORD, FAST);
    const b = await deriveKeys("altra@escola.cat", PASSWORD, FAST);
    expect(a.authKey).not.toBe(b.authKey);
  });
});

describe("registres", () => {
  it("xifra i desxifra", async () => {
    const { dataKey } = await createKeyring(EMAIL, PASSWORD, FAST);
    const sealed = encryptItem(dataKey, USER, "n1", NOTE);
    expect(sealed).not.toContain("fluïdesa");
    expect(decryptItem(dataKey, USER, "n1", sealed)).toEqual(NOTE);
  });

  it("cada xifrat és diferent encara que el contingut sigui igual", async () => {
    const { dataKey } = await createKeyring(EMAIL, PASSWORD, FAST);
    expect(encryptItem(dataKey, USER, "n1", NOTE)).not.toBe(encryptItem(dataKey, USER, "n1", NOTE));
  });

  it("falla si el xifrat s'ha modificat", async () => {
    const { dataKey } = await createKeyring(EMAIL, PASSWORD, FAST);
    const sealed = encryptItem(dataKey, USER, "n1", NOTE);
    const i = sealed.length - 5;
    const tampered = sealed.slice(0, i) + (sealed[i] === "A" ? "B" : "A") + sealed.slice(i + 1);
    expect(() => decryptItem(dataKey, USER, "n1", tampered)).toThrow(CryptoError);
  });

  it("falla si es mou a un altre id o a un altre usuari", async () => {
    const { dataKey } = await createKeyring(EMAIL, PASSWORD, FAST);
    const sealed = encryptItem(dataKey, USER, "n1", NOTE);
    expect(() => decryptItem(dataKey, USER, "n2", sealed)).toThrow(CryptoError);
    expect(() => decryptItem(dataKey, "user-2", "n1", sealed)).toThrow(CryptoError);
  });

  it("falla amb una altra clau de dades", async () => {
    const a = await createKeyring(EMAIL, PASSWORD, FAST);
    const b = await createKeyring(EMAIL, PASSWORD, FAST);
    const sealed = encryptItem(a.dataKey, USER, "n1", NOTE);
    expect(() => decryptItem(b.dataKey, USER, "n1", sealed)).toThrow(CryptoError);
  });
});

describe("clauer", () => {
  it("la contrasenya correcta obre la clau de dades", async () => {
    const { keyring, dataKey } = await createKeyring(EMAIL, PASSWORD, FAST);
    expect(await unlockWithPassword(keyring, EMAIL, PASSWORD, FAST)).toEqual(dataKey);
  });

  it("una contrasenya incorrecta falla", async () => {
    const { keyring } = await createKeyring(EMAIL, PASSWORD, FAST);
    await expect(unlockWithPassword(keyring, EMAIL, "una altra", FAST)).rejects.toThrow(
      "La contrasenya no és correcta.",
    );
  });

  it("el clauer no conté la clau de dades en clar", async () => {
    const { keyring, dataKey } = await createKeyring(EMAIL, PASSWORD, FAST);
    const raw = toB64(dataKey);
    expect(JSON.stringify(keyring)).not.toContain(raw);
  });

  it("el codi de recuperació obre la clau de dades", async () => {
    const { keyring, dataKey, recoveryCode } = await createKeyring(EMAIL, PASSWORD, FAST);
    expect(recoveryCode).toMatch(/^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/);
    expect(await unlockWithRecovery(keyring, recoveryCode)).toEqual(dataKey);
  });

  it("el codi s'accepta en minúscules, sense guions i amb O/I/L confoses", async () => {
    const { keyring, dataKey, recoveryCode } = await createKeyring(EMAIL, PASSWORD, FAST);
    const typed = recoveryCode.replace(/-/g, " ").toLowerCase().replace(/0/g, "o").replace(/1/g, "l");
    expect(await unlockWithRecovery(keyring, typed)).toEqual(dataKey);
  });

  it("un codi de recuperació incorrecte o incomplet falla", async () => {
    const { keyring, recoveryCode } = await createKeyring(EMAIL, PASSWORD, FAST);
    const other = (await createKeyring(EMAIL, PASSWORD, FAST)).recoveryCode;
    await expect(unlockWithRecovery(keyring, other)).rejects.toThrow(CryptoError);
    await expect(unlockWithRecovery(keyring, recoveryCode.slice(0, -1))).rejects.toThrow(CryptoError);
    await expect(unlockWithRecovery(keyring, recoveryCode + "A")).rejects.toThrow(CryptoError);
  });

  it("canviar la contrasenya no torna a xifrar les dades", async () => {
    const { keyring, dataKey, authKey, recoveryCode } = await createKeyring(EMAIL, PASSWORD, FAST);
    const sealed = encryptItem(dataKey, USER, "n1", NOTE);

    const changed = await rewrapForNewPassword(keyring, dataKey, EMAIL, "Contrasenya nova", FAST);
    expect(changed.authKey).not.toBe(authKey);

    await expect(unlockWithPassword(changed.keyring, EMAIL, PASSWORD, FAST)).rejects.toThrow(CryptoError);
    const reopened = await unlockWithPassword(changed.keyring, EMAIL, "Contrasenya nova", FAST);
    expect(decryptItem(reopened, USER, "n1", sealed)).toEqual(NOTE);
    // El codi de recuperació continua servint.
    expect(await unlockWithRecovery(changed.keyring, recoveryCode)).toEqual(dataKey);
  });

  it("durant el canvi, l'embolcall pendent també obre", async () => {
    const { keyring, dataKey } = await createKeyring(EMAIL, PASSWORD, FAST);
    const { keyring: next } = await rewrapForNewPassword(keyring, dataKey, EMAIL, "Contrasenya nova", FAST);
    const inProgress = { ...keyring, pendingWrappedPw: next.wrappedPw };
    expect(await unlockWithPassword(inProgress, EMAIL, PASSWORD, FAST)).toEqual(dataKey);
    expect(await unlockWithPassword(inProgress, EMAIL, "Contrasenya nova", FAST)).toEqual(dataKey);
  });

  it("funciona amb els paràmetres reals v1", async () => {
    const { keyring, dataKey } = await createKeyring(EMAIL, PASSWORD, KDF_V1);
    expect(await unlockWithPassword(keyring, EMAIL, PASSWORD)).toEqual(dataKey);
  }, 30_000);
});
