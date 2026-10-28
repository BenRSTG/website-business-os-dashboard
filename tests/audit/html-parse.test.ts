import { describe, expect, it } from "vitest";
import { parseWebsite } from "@/lib/audit/html-parse";

const good = `<!doctype html><html lang="de"><head>
<title>Elektro Weber Lahr – Elektroinstallation und Notdienst</title>
<meta name="description" content="Elektro Weber aus Lahr: Elektroinstallation, Photovoltaik und 24-Stunden-Notdienst in der Ortenau. Jetzt Termin anfragen.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>var tracking = "nicht sichtbar";</script><style>.x{color:red}</style></head>
<body><header><nav><a href="/">Start</a><a href="/leistungen">Leistungen</a><a href="/kontakt">Kontakt</a></nav></header>
<main><h1>Ihr Elektriker in Lahr</h1><h2>Leistungen</h2><h3>Installation</h3><h2>Kontakt</h2>
<p>Rufen Sie uns an: <a href="tel:+497821555010">07821 555 010</a></p>
<form action="/send"><input type="text" name="name"><input type="email" name="mail"><textarea name="msg"></textarea></form>
<iframe src="https://www.google.com/maps/embed?pb=123"></iframe>
<a href="https://www.facebook.com/elektroweber">Facebook</a>
<a href="https://instagram.com/elektroweber">Instagram</a>
<a href="https://www.facebook.com/elektroweber/posts/1">Beitrag</a>
</main></body></html>`;

describe("parseWebsite", () => {
  const result = parseWebsite(good, "https://elektro-weber.example.com/");

  it("erkennt Title und Description in sinnvoller Länge", () => {
    expect(result.metaTitleOk).toBe(true);
    expect(result.metaDescriptionOk).toBe(true);
  });

  it("erkennt eine saubere Überschriftenstruktur", () => {
    expect(result.headingStructureOk).toBe(true);
    expect(result.headings[0]).toBe("H1: Ihr Elektriker in Lahr");
  });

  it("erkennt Kontaktmöglichkeiten, Karte, Navigation und Viewport", () => {
    expect(result.phoneLinkPresent).toBe(true);
    expect(result.phoneDetected).toBe(true);
    expect(result.contactFormDetected).toBe(true);
    expect(result.mapsEmbedDetected).toBe(true);
    expect(result.navigationDetected).toBe(true);
    expect(result.viewportPresent).toBe(true);
  });

  it("zählt Social-Netzwerke einmal je Netzwerk", () => {
    expect(result.socialLinkCount).toBe(2);
  });

  it("erkennt SSL an der Endadresse", () => {
    expect(result.hasSsl).toBe(true);
    expect(parseWebsite(good, "http://example.com").hasSsl).toBe(false);
  });

  it("liefert einen Textauszug ohne Skripte und Styles", () => {
    expect(result.textExcerpt).toContain("Ihr Elektriker in Lahr");
    expect(result.textExcerpt).not.toContain("tracking");
    expect(result.textExcerpt).not.toContain("color:red");
  });

  it("begrenzt den Textauszug", () => {
    const long = `<html><body>${"Wort ".repeat(5000)}</body></html>`;
    expect(parseWebsite(long, "https://x.de").textExcerpt.length).toBeLessThanOrEqual(6000);
  });
});

describe("schwache Seite", () => {
  const weak = `<html><head><title>Hi</title></head><body>
  <h2>Willkommen</h2><h1>Zwei</h1><h1>H1</h1>
  <p>Telefon: 0761 / 123456, ruf an</p>
  <form action="/suche"><input type="text" name="q"></form></body></html>`;
  const result = parseWebsite(weak, "http://alt.example.com");

  it("bemängelt kurzen Title und fehlende Description", () => {
    expect(result.metaTitleOk).toBe(false);
    expect(result.metaDescriptionOk).toBe(false);
  });

  it("bemängelt die Überschriften (zwei H1, falsche Reihenfolge)", () => {
    expect(result.headingStructureOk).toBe(false);
  });

  it("findet die Telefonnummer im Text, aber keinen klickbaren Link", () => {
    expect(result.phoneDetected).toBe(true);
    expect(result.phoneLinkPresent).toBe(false);
  });

  it("hält ein Suchformular nicht für ein Kontaktformular", () => {
    expect(result.contactFormDetected).toBe(false);
  });

  it("meldet fehlende Navigation, Karte, Viewport und SSL", () => {
    expect(result.navigationDetected).toBe(false);
    expect(result.mapsEmbedDetected).toBe(false);
    expect(result.viewportPresent).toBe(false);
    expect(result.hasSsl).toBe(false);
  });
});

