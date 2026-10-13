// Còpia de seguretat (.apunt). Conté el clauer embolicat i els registres xifrats tal com són
// al servidor, de manera que es pot obrir només amb la contrasenya o amb el codi de recuperació
// encara que es perdin les dades de Supabase. No conté cap clau ni cap dada en clar.
import { APP_NAME } from "../config";
import {
  CryptoError,
  decryptItem,
  KDF_V1,
  unlockWithPassword,
  unlockWithRecovery,
  type KdfParams,
  type Keyring,
} from "./crypto";

const FORMAT = "apunt-backup";
const VERSION = 1;

export interface EncryptedItem {
  id: string;
  ciphertext: string;
  deleted: boolean;
  updatedAt: string;
}

export interface BackupFile {
  format: typeof FORMAT;
  version: typeof VERSION;
  createdAt: string;
  /** La sal es deriva de l'email: cal per tornar a obrir el clauer amb la contrasenya. */
  email: string;
  /** Els registres estan lligats (AAD) a l'usuari original. */
  userId: string;
  keyring: Keyring;
  items: EncryptedItem[];
}

export type BackupSecret = { password: string } | { recoveryCode: string };

export interface OpenedBackup {
  dataKey: Uint8Array;
  records: { id: string; deleted: boolean; updatedAt: string; value: unknown }[];
}

export function createBackup(data: Omit<BackupFile, "format" | "version" | "createdAt">): string {
  const file: BackupFile = { format: FORMAT, version: VERSION, createdAt: new Date().toISOString(), ...data };
  return JSON.stringify(file);
}

export function parseBackup(text: string): BackupFile {
  const invalid = new CryptoError(`Aquest fitxer no és una còpia de ${APP_NAME} vàlida.`);
  let file: Partial<BackupFile>;
  try {
    file = JSON.parse(text);
  } catch {
    throw invalid;
  }
  if (file?.format !== FORMAT) throw invalid;
  if (file.version !== VERSION) {
    throw new CryptoError(`Aquesta còpia és d'una versió de ${APP_NAME} que no es pot obrir aquí.`);
  }
  if (
    typeof file.email !== "string" ||
    typeof file.userId !== "string" ||
    typeof file.keyring?.wrappedPw !== "string" ||
    typeof file.keyring?.wrappedRecovery !== "string" ||
    !Array.isArray(file.items)
  ) {
    throw invalid;
  }
  return file as BackupFile;
}

/** Obre una còpia i en desxifra tots els registres. */
export async function openBackup(
  text: string,
  secret: BackupSecret,
  params: KdfParams = KDF_V1,
): Promise<OpenedBackup> {
  const file = parseBackup(text);
  const dataKey =
    "password" in secret
      ? await unlockWithPassword(file.keyring, file.email, secret.password, params)
      : await unlockWithRecovery(file.keyring, secret.recoveryCode);
  const records = file.items.map((item) => ({
    id: item.id,
    deleted: item.deleted,
    updatedAt: item.updatedAt,
    value: decryptItem(dataKey, file.userId, item.id, item.ciphertext),
  }));
  return { dataKey, records };
}
