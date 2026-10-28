import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORD_COUNT, generatePassword } from "@/lib/website/password";

describe("Passwort-Erzeugung", () => {
  it("hat das Format wort-wort-wort-ziffern und nur einfache Zeichen", () => {
    for (let i = 0; i < 200; i++) expect(generatePassword()).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{3}$/);
  });

  it("ist lang genug und zufällig genug (keine Wiederholungen in 500 Versuchen)", () => {
    const all = new Set(Array.from({ length: 500 }, () => generatePassword()));
    expect(all.size).toBe(500);
    expect(generatePassword().length).toBeGreaterThanOrEqual(8);
    expect(Math.log2(WORD_COUNT ** 3 * 1000)).toBeGreaterThan(28);
  });
});

const state = vi.hoisted(() => ({
  site: null as null | { id: string; preview_slug: string | null; status: string; preview_expires_at: string | null },
  rpc: vi.fn(),
  update: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    userId: "u",
    supabase: {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.site }) }) }),
        update: (values: unknown) => ({ eq: async () => state.update(values) }),
      }),
      rpc: state.rpc,
    },
  }),
}));
vi.mock("@/lib/leads/events", () => ({ refreshLeadViews: () => {} }));
vi.mock("@/lib/website/revalidate", () => ({ revalidateSites: state.revalidate }));

const ID = "11111111-1111-4111-8111-111111111111";
const DAY = 24 * 60 * 60 * 1000;

describe("Zugang zur Demo (Server-Aktionen)", () => {
  beforeEach(() => {
    state.site = { id: ID, preview_slug: "elektro-abc123", status: "PREVIEW", preview_expires_at: null };
    state.rpc.mockReset().mockResolvedValue({ error: null });
    state.update.mockReset().mockResolvedValue({ error: null });
    state.revalidate.mockReset().mockResolvedValue(true);
  });

  it("neues Passwort: setzt es über die Datenbank-Funktion, gibt es einmal zurück und aktualisiert den site-engine", async () => {
    const { renewDemoPassword } = await import("@/lib/website/access-actions");
    const result = await renewDemoPassword(ID);
    expect(result.error).toBeNull();
    expect(result.password).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{3}$/);
    expect(state.rpc).toHaveBeenCalledWith("set_preview_password", { p_site: ID, p_password: result.password });
    expect(state.revalidate).toHaveBeenCalledWith(["elektro-abc123"]);
  });

  it("Datenbankfehler wird gemeldet, ohne das Passwort preiszugeben", async () => {
    state.rpc.mockResolvedValue({ error: { message: "boom" } });
    const { renewDemoPassword } = await import("@/lib/website/access-actions");
    const result = await renewDemoPassword(ID);
    expect(result.error).toMatch(/nicht gesetzt/);
    expect(result.password).toBeUndefined();
    expect(state.revalidate).not.toHaveBeenCalled();
  });

  it("Passwort entfernen", async () => {
    const { removeDemoPassword } = await import("@/lib/website/access-actions");
    expect((await removeDemoPassword(ID)).error).toBeNull();
    expect(state.rpc).toHaveBeenCalledWith("clear_preview_password", { p_site: ID });
  });

  it("verlängert ab dem späteren von jetzt und bisherigem Ablauf", async () => {
    const { extendDemoAccess } = await import("@/lib/website/access-actions");
    const future = new Date(Date.now() + 5 * DAY).toISOString();
    state.site!.preview_expires_at = future;
    await extendDemoAccess(ID, 14);
    const until = Date.parse((state.update.mock.calls[0][0] as { preview_expires_at: string }).preview_expires_at);
    expect(Math.abs(until - (Date.parse(future) + 14 * DAY))).toBeLessThan(2000);

    state.update.mockClear();
    state.site!.preview_expires_at = new Date(Date.now() - 10 * DAY).toISOString();
    await extendDemoAccess(ID, 7);
    const again = Date.parse((state.update.mock.calls[0][0] as { preview_expires_at: string }).preview_expires_at);
    expect(Math.abs(again - (Date.now() + 7 * DAY))).toBeLessThan(2000);
  });

  it("nur erlaubte Laufzeiten", async () => {
    const { extendDemoAccess } = await import("@/lib/website/access-actions");
    for (const days of [0, 1, 365, -7, 14.5]) expect((await extendDemoAccess(ID, days)).error).toMatch(/Laufzeit/);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("Sperre setzt das Ablaufdatum auf jetzt und leert den Cache", async () => {
    const { lockDemo } = await import("@/lib/website/access-actions");
    const before = Date.now();
    expect((await lockDemo(ID)).error).toBeNull();
    const at = Date.parse((state.update.mock.calls[0][0] as { preview_expires_at: string }).preview_expires_at);
    expect(at).toBeGreaterThanOrEqual(before - 1000);
    expect(at).toBeLessThanOrEqual(Date.now() + 1000);
    expect(state.revalidate).toHaveBeenCalledWith(["elektro-abc123"]);
  });

  it("meldet, wenn der site-engine nicht benachrichtigt werden konnte", async () => {
    state.revalidate.mockResolvedValue(false);
    const { lockDemo } = await import("@/lib/website/access-actions");
    const result = await lockDemo(ID);
    expect(result.error).toBeNull();
    expect(result.warning).toMatch(/nicht benachrichtigt/);
  });

  it("lehnt ungültige Kennungen, fremde oder veröffentlichte Sites ab", async () => {
    const { lockDemo, renewDemoPassword } = await import("@/lib/website/access-actions");
    expect((await lockDemo("kein-uuid")).error).toMatch(/nicht gefunden/);
    state.site = null;
    expect((await renewDemoPassword(ID)).error).toMatch(/nicht gefunden/);
    state.site = { id: ID, preview_slug: "x", status: "LIVE", preview_expires_at: null };
    expect((await renewDemoPassword(ID)).error).toMatch(/nicht gefunden/);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
