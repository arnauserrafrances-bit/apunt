import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./recover";

// Supabase fals: rpc user_id_by_email, keyrings (lectura i PATCH) i admin users (PUT).
function fakeSupabase(verifier: string | null) {
  const state = {
    keyring: { version: 1, wrappedPw: "old-wrapped", wrappedRecovery: "wrapped-with-code", pendingWrappedPw: null as string | null },
    password: "old-auth-key",
    calls: [] as string[],
    headers: [] as Record<string, string>[],
  };
  const fetchMock = vi.fn(async (url: string, init: { method?: string; body?: string; headers: Record<string, string> }) => {
    const u = new URL(url);
    state.calls.push(`${init.method ?? "GET"} ${u.pathname}`);
    state.headers.push(init.headers);
    const ok = (body: unknown, status = 200) => ({ ok: true, status, text: async () => (body === undefined ? "" : JSON.stringify(body)) });
    if (u.pathname === "/rest/v1/rpc/user_id_by_email") {
      const { p_email } = JSON.parse(init.body!);
      return ok(p_email === "tutora@example.com" ? "user-1" : null);
    }
    if (u.pathname === "/rest/v1/keyrings" && (init.method ?? "GET") === "GET") return ok([{ keyring: { ...state.keyring }, recovery_verifier: verifier }]);
    if (u.pathname === "/rest/v1/keyrings" && init.method === "PATCH") {
      state.keyring = JSON.parse(init.body!).keyring;
      return ok(undefined, 204);
    }
    if (u.pathname === "/auth/v1/admin/users/user-1" && init.method === "PUT") {
      state.password = JSON.parse(init.body!).password;
      return ok({ id: "user-1" });
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({ message: "not found" }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return state;
}

function fakeRes() {
  const out: { code?: number; body?: Record<string, unknown> } = {};
  const res = {
    status(c: number) {
      out.code = c;
      return res;
    },
    json(b: Record<string, unknown>) {
      out.body = b;
    },
  };
  return { res, out };
}

const PROOF = "proof-from-the-recovery-code_123";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("/api/recover", () => {
  it("needs the secret key on the server", async () => {
    fakeSupabase(sha(PROOF));
    const { res, out } = fakeRes();
    await handler({ method: "POST", body: { step: "start", email: "tutora@example.com" } }, res);
    expect(out.code).toBe(502);
    expect(out.body?.error).toMatch(/SUPABASE_SECRET_KEY/);
  });

  it("start: returns only the keyring wrapped with the recovery code", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    const sb = fakeSupabase(sha(PROOF));
    const { res, out } = fakeRes();
    await handler({ method: "POST", body: { step: "start", email: "Tutora@Example.com " } }, res);
    expect(out.code).toBe(200);
    expect(out.body).toEqual({ wrappedRecovery: "wrapped-with-code", version: 1 });
    expect(sb.headers[0].apikey).toBe("sb_secret_test");
    expect(sb.headers[0].authorization).toBeUndefined(); // les claus noves no van a Authorization
  });

  it("start: unknown email and accounts without recovery get a clear message", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    fakeSupabase(null);
    let r = fakeRes();
    await handler({ method: "POST", body: { step: "start", email: "ningu@example.com" } }, r.res);
    expect(r.out.code).toBe(404);
    r = fakeRes();
    await handler({ method: "POST", body: { step: "start", email: "tutora@example.com" } }, r.res);
    expect(r.out.code).toBe(409);
  });

  it("finish: wrong proof changes nothing", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    const sb = fakeSupabase(sha(PROOF));
    const { res, out } = fakeRes();
    await handler({ method: "POST", body: { step: "finish", email: "tutora@example.com", proof: "a-wrong-proof-1234567", authKey: "new-auth-key-123456", wrappedPw: "new-wrapped-pw-123" } }, res);
    expect(out.code).toBe(403);
    expect(sb.password).toBe("old-auth-key");
    expect(sb.keyring.wrappedPw).toBe("old-wrapped");
  });

  it("finish: right proof sets the new password and keyring, keeping the recovery wrap", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    const sb = fakeSupabase(sha(PROOF));
    const { res, out } = fakeRes();
    await handler({ method: "POST", body: { step: "finish", email: "tutora@example.com", proof: PROOF, authKey: "new-auth-key-123456", wrappedPw: "new-wrapped-pw-123" } }, res);
    expect(out.code).toBe(200);
    expect(sb.password).toBe("new-auth-key-123456");
    expect(sb.keyring).toEqual({ version: 1, wrappedPw: "new-wrapped-pw-123", wrappedRecovery: "wrapped-with-code", pendingWrappedPw: null });
    // ordre segur: primer el clauer pendent, després la contrasenya, després el clauer definitiu
    expect(sb.calls.filter((c) => !c.startsWith("POST") && !c.startsWith("GET"))).toEqual([
      "PATCH /rest/v1/keyrings",
      "PUT /auth/v1/admin/users/user-1",
      "PATCH /rest/v1/keyrings",
    ]);
  });

  it("rejects bad input", async () => {
    const { res, out } = fakeRes();
    await handler({ method: "POST", body: { step: "start", email: "no-és-un-correu" } }, res);
    expect(out.code).toBe(400);
  });
});
