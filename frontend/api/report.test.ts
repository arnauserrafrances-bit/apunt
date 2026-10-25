import { afterEach, describe, expect, it, vi } from "vitest";
import handler, { extractJson, mergeReport, notesBlock, validateRequest, type ReportRequest } from "./report";

const req: ReportRequest = {
  code: "A-01",
  term: "1r trimestre",
  areas: [
    { areaId: "mat", areaName: "Matemàtiques", notes: [{ date: "2026-10-02", text: "L'A-01 fa bé les sumes portant." }] },
    { areaId: "cat", areaName: "Llengua catalana", notes: [{ date: "2026-10-05", text: "Llegeix amb fluïdesa." }] },
  ],
};

function claudeReply(obj: unknown) {
  return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "```json\n" + JSON.stringify(obj) + "\n```" }] }) };
}

function fakeRes() {
  const out: { code?: number; body?: unknown } = {};
  const res = {
    status(c: number) { out.code = c; return res; },
    json(b: unknown) { out.body = b; },
  };
  return { res, out };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("validateRequest", () => {
  it("accepta una petició correcta", () => expect(validateRequest(req)).toEqual(req));
  it("rebutja un codi que no és A-01", () => expect(validateRequest({ ...req, code: "Pau" })).toBeTypeOf("string"));
  it("rebutja àrees sense notes", () =>
    expect(validateRequest({ ...req, areas: [{ areaId: "x", areaName: "X", notes: [] }] })).toBeTypeOf("string"));
  it("rebutja massa text", () => {
    const big = { ...req, areas: [{ ...req.areas[0], notes: [{ date: "d", text: "a".repeat(40_000) }] }] };
    expect(validateRequest(big)).toBeTypeOf("string");
  });
});

describe("helpers", () => {
  it("notesBlock inclou codi, àrea i notes", () => {
    const t = notesBlock(req);
    expect(t).toContain("Alumne: A-01");
    expect(t).toContain("Àrea: Matemàtiques (id: mat)");
    expect(t).toContain("- 2026-10-02: L'A-01 fa bé les sumes portant.");
  });
  it("extractJson treu el JSON encara que hi hagi text al voltant", () =>
    expect(extractJson('Aquí tens:\n```json\n{"a":1}\n```')).toEqual({ a: 1 }));
  it("mergeReport posa les marques i ignora àrees no demanades", () => {
    const out = mergeReport(
      req,
      { areas: [{ areaId: "mat", sentences: ["Frase 1.", "Frase 2."] }, { areaId: "intrusa", sentences: ["x"] }] },
      { flags: [{ areaId: "mat", index: 1, reason: "No surt de les notes." }, { areaId: "mat", index: 9, reason: "fora" }] },
    );
    expect(out.areas).toEqual([{ areaId: "mat", sentences: [{ text: "Frase 1." }, { text: "Frase 2.", flag: "No surt de les notes." }] }]);
  });
  it("mergeReport talla a 8 frases", () => {
    const out = mergeReport(req, { areas: [{ areaId: "mat", sentences: Array(12).fill("F.") }] }, { flags: [] });
    expect(out.areas[0].sentences).toHaveLength(8);
  });
});

describe("handler", () => {
  it("demana el codi d'accés", async () => {
    vi.stubEnv("APUNT_ACCESS_CODE", "secret");
    const { res, out } = fakeRes();
    await handler({ method: "POST", headers: { "x-apunt-code": "wrong" }, body: req }, res);
    expect(out.code).toBe(401);
  });
  it("només accepta POST", async () => {
    const { res, out } = fakeRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(out.code).toBe(405);
  });
  it("redacta, revisa i uneix (API simulada)", async () => {
    vi.stubEnv("APUNT_ACCESS_CODE", "secret");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(claudeReply({ areas: [{ areaId: "mat", sentences: ["L'A-01 fa bé les sumes portant.", "És el millor de la classe."] }] }))
      .mockResolvedValueOnce(claudeReply({ flags: [{ areaId: "mat", index: 1, reason: "Compara amb altres alumnes." }] }));
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = fakeRes();
    await handler({ method: "POST", headers: { "x-apunt-code": "secret" }, body: req }, res);
    expect(out.code).toBe(200);
    expect(out.body).toEqual({
      areas: [{ areaId: "mat", sentences: [{ text: "L'A-01 fa bé les sumes portant." }, { text: "És el millor de la classe.", flag: "Compara amb altres alumnes." }] }],
    });
    // La clau només va a l'API d'Anthropic, i el que s'envia són les notes amb codis.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("sk-test");
    expect(init.body).toContain("Alumne: A-01");
  });
  it("retorna error si l'API falla", async () => {
    vi.stubEnv("APUNT_ACCESS_CODE", "secret");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 529, json: async () => ({}) }));
    const { res, out } = fakeRes();
    await handler({ method: "POST", headers: { "x-apunt-code": "secret" }, body: req }, res);
    expect(out.code).toBe(502);
  });
});

