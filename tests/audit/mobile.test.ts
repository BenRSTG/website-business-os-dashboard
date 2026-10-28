import { describe, expect, it } from "vitest";
import { combineMobileScore } from "@/lib/audit/mobile";

describe("combineMobileScore", () => {
  it("mittelt die vorhandenen Signale", () => {
    expect(combineMobileScore([75, 100])).toBe(88);
    expect(combineMobileScore([0, 100])).toBe(50);
  });
  it("ignoriert fehlende Signale", () => {
    expect(combineMobileScore([null, 100])).toBe(100);
    expect(combineMobileScore([undefined, 40, null])).toBe(40);
  });
  it("bleibt ungemessen, wenn es kein Signal gibt", () => {
    expect(combineMobileScore([])).toBeNull();
    expect(combineMobileScore([null, undefined])).toBeNull();
  });
});
