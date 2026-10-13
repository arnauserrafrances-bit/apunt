import { beforeAll, describe, expect, it } from "vitest";
import { createBackup, openBackup, parseBackup, type EncryptedItem } from "./backup";
import { createKeyring, CryptoError, encryptItem, ready, type KdfParams, type Keyring } from "./crypto";

const FAST: KdfParams = { opsLimit: 1, memLimitBytes: 8192 };
const EMAIL = "tutora@escola.cat";
const PASSWORD = "Tardor de 5è, 2026";
const USER = "user-1";

const VALUES: Record<string, unknown> = {
  s1: { kind: "student", code: "A-01", firstName: "Pau", lastName: "Serra Vidal" },
  n1: { kind: "note", studentId: "s1", text: "Ha escrit un conte molt imaginatiu." },
  n2: { kind: "note", studentId: "s1", text: "Nota esborrada" },
};

beforeAll(ready);

/** Simula un compte amb dades al «servidor» i en fa una còpia. */
async function accountWithBackup() {
  const account = await createKeyring(EMAIL, PASSWORD, FAST);
  const server: { keyring: Keyring | null; items: EncryptedItem[] } = {
    keyring: account.keyring,
    items: Object.entries(VALUES).map(([id, value]) => ({
      id,
      ciphertext: encryptItem(account.dataKey, USER, id, value),
      deleted: id === "n2",
      updatedAt: "2026-10-13T10:00:00Z",
    })),
  };
  const file = createBackup({ email: EMAIL, userId: USER, keyring: server.keyring!, items: server.items });

  // Es perd tot: el clauer i les dades del servidor, i la clau que hi havia al dispositiu.
  server.keyring = null;
  server.items = [];
  account.dataKey.fill(0);

  return { file, recoveryCode: account.recoveryCode };
}

describe("còpia de seguretat", () => {
  it("es recupera tot només amb la contrasenya", async () => {
    const { file } = await accountWithBackup();
    const { records } = await openBackup(file, { password: PASSWORD }, FAST);
    expect(Object.fromEntries(records.map((r) => [r.id, r.value]))).toEqual(VALUES);
    expect(records.find((r) => r.id === "n2")?.deleted).toBe(true);
  });

  it("es recupera tot només amb el codi de recuperació", async () => {
    const { file, recoveryCode } = await accountWithBackup();
    const { records } = await openBackup(file, { recoveryCode }, FAST);
    expect(Object.fromEntries(records.map((r) => [r.id, r.value]))).toEqual(VALUES);
  });

  it("amb una contrasenya incorrecta falla", async () => {
    const { file } = await accountWithBackup();
    await expect(openBackup(file, { password: "no és aquesta" }, FAST)).rejects.toThrow(
      "La contrasenya no és correcta.",
    );
  });

  it("el fitxer no conté cap dada en clar", async () => {
    const { file } = await accountWithBackup();
    for (const word of ["Pau", "Serra", "conte", "imaginatiu", PASSWORD]) {
      expect(file).not.toContain(word);
    }
  });

  it("rebutja fitxers que no són còpies", () => {
    expect(() => parseBackup("hola")).toThrow(CryptoError);
    expect(() => parseBackup(JSON.stringify({ format: "una-altra-cosa" }))).toThrow(CryptoError);
    expect(() => parseBackup(JSON.stringify({ format: "apunt-backup", version: 99 }))).toThrow(
      /versió/,
    );
  });
});
