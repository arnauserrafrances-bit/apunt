import { afterEach, describe, expect, it, vi } from "vitest";
import handler, { classifyPrompt, mergeNotes, validateClassify } from "./classify";

const req = {
  code: "A-01",
  areas: [
    { areaId: "ar1", name: "Adaptació i actitud" },
    { areaId: "ar2", name: "Àmbit lingüístic" },
    { areaId: "ar3", name: "Àmbit matemàtic" },
  ],
  text: "La A-01 avui ha llegit molt bé i eh en mates li costa la divisió.",
};

function fakeRes() {
  const out: { code?: number; body?: unknown } = {};
  const res = {
    status(c: number) {
      out.code = c;
      return res;
    },
    json(b: unknown) {
      out.body = b;
    },
  };
  return { res, out };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("validateClassify", () => {
  it("accepts a valid request", () => expect(validateClassify(req)).toEqual(req));
  it("rejects bad input", () => {
    expect(validateClassify({ ...req, code: "Marta" })).toBe("Codi d'alumne no vàlid.");
    expect(validateClassify({ ...req, text: "  " })).toBe("La nota és buida.");
    expect(validateClassify({ ...req, text: "x".repeat(6001) })).toMatch(/massa llarga/);
    expect(validateClassify({ ...req, areas: [] })).toBe("Falten les àrees.");
  });
});

describe("mergeNotes", () => {
  it("keeps known areas in the tutor's order, joins duplicates and keeps the rest in other", () => {
    const out = mergeNotes(req, {
      notes: [
        { areaId: "ar3", text: "Li costa la divisió." },
        { areaId: "ar2", text: "Ha llegit molt bé." },
        { areaId: "ar3", text: "Fa bé les sumes." },
        { areaId: "xx", text: "Juga a futbol." },
        { areaId: "ar1", text: "  " },
      ],
      other: ["Ha portat galetes."],
    });
    expect(out).toEqual({
      notes: [
        { areaId: "ar2", text: "Ha llegit molt bé." },
        { areaId: "ar3", text: "Li costa la divisió. Fa bé les sumes." },
      ],
      other: ["Juga a futbol.", "Ha portat galetes."],
    });
  });
  it("fails when nothing came back", () => {
    expect(() => mergeNotes(req, { notes: [] })).toThrow(/no ha trobat/);
  });
  it("prompt lists the areas and the dictated text", () => {
    const p = classifyPrompt(req);
    expect(p).toContain("areaId: ar2 · Àmbit lingüístic");
    expect(p).toContain("ALUMNE: A-01");
    expect(p).toContain("li costa la divisió");
  });
});

describe("handler", () => {
  it("needs the access code", async () => {
    vi.stubEnv("APUNT_ACCESS_CODE", "secret");
    const { res, out } = fakeRes();
    await handler({ method: "POST", headers: { "x-apunt-code": "nope" }, body: req }, res);
    expect(out.code).toBe(401);
  });
  it("classifies with the (simulated) API and only sends codes", async () => {
    vi.stubEnv("APUNT_ACCESS_CODE", "secret");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: "write_notes", input: { notes: [{ areaId: "ar2", text: "La A-01 ha llegit molt bé." }], other: [] } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { res, out } = fakeRes();
    await handler({ method: "POST", headers: { "x-apunt-code": "secret" }, body: req }, res);
    expect(out.code).toBe(200);
    expect(out.body).toEqual({ notes: [{ areaId: "ar2", text: "La A-01 ha llegit molt bé." }], other: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.body).toContain("A-01");
    expect(init.body).not.toContain("Marta");
  });
});