describe("model de l'escola i valoració final", () => {
  it("rebutja un model massa llarg", () => expect(validateRequest({ ...req, guide: "x".repeat(9000) })).toBeTypeOf("string"));

  it("envia el model a la redacció i afegeix la valoració final revisada", async () => {
    vi.stubEnv("APUNT_ACCESS_CODE", "secret");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        claudeReply({
          areas: [{ areaId: "mat", sentences: ["En l'àrea de matemàtiques, en A-01 fa bé les sumes portant."] }],
          closing: ["Com a punt fort, destaquem el càlcul.", "Pensem que ha de llegir més."],
        }),
      )
      .mockResolvedValueOnce(claudeReply({ flags: [{ areaId: "closing", index: 1, reason: "No surt de les notes." }] }));
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = fakeRes();
    await handler({ method: "POST", headers: { "x-apunt-code": "secret" }, body: { ...req, guide: "Escriure en plural. Un punt fort i un a millorar." } }, res);
    expect(out.code).toBe(200);
    expect(out.body).toEqual({
      areas: [
        { areaId: "mat", sentences: [{ text: "En l'àrea de matemàtiques, en A-01 fa bé les sumes portant." }] },
        { areaId: "closing", sentences: [{ text: "Com a punt fort, destaquem el càlcul." }, { text: "Pensem que ha de llegir més.", flag: "No surt de les notes." }] },
      ],
    });
    const draftBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(draftBody.system).toContain("MODEL D'INFORME DE L'ESCOLA");
    expect(draftBody.system).toContain("Escriure en plural. Un punt fort i un a millorar.");
    expect(fetchMock.mock.calls[1][1].body).toContain("Àrea id: closing");
  });

  it("sense model, el prompt no inclou la secció del model", async () => {
    vi.stubEnv("APUNT_ACCESS_CODE", "secret");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(claudeReply({ areas: [{ areaId: "mat", sentences: ["Frase."] }], closing: [] }))
      .mockResolvedValueOnce(claudeReply({ flags: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = fakeRes();
    await handler({ method: "POST", headers: { "x-apunt-code": "secret" }, body: req }, res);
    expect(out.code).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).system).not.toContain("MODEL D'INFORME DE L'ESCOLA");
    expect((out.body as { areas: unknown[] }).areas).toHaveLength(1);
  });
});

describe("text lliure", () => {
  const free: ReportRequest = {
    code: "A-01",
    term: "1r trimestre",
    areas: [
      { areaId: "ling", areaName: "Àmbit lingüístic", notes: [] },
      { areaId: "mat", areaName: "Àmbit matemàtic", notes: [] },
    ],
    freeText: "La A-01 llegeix amb fluïdesa. En mates domina la multiplicació.",
  };
  it("accepta àrees sense notes si hi ha text lliure", () => expect(validateRequest(free)).toEqual(free));
  it("sense text lliure, una àrea sense notes no és vàlida", () =>
    expect(validateRequest({ ...free, freeText: undefined })).toBeTypeOf("string"));
  it("rebutja un text lliure massa llarg", () =>
    expect(validateRequest({ ...free, freeText: "x".repeat(7000) })).toBeTypeOf("string"));
  it("el text lliure va al bloc que rep la IA", () => {
    const t = notesBlock(free);
    expect(t).toContain("Àrea: Àmbit lingüístic (id: ling)\n(sense notes)");
    expect(t).toContain("Text lliure de la tutora (reparteix-lo per àrees):\nLa A-01 llegeix amb fluïdesa.");
  });
});
