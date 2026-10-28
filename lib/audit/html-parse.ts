import * as cheerio from "cheerio";

export interface HtmlChecks {
  title: string | null;
  metaDescription: string | null;
  metaTitleOk: boolean;
  metaDescriptionOk: boolean;
  headingStructureOk: boolean;
  headings: string[];
  phoneDetected: boolean;
  phoneLinkPresent: boolean;
  contactFormDetected: boolean;
  mapsEmbedDetected: boolean;
  navigationDetected: boolean;
  viewportPresent: boolean;
  socialLinkCount: number;
  hasSsl: boolean;
  textExcerpt: string;
}

// Vorwahl (auch in Klammern: "(0531) 31 25 21"), danach ein bis vier Ziffernblöcke. Das Lookbehind verhindert,
// dass mitten in einer Zahl begonnen wird (z. B. "024-10-28" aus dem Datum "2024-10-28").
const PHONE_PATTERN = /(?<!\d)(?:(?:\+49|0049)\s*|0\s?)[1-9]\d{1,4}(?:\s*[/.-]?\s*\d{2,}){1,4}(?!\d)/g;
const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "xing.com",
  "youtube.com",
  "tiktok.com",
  "pinterest.com",
  "twitter.com",
  "x.com",
];
const EXCERPT_LIMIT = 6000;

/** Telefonnummer im Text: Klammern um die Vorwahl entfernen, dann nach Nummernmustern mit 7 bis 15 Ziffern suchen. */
export function containsPhoneNumber(text: string): boolean {
  const normalized = text.replace(/\(0\)/g, " ").replace(/[()]/g, " ");
  for (const match of normalized.matchAll(PHONE_PATTERN)) {
    const digits = match[0].replace(/\D/g, "").length;
    if (digits >= 7 && digits <= 15) return true;
  }
  return false;
}

// Navigation: das semantische <nav>/<header>, ein Container mit "nav"/"menu" im Namen oder eine Liste kurzer Links.
// Viele ältere Seiten bauen ihr Menü als <div id="navigation"><ul>…, ohne <nav>.
function detectNavigation($: cheerio.CheerioAPI): boolean {
  if ($("nav a").length >= 2 || $("header a").length >= 3) return true;

  const named = $("[id], [class]")
    .toArray()
    .some((el) => /(^|[\s_-])(nav|navigation|menu|menue)([\s_-]|$)/i.test(`${$(el).attr("id") ?? ""} ${$(el).attr("class") ?? ""}`) && $(el).find("a[href]").length >= 3);
  if (named) return true;

  return $("ul, ol")
    .toArray()
    .some((list) => {
      const links = $(list).children("li").children("a[href]").toArray();
      return links.length >= 4 && links.every((a) => $(a).text().trim().length <= 30);
    });
}

// Genau eine H1 und keine übersprungenen Ebenen beim Absteigen (H1 → H3 ist ein Sprung).
function headingStructureOk(levels: number[]): boolean {
  if (levels.length === 0) return false;
  if (levels.filter((l) => l === 1).length !== 1) return false;
  if (levels[0] !== 1) return false;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) return false;
  }
  return true;
}

function socialHost(href: string): string | null {
  try {
    const host = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
    return SOCIAL_HOSTS.find((s) => host === s || host.endsWith(`.${s}`)) ?? null;
  } catch {
    return null;
  }
}

export function parseWebsite(html: string, finalUrl: string): HtmlChecks {
  const $ = cheerio.load(html);

  const title = $("head > title").first().text().trim() || null;
  const metaDescription = $('meta[name="description" i]').attr("content")?.trim() || null;

  const headingEls = $("h1, h2, h3, h4, h5, h6").toArray();
  const levels = headingEls.map((el) => Number(el.tagName.slice(1)));
  const headings = headingEls
    .map((el) => `${el.tagName.toUpperCase()}: ${$(el).text().replace(/\s+/g, " ").trim()}`)
    .filter((h) => h.length > 4)
    .slice(0, 15);

  const phoneLinkPresent = $('a[href^="tel:" i]').length > 0;

  const contactFormDetected = $("form")
    .toArray()
    .some((form) => $(form).find('textarea, input[type="email" i]').length > 0);

  const mapsEmbedDetected = $("iframe[src]")
    .toArray()
    .some((el) => /google\.[a-z.]+\/maps|maps\.google|openstreetmap\.org|maps\.app\.goo\.gl/i.test($(el).attr("src") ?? ""));

  const navigationDetected = detectNavigation($);

  const socialHosts = new Set<string>();
  $("a[href]").each((_, el) => {
    const host = socialHost($(el).attr("href") ?? "");
    if (host) socialHosts.add(host);
  });

  $("script, style, noscript, svg, template, iframe").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();

  return {
    title,
    metaDescription,
    metaTitleOk: title !== null && title.length >= 10 && title.length <= 70,
    metaDescriptionOk:
      metaDescription !== null && metaDescription.length >= 50 && metaDescription.length <= 170,
    headingStructureOk: headingStructureOk(levels),
    headings,
    phoneDetected: phoneLinkPresent || containsPhoneNumber(text),
    phoneLinkPresent,
    contactFormDetected,
    mapsEmbedDetected,
    navigationDetected,
    viewportPresent: $('meta[name="viewport" i]').length > 0,
    socialLinkCount: socialHosts.size,
    hasSsl: finalUrl.startsWith("https://"),
    textExcerpt: text.slice(0, EXCERPT_LIMIT),
  };
}
