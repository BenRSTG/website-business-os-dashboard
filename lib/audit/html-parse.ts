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

const PHONE_PATTERN = /(?:\+49|0049|0)\s?[1-9]\d{1,4}\s?[/.-]?\s?\d{3,}/;
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

  const navigationDetected = $("nav a").length >= 2 || $("header a").length >= 3;

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
    phoneDetected: phoneLinkPresent || PHONE_PATTERN.test(text),
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