describe("Überschriften", () => {
  const check = (body: string) => parseWebsite(`<html><body>${body}</body></html>`, "https://x.de").headingStructureOk;
  it("verlangt mindestens eine Überschrift", () => expect(check("<p>nur Text</p>")).toBe(false));
  it("lässt H1 → H2 → H2 zu", () => expect(check("<h1>a</h1><h2>b</h2><h2>c</h2>")).toBe(true));
  it("lehnt übersprungene Ebenen ab", () => expect(check("<h1>a</h1><h3>b</h3>")).toBe(false));
  it("erlaubt das Zurückspringen", () => expect(check("<h1>a</h1><h2>b</h2><h3>c</h3><h2>d</h2>")).toBe(true));
});

describe("Telefonnummern", () => {
  const phone = (text: string) => parseWebsite(`<html><body><p>${text}</p></body></html>`, "https://x.de").phoneDetected;
  it.each(["07821 555 0101", "+49 761 123456", "0761/123456", "0761 / 123456", "0761 - 123456", "0049 7821 555010"])("erkennt %s", (n) => {
    expect(phone(`Tel ${n}`)).toBe(true);
  });
  it.each(["gegründet 2004", "Datum 01.02.2024", "PLZ 77933 Lahr"])("hält %s nicht für eine Nummer", (t) => {
    expect(phone(t)).toBe(false);
  });
});

describe("Telefonnummern in üblichen deutschen Schreibweisen", () => {
  const phone = (text: string) => parseWebsite(`<html><body><p>${text}</p></body></html>`, "https://x.de").phoneDetected;
  it.each([
    "Tel.: (0531) 123456",
    "Tel: (0531) 12 34 56",
    "Telefon 0531 / 12 34 56",
    "Fon: 0531-123456",
    "Mobil +49 (0) 171 1234567",
    "(07821) 555 0101",
  ])("erkennt %s", (text) => expect(phone(text)).toBe(true));

  it.each([
    "Stand: 28.10.2026",
    "Stand: 2026-10-28",
    "Gegründet 1930",
    "PLZ 38100 Braunschweig",
    "Preis 12,50 EUR",
    "Seite 3 von 12",
  ])("hält %s nicht für eine Nummer", (text) => expect(phone(text)).toBe(false));
});

describe("Navigation ohne <nav>-Element", () => {
  const nav = (body: string) => parseWebsite(`<html><body>${body}</body></html>`, "https://x.de").navigationDetected;

  it("erkennt eine Linkliste in einem Container (älteres Muster)", () => {
    expect(
      nav(`<div id="navigation"><ul class="tabbed"><li><a href="index.html">Startseite</a></li>
      <li><a href="a.html">Leistungen</a></li><li><a href="b.html">Preise</a></li><li><a href="c.html">Kontakt</a></li></ul></div>`),
    ).toBe(true);
  });

  it("erkennt Container mit menu im Namen", () => {
    expect(nav(`<div class="main-menu"><a href="/a">A</a> <a href="/b">B</a> <a href="/c">C</a></div>`)).toBe(true);
  });

  it("erkennt das semantische <nav>", () => {
    expect(nav(`<nav><a href="/a">A</a><a href="/b">B</a></nav>`)).toBe(true);
  });

  it("hält ein paar Links im Fließtext nicht für eine Navigation", () => {
    expect(nav(`<p>Lesen Sie <a href="/a">hier</a> oder <a href="/b">dort</a> mehr.</p>`)).toBe(false);
  });

  it("hält eine Liste langer Verweistexte nicht für eine Navigation", () => {
    const long = "Dies ist ein ausführlicher Beitragstitel mit viel Text";
    expect(nav(`<ul>${[1, 2, 3, 4].map((i) => `<li><a href="/${i}">${long} ${i}</a></li>`).join("")}</ul>`)).toBe(false);
  });
});
