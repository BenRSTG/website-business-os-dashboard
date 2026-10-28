import { afterEach, describe, expect, it, vi } from "vitest";

describe("Aktualisierung des site-engine", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
    delete process.env.REVALIDATE_SECRET;
    delete process.env.SITE_ENGINE_URL;
  });

  it("sendet Geheimnis im Header und die Adressen im Body", async () => {
    process.env.REVALIDATE_SECRET = "s".repeat(40);
    process.env.SITE_ENGINE_URL = "https://engine.example/";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as never;
    const { revalidateSites } = await import("@/lib/website/revalidate");
    expect(await revalidateSites(["a-1", "a-1", "b-2"])).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://engine.example/api/revalidate");
    expect((init.headers as Record<string, string>)["x-revalidate-secret"]).toBe("s".repeat(40));
    expect(JSON.parse(init.body as string)).toEqual({ keys: ["a-1", "b-2"] });
  });

  it("ohne Geheimnis oder bei Fehlern: false, aber kein Absturz", async () => {
    const { revalidateSites } = await import("@/lib/website/revalidate");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await revalidateSites(["a"])).toBe(false);
    process.env.REVALIDATE_SECRET = "s".repeat(40);
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("nein", { status: 403 })) as never;
    expect(await revalidateSites(["a"])).toBe(false);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline")) as never;
    expect(await revalidateSites(["a"])).toBe(false);
    expect(await revalidateSites([])).toBe(true);
  });
});
