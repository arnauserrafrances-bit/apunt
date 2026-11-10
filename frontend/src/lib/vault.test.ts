import { describe, expect, it } from "vitest";
import { createKeyring, decryptItem, encryptItem, ready, KDF_V1 } from "./crypto";
import { applyRemote, emptyMeta, itemsToState, stateToItems, syncOnce, type Backend, type Cipher, type RemoteRow, type SyncMeta } from "./vault";
import { emptyState, type AppState } from "../store/repository";

// Servidor fals en memòria: guarda només text xifrat, com Supabase.
class FakeServer {
  rows = new Map<string, RemoteRow>();
  clock = Date.parse("2026-11-10T10:00:00Z");
  backend(): Backend {
    return {
      pull: async (since) =>
        [...this.rows.values()].filter((r) => !since || r.updated_at > since).sort((a, b) => a.updated_at.localeCompare(b.updated_at)),
      push: async (rows) =>
        rows.map((r) => {
          this.clock += 1000;
          const row = { ...r, updated_at: new Date(this.clock).toISOString() };
          this.rows.set(r.id, row);
          return { id: r.id, updated_at: row.updated_at };
        }),
    };
  }
}

const FAST = { opsLimit: 1, memLimitBytes: 8 * 1024 * 1024 }; // Argon2 ràpid només per als tests

async function cipherFor(userId: string): Promise<Cipher> {
  await ready();
  const { dataKey } = await createKeyring("tutora@example.com", "contrasenya-llarga", FAST);
  return { encrypt: (id, v) => encryptItem(dataKey, userId, id, v), decrypt: (id, s) => decryptItem(dataKey, userId, id, s) };
}

function sample(): AppState {
  const s = emptyState();
  s.students = [
    { id: "s1", code: "A-01", firstName: "Marta", lastName: "Puig" },
    { id: "s2", code: "A-02", firstName: "Pau", lastName: "Vila" },
  ];
  s.areas = [
    { id: "ar2", name: "Àmbit lingüístic" },
    { id: "ar1", name: "Adaptació" },
  ];
  s.notes = [{ id: "n1", studentId: "s1", areaId: "ar2", text: "Llegeix bé.", date: "2026-11-10", term: 1, createdAt: 1 }];
  s.nextStudentNumber = 3;
  s.reportGuide = "Escriure en plural.";
  s.freeTexts = { "s1-1": "Text lliure" };
  s.answers = { "s1-1": { "q-adaptacio.1.1": "Arriba contenta." } };
  s.preferences = [{ id: "p1", text: "Evitar «mostra»", createdAt: 5, source: "chat" }];
  return s;
}

/** Un dispositiu: el seu estat i el que recorda de l'última sincronització. */
class Device {
  meta: SyncMeta = emptyMeta();
  constructor(public state: AppState, private server: FakeServer, private cipher: Cipher) {}
  async sync(ignoreLocal = false) {
    const r = await syncOnce(this.state, this.meta, this.server.backend(), this.cipher, ignoreLocal);
    this.meta = r.meta;
    this.state = ignoreLocal ? applyRemote(emptyState(), r.remote) : applyRemote(this.state, r.remote);
    return r;
  }
}

describe("items", () => {
  it("round-trips the whole state, keeping the order of the areas", () => {
    const s = sample();
    expect(itemsToState(stateToItems(s))).toEqual(s);
  });
  it("never repeats a student code", () => {
    const s = sample();
    s.nextStudentNumber = 1;
    expect(itemsToState(stateToItems(s)).nextStudentNumber).toBe(3);
  });
});

describe("syncOnce", () => {
  it("the server only sees encrypted text", async () => {
    const server = new FakeServer();
    const pc = new Device(sample(), server, await cipherFor("u1"));
    await pc.sync();
    const all = JSON.stringify([...server.rows.values()]);
    expect(all).not.toMatch(/Marta|Llegeix|plural|contenta/);
    expect(server.rows.size).toBe(stateToItems(sample()).size);
  });

  it("a new phone gets everything; then changes on both sides meet", async () => {
    const server = new FakeServer();
    const cipher = await cipherFor("u1");
    const pc = new Device(sample(), server, cipher);
    await pc.sync();

    const phone = new Device(emptyState(), server, cipher);
    await phone.sync(true); // dispositiu nou: només les dades del compte
    expect(phone.state).toEqual(pc.state);

    // Al mòbil: una nota nova i s'esborra la vella. A l'ordinador: canvia el model.
    phone.state = { ...phone.state, notes: [{ id: "n2", studentId: "s2", areaId: "ar1", text: "Ve content.", date: "2026-11-11", term: 1, createdAt: 2 }] };
    pc.state = { ...pc.state, reportGuide: "Escriure en plural i en positiu." };
    await phone.sync();
    await pc.sync();
    await phone.sync();

    expect(pc.state.notes.map((n) => n.id)).toEqual(["n2"]);
    expect(phone.state.reportGuide).toBe("Escriure en plural i en positiu.");
    expect(phone.state).toEqual(pc.state);
  });

  it("nothing is uploaded again when nothing changed", async () => {
    const server = new FakeServer();
    const pc = new Device(sample(), server, await cipherFor("u1"));
    await pc.sync();
    const r = await pc.sync();
    expect(r.pushed).toBe(0);
  });

  it("merging a device that already had its own data keeps both", async () => {
    const server = new FakeServer();
    const cipher = await cipherFor("u1");
    const pc = new Device(sample(), server, cipher);
    await pc.sync();
    const other = emptyState();
    other.notes = [{ id: "n9", studentId: "s1", areaId: "ar1", text: "Nota feta abans del compte.", date: "2026-11-09", term: 1, createdAt: 0 }];
    const laptop = new Device(other, server, cipher);
    await laptop.sync(); // «Ajunta-les»
    await pc.sync();
    expect(pc.state.notes.map((n) => n.id).sort()).toEqual(["n1", "n9"]);
    expect(laptop.state.students).toHaveLength(2);
  });

  it("when both devices change the same thing, this device wins and the other one gets it", async () => {
    const server = new FakeServer();
    const cipher = await cipherFor("u1");
    const pc = new Device(sample(), server, cipher);
    await pc.sync();
    const phone = new Device(emptyState(), server, cipher);
    await phone.sync(true);
    phone.state = { ...phone.state, exampleReport: "del mòbil" };
    pc.state = { ...pc.state, exampleReport: "de l'ordinador" };
    await phone.sync();
    await pc.sync(); // conflicte: es queda el de l'ordinador i el puja
    await phone.sync();
    expect(pc.state.exampleReport).toBe("de l'ordinador");
    expect(phone.state.exampleReport).toBe("de l'ordinador");
  });

  it("another user's key cannot read the rows", async () => {
    const server = new FakeServer();
    const pc = new Device(sample(), server, await cipherFor("u1"));
    await pc.sync();
    const intruder = new Device(emptyState(), server, await cipherFor("u1"));
    await expect(intruder.sync(true)).rejects.toThrow(/desxifrar/);
  });

  it("uses Argon2id params that match production by default", () => {
    expect(KDF_V1.memLimitBytes).toBe(64 * 1024 * 1024);
  });
});
