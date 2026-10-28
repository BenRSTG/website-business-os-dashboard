import "server-only";
import dns from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

export class AuditFetchError extends Error {}

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;

const blocked = new net.BlockList();
const v4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
for (const [address, prefix] of v4) blocked.addSubnet(address, prefix, "ipv4");
const v6: [string, number][] = [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["64:ff9b::", 96],
];
for (const [address, prefix] of v6) blocked.addSubnet(address, prefix, "ipv6");

/** true, wenn die Adresse nicht öffentlich erreichbar sein darf (intern, Loopback, Link-Local …) — oder ungültig ist. */
export function isPrivateAddress(input: string): boolean {
  const ip = input.replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) return isPrivateAddress(mapped[1]);
  if (net.isIPv4(ip)) return blocked.check(ip, "ipv4");
  if (net.isIPv6(ip)) return blocked.check(ip, "ipv6");
  return true;
}

/** Prüft die URL vor dem Abruf; wirft AuditFetchError mit verständlicher Meldung. */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AuditFetchError("Die Website-Adresse ist ungültig.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AuditFetchError("Nur http- und https-Adressen sind erlaubt.");
  }
  if (url.username || url.password) {
    throw new AuditFetchError("Adressen mit Zugangsdaten sind nicht erlaubt.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new AuditFetchError("Nur die Standard-Ports 80 und 443 sind erlaubt.");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new AuditFetchError("Diese Adresse ist nicht öffentlich erreichbar.");
  }
  const literal = host.replace(/^\[|\]$/g, "");
  if (net.isIP(literal) && isPrivateAddress(literal)) {
    throw new AuditFetchError("Diese Adresse ist nicht öffentlich erreichbar.");
  }
  return url;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number,
) => void;

type Resolver = (
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void,
) => void;

const systemResolver: Resolver = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) =>
    callback(err, (addresses ?? []) as dns.LookupAddress[]),
  );
};

const NOT_PUBLIC = "Diese Adresse ist nicht öffentlich erreichbar.";

// Die Adressprüfung läuft beim Verbindungsaufbau selbst — so kann ein Angreifer die DNS-Antwort
// nicht zwischen Prüfung und Verbindung austauschen (DNS-Rebinding). Schon ein einziger gesperrter
// Eintrag unter mehreren verwirft die ganze Antwort.
export function createSafeLookup(resolve: Resolver = systemResolver) {
  return function safeLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
    resolve(hostname, options, (error, list) => {
      if (error) return callback(error, []);
      if (list.length === 0 || list.some((entry) => isPrivateAddress(entry.address))) {
        return callback(new AuditFetchError(NOT_PUBLIC) as NodeJS.ErrnoException, []);
      }
      if (options.all) return callback(null, list);
      return callback(null, list[0].address, list[0].family);
    });
  };
}

const agent = new Agent({
  connect: { lookup: createSafeLookup() as unknown as net.LookupFunction },
});

// undici verpackt Fehler aus dem Verbindungsaufbau ("fetch failed") — die eigentliche Ursache steht in der cause-Kette.
function findAuditError(error: unknown): AuditFetchError | null {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current instanceof Error; depth++) {
    if (current instanceof AuditFetchError) return current;
    current = current.cause;
  }
  return null;
}

export interface FetchedPage {
  finalUrl: string;
  html: string;
  truncated: boolean;
}

async function readLimited(body: ReadableStream<Uint8Array> | null): Promise<{ text: string; truncated: boolean }> {
  if (!body) return { text: "", truncated: false };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks)), truncated };
}

export async function safeFetchHtml(startUrl: string): Promise<FetchedPage> {
  let url = assertSafeUrl(startUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response;
    try {
      response = await undiciFetch(url, {
        dispatcher: agent,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": "WebsiteBusinessOS-Audit/1.0 (+Website-Analyse im Auftrag des Betreibers)",
          accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (error) {
      const known = findAuditError(error);
      if (known) throw known;
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new AuditFetchError("Die Website hat nicht rechtzeitig geantwortet.");
      }
      throw new AuditFetchError("Die Website konnte nicht abgerufen werden.");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new AuditFetchError("Die Weiterleitung der Website ist fehlerhaft.");
      url = assertSafeUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new AuditFetchError(`Die Website antwortet mit Fehler ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      await response.body?.cancel();
      throw new AuditFetchError("Unter dieser Adresse liegt keine HTML-Seite.");
    }

    // undici und die DOM-Typen beschreiben denselben Byte-Stream unterschiedlich.
    const { text, truncated } = await readLimited(response.body as unknown as ReadableStream<Uint8Array> | null);
    return { finalUrl: url.toString(), html: text, truncated };
  }

  throw new AuditFetchError("Zu viele Weiterleitungen.");
}
