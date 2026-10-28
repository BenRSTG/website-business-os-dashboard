import { describe, expect, it } from "vitest";
import { parseWebsite } from "@/lib/audit/html-parse";
import { technicalFindings } from "@/lib/intelligence/findings";

const texts = (html: string, url = "http://alt.example.com", perf: number | null = null) =>
  technicalFindings(parseWebsite(html, url), { performanceScore: perf, mobileScore: null, screenshotDataUri: null }).map((f) => f.text);

describe("technicalFindings", () => {
  it("benennt die typischen Schwächen einer alten Seite", () => {
    const found = texts("<html><head><title>Hi</title></head><body><p>Tel 0761 / 123456</p></body></html>", "http://alt.example.com", 31);
    expect(found.join("\n")).toMatch(/SSL/);
    expect(found.join("\n")).toMatch(/Viewport/);
    expect(found.join("\n")).toMatch(/nur im Text/);
    expect(found.join("\n")).toMatch(/Kontaktformular/);
    expect(found.join("\n")).toMatch(/Meta-Description/);
    expect(found.join("\n")).toMatch(/Performance-Wert 31/);
  });

  it("findet bei einer guten Seite kaum etwas", () => {
    const good = `<html><head><title>Elektro Weber Lahr – Elektroinstallation und Notdienst</title>
    <meta name="description" content="Elektro Weber aus Lahr: Elektroinstallation, Photovoltaik und 24-Stunden-Notdienst in der Ortenau. Jetzt Termin anfragen.">
    <meta name="viewport" content="width=device-width"></head><body><nav><a href="/">A</a><a href="/b">B</a></nav>
    <h1>Elektro</h1><a href="tel:+49782155501">Anruf</a><form><input type="email"></form>
    <iframe src="https://www.google.com/maps/embed?x"></iframe><a href="https://facebook.com/x">f</a></body></html>`;
    expect(texts(good, "https://example.com", 90)).toEqual([]);
  });

  it("liefert ohne Messdaten nur das, was belegt ist", () => {
    expect(technicalFindings(null, null)).toEqual([]);
  });

  it("markiert alle Befunde als technisch", () => {
    const all = technicalFindings(parseWebsite("<html><body></body></html>", "http://x.de"), null);
    expect(all.length).toBeGreaterThan(3);
    expect(all.every((f) => f.category === "technical")).toBe(true);
  });
});
