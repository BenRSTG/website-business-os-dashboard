import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSections } from "@/lib/website/content/schemas";

// Die Demo-Daten des site-engine (erzeugt mit "npm run seed:demo" im site-engine) müssen gegen die hier kopierten
// Abschnitts-Schemas gültig sein. Weicht die Kopie vom site-engine ab, schlägt dieser Test nach dem nächsten Neuerzeugen an.
const fixture = JSON.parse(readFileSync(resolve(__dirname, "../fixtures/site-engine-demo-sections.json"), "utf8")) as {
  style: string;
  slug: string;
  sections: unknown;
}[];

describe("Abgleich mit dem site-engine", () => {
  it("enthält Seiten für alle drei Stile", () => {
    expect(new Set(fixture.map((f) => f.style)).size).toBe(3);
  });

  it.each(fixture.map((f) => [`${f.style} ${f.slug}`, f.sections] as const))("%s ist gültig", (_name, sections) => {
    for (const r of parseSections(sections)) expect(r.ok, r.ok ? "" : r.error).toBe(true);
  });
});
