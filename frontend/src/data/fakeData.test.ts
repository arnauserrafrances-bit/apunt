import { describe, expect, it } from "vitest";
import { newId } from "../lib/id";
import { createFakeData } from "./fakeData";

describe("ids", () => {
  it("són UUID v4 i no es repeteixen", () => {
    const ids = Array.from({ length: 1000 }, newId);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("dades de prova", () => {
  it("cada nota apunta a un alumne i una àrea que existeixen", () => {
    const data = createFakeData();
    const students = new Set(data.students.map((s) => s.id));
    const areas = new Set(data.areas.map((a) => a.id));
    expect(data.notes.length).toBeGreaterThan(50);
    for (const n of data.notes) {
      expect(students.has(n.studentId)).toBe(true);
      expect(areas.has(n.areaId)).toBe(true);
    }
    expect(data.nextStudentNumber).toBe(data.students.length + 1);
  });
});
