import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditFetchError, assertSafeUrl, createSafeLookup, isPrivateAddress, safeFetchHtml } from "@/lib/audit/safe-fetch";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "127.1.2.3",
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // Cloud-Metadaten
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1", // IPv4 in IPv6
    "::ffff:10.0.0.1",
    "64:ff9b::7f00:1",
    "nicht-eine-ip",
    "",
  ])("%s ist gesperrt", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "11.0.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "%s ist erlaubt",
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );
});

describe("assertSafeUrl", () => {
  it("lässt normale Adressen zu", () => {
    expect(assertSafeUrl("https://www.example.com/seite").hostname).toBe("www.example.com");
    expect(assertSafeUrl("http://example.com:80/").port).toBe("");
  });

  it.each([
    "ftp://example.com",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com:8080",
    "https://example.com:22",
    "http://localhost",
    "http://app.localhost",
    "http://drucker.local",
    "http://dienst.internal",
    "http://127.0.0.1",
    "http://[::1]",
    "http://169.254.169.254/latest/meta-data",
    "http://10.1.2.3",
    "kein-url",
  ])("%s wird abgelehnt", (url) => {
    expect(() => assertSafeUrl(url)).toThrow(AuditFetchError);
  });
});

describe("safeFetchHtml", () => {
  let server: http.Server;
  let port: number;
  let hits = 0;

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      hits++;
      res.setHeader("content-type", "text/html");
      res.end("<html><title>intern</title></html>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => server.close());

  it("ruft Loopback-Adressen nie ab", async () => {
    await expect(safeFetchHtml(`http://127.0.0.1:${port}/`)).rejects.toThrow(AuditFetchError);
    expect(hits).toBe(0);
  });
});

describe("createSafeLookup (Prüfung beim Verbindungsaufbau)", () => {
  const entry = (address: string) => ({ address, family: address.includes(":") ? 6 : 4 });
  const lookup = (addresses: { address: string; family: number }[]) =>
    createSafeLookup((_host, _opts, cb) => cb(null, addresses));
  const run = (fn: ReturnType<typeof createSafeLookup>, all: boolean) =>
    new Promise<{ error: Error | null; address: unknown; family?: number }>((resolve) => {
      fn("beispiel.de", { all }, (error, address, family) => resolve({ error, address, family }));
    });

  it("lässt öffentliche Adressen durch (einzeln)", async () => {
    const result = await run(lookup([entry("93.184.216.34")]), false);
    expect(result.error).toBeNull();
    expect(result.address).toBe("93.184.216.34");
    expect(result.family).toBe(4);
  });

  it("lässt öffentliche Adressen durch (Liste)", async () => {
    const result = await run(lookup([entry("93.184.216.34"), entry("2606:4700:4700::1111")]), true);
    expect(result.error).toBeNull();
    expect(result.address).toHaveLength(2);
  });

  it.each(["127.0.0.1", "10.0.0.8", "169.254.169.254", "::1", "fd00::1", "::ffff:192.168.1.5"])(
    "verwirft eine Domain, die auf %s zeigt",
    async (ip) => {
      const result = await run(lookup([entry(ip)]), true);
      expect(result.error).toBeInstanceOf(AuditFetchError);
      expect(result.error?.message).toMatch(/nicht öffentlich/);
    },
  );

  it("verwirft die ganze Antwort, wenn nur ein Eintrag intern ist (Rebinding mit Mischantwort)", async () => {
    const result = await run(lookup([entry("93.184.216.34"), entry("127.0.0.1")]), false);
    expect(result.error).toBeInstanceOf(AuditFetchError);
  });

  it("verwirft leere Antworten", async () => {
    expect((await run(lookup([]), true)).error).toBeInstanceOf(AuditFetchError);
  });

  it("reicht Fehler der Namensauflösung weiter", async () => {
    const failing = createSafeLookup((_h, _o, cb) => cb(new Error("ENOTFOUND") as NodeJS.ErrnoException, []));
    expect((await run(failing, true)).error?.message).toBe("ENOTFOUND");
  });
});
