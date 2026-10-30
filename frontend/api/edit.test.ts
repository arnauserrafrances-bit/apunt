import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, { chatPrompt, validateChat, type ChatRequest } from "./edit";

function reply(input: unknown) {
  return { ok: true, status: 200, json: async () => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "chat_reply", input }] }) };
}
function fakeRes() {
  const out: { code?: number; body?: unknown } = {};
  const res = { status(c: number) { out.code = c; return res; }, json(b: unknown) { out.body = b; } };
  return { res, out };
}
const body: ChatRequest = {
  message: "Canvia-ho per un sinònim",
  quote: { areaId: "ling", text: "Mostra també" },
  paragraphs: [
    { areaId: "ling", name: "Àmbit lingüístic", text: "La A-01 mostra interès. Mostra també constància." },
    { areaId: "mat", name: "Àmbit matemàtic", text: "En A-01 suma bé." },
  ],
  history: [{ role: "user", text: "Hola" }, { role: "assistant", text: "Digues." }],
};

beforeEach(() => {
  vi.stubEnv("APUNT_ACCESS_CODE", "secret");
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("xat d'assistència", () => {
  it("valida la petició", () => {
    expect(validateChat(body)).toEqual(body);
    expect(validateChat({ ...body, message: "" })).toBeTypeOf("string");
    expect(validateChat({ ...body, paragraphs: [] })).toBeTypeOf("string");
    expect(validateChat({ ...body, history: [{ role: "system", text: "x" }] })).toBeTypeOf("string");
  });
  it("el prompt porta l'informe, la conversa, el fragment marcat i el missatge", () => {
    const t = chatPrompt(body);
    expect(t).toContain("[areaId: ling] Àmbit lingüístic");
    expect(t).toContain("Tutora: Hola");
    expect(t).toContain("FRAGMENT MARCAT (a l'àrea ling)\n«Mostra també»");
    expect(t).toContain("MISSATGE NOU DE LA TUTORA\nCanvia-ho per un sinònim");
  });
  it("demana el codi d'accés", async () => {
    const { res, out } = fakeRes();
    await handler({ method: "POST", headers: { "x-apunt-code": "no" }, body }, res);
    expect(out.code).toBe(401);
  });
  it("retorna la resposta i només els canvis vàlids", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reply({
          reply: "He canviat «Mostra» per «Manifesta».",
          edits: [
            { areaId: "ling", paragraph: "La A-01 mostra interès. Manifesta també constància." },
            { areaId: "inventada", paragraph: "x" },
            { areaId: "mat", paragraph: "En A-01 suma bé." },
          ],
        }),
      ),
    );
    const { res, out } = fakeRes();
    await handler({ method: "POST", headers: { "x-apunt-code": "secret" }, body }, res);
    expect(out.code).toBe(200);
    expect(out.body).toEqual({
      reply: "He canviat «Mostra» per «Manifesta».",
      edits: [{ areaId: "ling", paragraph: "La A-01 mostra interès. Manifesta també constància." }],
    });
  });
  it("si només respon, no hi ha canvis", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ reply: "Sinònims: evidencia, manifesta, demostra." })));
    const { res, out } = fakeRes();
    await handler({ method: "POST", headers: { "x-apunt-code": "secret" }, body }, res);
    expect(out.body).toEqual({ reply: "Sinònims: evidencia, manifesta, demostra." });
  });
});

describe("learning loop al xat", () => {
  it("retorna la preferència proposada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ reply: "Fet.", preference: "Evitar repetir «mostra»" })));
    const { res, out } = fakeRes();
    await handler({ method: "POST", headers: { "x-apunt-code": "secret" }, body }, res);
    expect(out.body).toEqual({ reply: "Fet.", preference: "Evitar repetir «mostra»" });
  });
  it("no la proposa si ja existeix o si l'aprenentatge està apagat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ reply: "Fet.", preference: "Evitar repetir «mostra»" })));
    for (const extra of [{ preferences: ["evitar repetir «mostra»"] }, { learning: false }]) {
      const { res, out } = fakeRes();
      await handler({ method: "POST", headers: { "x-apunt-code": "secret" }, body: { ...body, ...extra } }, res);
      expect(out.body).toEqual({ reply: "Fet." });
    }
  });
  it("les preferències aprovades van al prompt", () => {
    expect(chatPrompt({ ...body, preferences: ["Escriure en positiu"] })).toContain("PREFERÈNCIES DE LA TUTORA (ja aprovades)\n- Escriure en positiu");
  });
});
