import { describe, expect, it } from "vitest";
import handler, { parseVerdict, validateJudge } from "./judge";

describe("parseVerdict", () => {
  it("reads the verdict on the last line and keeps the reason", () => {
    expect(parseVerdict("Every sentence comes from the notes.\nPASS")).toEqual({ reason: "Every sentence comes from the notes.", verdict: "PASS" });
  });
  it("accepts markdown and a 'Verdict:' label", () => {
    expect(parseVerdict("Adds advice.\n\n**Verdict: FAIL**").verdict).toBe("FAIL");
  });
  it("falls back to UNKNOWN when there is no verdict", () => {
    expect(parseVerdict("I am not sure.").verdict).toBe("UNKNOWN");
  });
});

describe("validateJudge", () => {
  it("needs a prompt", () => {
    expect(typeof validateJudge({})).toBe("string");
    expect(validateJudge({ prompt: "x" })).toEqual({ prompt: "x" });
  });
  it("rejects very long prompts", () => {
    expect(typeof validateJudge({ prompt: "a".repeat(40_001) })).toBe("string");
  });
});

describe("handler", () => {
  it("refuses a wrong access code", async () => {
    process.env.APUNT_ACCESS_CODE = "right";
    let status = 0;
    const res = { status(c: number) { status = c; return res; }, json() {} };
    await handler({ method: "POST", headers: { "x-apunt-code": "wrong" }, body: { prompt: "x" } }, res);
    expect(status).toBe(401);
  });
});
