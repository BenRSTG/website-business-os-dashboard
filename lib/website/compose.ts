import type { Lead } from "@/lib/leads/types";
import type { LeadIndustry } from "@/lib/leads/constants";
import { LEAD_INDUSTRY_LABELS } from "@/lib/leads/constants";
import { telHref } from "./content/links";
import type { Section } from "./content/schemas";
import { datenschutzSection, impressumSection, type LegalFacts } from "./legal";
import type { Feature } from "./features";
import { isOnePager, type SitePackage } from "./packages";
import { fitText, type FeatureCopy, type HomeCopy, type LeistungenCopy, type Plan, type SeoOutput } from "./prompts";
import type { SiteStyle } from "./tokens";

export interface PageDraft {
  slug: string;
  page_type: "home" | "leistungen" | "kontakt" | "impressum" | "datenschutz";
  title: string;
  sections: Section[];
  seo: Record<string, unknown>;
}

type NavbarVariant = "standard" | "centered";
type ServicesVariant = "grid-cards" | "list-alternating";
type ContactVariant = "form-info-side" | "form-centered";

// Aufbau je Stil (Varianten der Komponenten). Nur das Hero wählt die KI; der Rest folgt dem Stil.
const STYLE_VARIANTS: Record<SiteStyle, { navbar: NavbarVariant; services: ServicesVariant; contact: ContactVariant }> = {
  modern: { navbar: "standard", services: "grid-cards", contact: "form-info-side" },
  traditional: { navbar: "centered", services: "list-alternating", contact: "form-centered" },
  premium: { navbar: "standard", services: "grid-cards", contact: "form-info-side" },
};

const IMAGE_ALT: Record<LeadIndustry, string> = {
  maler: "Maler bei der Arbeit an einer Wand",
  elektro: "Elektriker bei der Arbeit am Sicherungskasten",
  shk: "Handwerker bei der Installation von Heizung und Sanitär",
  dachdecker: "Dachdecker bei der Arbeit auf einem Dach",
  garten_landschaft: "Garten- und Landschaftsbau bei der Arbeit",
  sonstiges: "Handwerker bei der Arbeit",
};

export function leadAddress(lead: Lead): string | null {
  const city = [lead.address_zip, lead.address_city].filter(Boolean).join(" ");
  return [lead.address_street, city].filter(Boolean).join("\n") || null;
}

const placeholderImage = (slot_id: string, alt: string) => ({ slot_id, alt, source: "placeholder" as const });
const oneLine = (address: string) => address.replace(/\n/g, ", ");

export interface ComposeInput {
  lead: Lead;
  plan: Plan;
  style: SiteStyle;
  home: HomeCopy;
  /** Fehlt bei Basis (eine Seite): dort gibt es keine eigene Leistungs- und Kontaktseite */
  leistungen: LeistungenCopy | null;
  package: SitePackage;
  seo: SeoOutput | null;
  features: Feature[];
  featureCopy: FeatureCopy | null;
}

export function composePages(input: ComposeInput): PageDraft[] {
  const { lead, plan, style, home, leistungen, features, featureCopy } = input;
  const onePager = isOnePager(input.package);
  // Basis: alles auf einer Seite, das Menü springt zu den Abschnitten.
  const toServices = onePager ? "/#leistungen" : "/leistungen";
  const toContact = onePager ? "/#kontakt" : "/kontakt";
  const has = (f: Feature) => features.includes(f);
  const copy = featureCopy;
  const v = STYLE_VARIANTS[style];
  const address = leadAddress(lead);
  const callLabel = lead.phone ? "Jetzt anrufen" : "Anfrage senden";
  const callHref = lead.phone ? telHref(lead.phone) : toContact;
  const legalFacts: LegalFacts = { companyName: lead.company_name, address, phone: lead.phone, email: lead.email };
  const hasRating = lead.google_rating !== null && lead.google_rating_count !== null;

  const navbar: Section = {
    component_type: "navbar",
    variant: v.navbar,
    content: {
      logo_text: lead.company_name,
      links: [
        { label: "Startseite", href: "/" },
        { label: "Leistungen", href: toServices },
        { label: "Kontakt", href: toContact },
      ],
      cta_label: callLabel,
      cta_href: callHref,
    },
  };

  const footer: Section = {
    component_type: "footer",
    variant: "standard",
    content: {
      company_name: lead.company_name,
      tagline: null,
      address,
      phone: lead.phone,
      email: lead.email,
      links: [
        { label: "Startseite", href: "/" },
        { label: "Leistungen", href: toServices },
        { label: "Kontakt", href: toContact },
      ],
      legal_links: [
        { label: "Impressum", href: "/impressum" },
        { label: "Datenschutz", href: "/datenschutz" },
      ],
    },
  };

  const heroSection: Section = {
    component_type: "hero",
    variant: plan.hero_variant,
    content: {
      eyebrow: home.eyebrow,
      headline: home.headline,
      subheadline: home.subheadline,
      cta_label: callLabel,
      cta_href: callHref,
      secondary_label: "Unsere Leistungen",
      secondary_href: toServices,
      image: placeholderImage("hero", IMAGE_ALT[lead.industry]),
      points: home.points,
    },
  };

  // Kennzahlen nur aus den Stammdaten (Google-Bewertung), nie von der KI.
  const stats = hasRating
    ? [
        { value: `${String(lead.google_rating).replace(".", ",")} von 5`, label: "Google-Bewertung" },
        { value: String(lead.google_rating_count), label: "Bewertungen" },
      ]
    : undefined;

  // --- Bausteine der Feature-Auswahl. Unbekanntes bleibt ein markierter Platzhalter, nie eine Erfindung.
  const PLACEHOLDER = "[bitte ergänzen]";
  const serviceTitles = home.services_items.map((i) => i.title);

  const teamSection: Section = {
    component_type: "team",
    variant: "cards",
    content: {
      headline: copy?.team_headline ?? "Ihre Ansprechpartner",
      intro: copy?.team_intro ?? null,
      members: [
        { name: lead.contact_name ?? "[Name ergänzen]", role: lead.contact_name ? "Ansprechpartner" : "[Funktion ergänzen]" },
        { name: "[Name ergänzen]", role: "[Funktion ergänzen]" },
      ],
    },
  };

  const gallerySection: Section = {
    component_type: "gallery",
    variant: "grid",
    content: {
      headline: copy?.gallery_headline ?? "Einblicke in unsere Arbeit",
      intro: copy?.gallery_intro ?? null,
      items: serviceTitles.slice(0, 3).map((title, i) => ({
        image: placeholderImage(`gallery-${i + 1}`, `Beispielbild: ${title}`),
        caption: `Beispiel: ${title}`,
      })),
    },
  };

  const pricingItems =
    copy && copy.pricing_items.length > 0
      ? copy.pricing_items.map((p) => ({ title: p.title, price: "[Preis ergänzen]", description: p.description, features: p.features.length ? p.features : undefined }))
      : home.services_items.slice(0, 3).map((i) => ({ title: i.title, price: "[Preis ergänzen]", description: i.description }));
  const pricingSection: Section = {
    component_type: "pricing",
    variant: "cards",
    content: {
      headline: copy?.pricing_headline ?? "Preise und Pakete",
      intro: copy?.pricing_intro ?? null,
      note: copy?.pricing_note ?? "Alle Angaben unverbindlich. Den genauen Preis nennen wir nach Rücksprache.",
      items: pricingItems,
    },
  };

  const hoursSection: Section = {
    component_type: "hours",
    variant: "standard",
    content: {
      headline: copy?.hours_headline ?? "Erreichbarkeit",
      intro: copy?.hours_intro ?? null,
      hours: copy && copy.opening_hours.length > 0 ? copy.opening_hours : [{ days: "Öffnungszeiten", hours: PLACEHOLDER }],
      area_headline: "Einsatzgebiet",
      area_text: copy?.service_area ?? "[Einsatzgebiet ergänzen]",
    },
  };

  const bookingSection: Section = {
    component_type: "booking",
    variant: "request-form",
    content: {
      headline: copy?.booking_headline ?? "Termin anfragen",
      intro: copy?.booking_intro ?? "Nennen Sie uns Ihren Wunschtermin. Wir bestätigen ihn persönlich.",
      note: null,
    },
  };

  const homeSections: Section[] = [
    navbar,
    heroSection,
    {
      component_type: "services",
      variant: v.services,
      content: { headline: home.services_headline, intro: home.services_intro, items: home.services_items },
    },
    {
      component_type: "about",
      variant: stats && style !== "modern" ? "stats-highlight" : "text-image",
      content: {
        headline: home.about_headline,
        paragraphs: home.about_paragraphs,
        image: placeholderImage("about", `${LEAD_INDUSTRY_LABELS[lead.industry]}-Betrieb ${lead.company_name}`),
        stats,
      },
    },
    ...(has("pricing_team") ? [teamSection] : []),
    ...(has("gallery") ? [gallerySection] : []),
    { component_type: "faq", variant: "accordion", content: { headline: home.faq_headline, items: home.faq_items } },
    footer,
  ];

  const leistungenSections: Section[] = [
    navbar,
    {
      component_type: "services",
      variant: v.services,
      content: { headline: leistungen?.headline ?? home.services_headline, intro: leistungen?.intro ?? home.services_intro, items: leistungen?.items ?? home.services_items },
    },
    ...(has("pricing_team") ? [pricingSection] : []),
    footer,
  ];

  const contactSection: Section = {
    component_type: "contact",
    variant: v.contact,
    content: {
      headline: leistungen?.contact_headline ?? "Kontakt",
      intro: leistungen?.contact_intro ?? "Rufen Sie uns an oder schreiben Sie uns. Wir melden uns zeitnah bei Ihnen.",
      phone: lead.phone,
      email: lead.email,
      address,
      form_note: "Die Daten aus dem Formular verwenden wir nur, um Ihre Anfrage zu beantworten.",
    },
  };
  const locationSections: Section[] =
    has("map") && address
      ? [
          {
            component_type: "location",
            variant: "map-text",
            content: { headline: "So finden Sie uns", address: oneLine(address), area_text: null, map_query: oneLine(address) },
          },
        ]
      : [];

  const kontaktSections: Section[] = [
    navbar,
    contactSection,
    ...(has("booking_request") ? [bookingSection] : []),
    ...(has("hours_area") ? [hoursSection] : []),
    ...locationSections,
    footer,
  ];

  // Basis: Startseite mit allem Nötigen (Leistungen, Über uns, Zeiten, Kontakt, Karte), ohne FAQ und ohne weitere Seiten.
  const onePagerSections: Section[] = [
    navbar,
    heroSection,
    homeSections.find((s) => s.component_type === "services")!,
    homeSections.find((s) => s.component_type === "about")!,
    ...(has("hours_area") ? [hoursSection] : []),
    contactSection,
    ...locationSections,
    footer,
  ];

  const seoFor = (slug: string, fallbackTitle: string) => {
    const generated = input.seo?.pages.find((p) => p.slug === slug);
    return {
      title: generated ? fitText(generated.title, 60) : `${fallbackTitle} — ${lead.company_name}`.slice(0, 90),
      meta_description: generated ? fitText(generated.meta_description, 155) : undefined,
    };
  };

  const businessSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: lead.company_name,
    ...(lead.phone ? { telephone: lead.phone } : {}),
    ...(lead.email ? { email: lead.email } : {}),
    ...(lead.address_city
      ? {
          address: {
            "@type": "PostalAddress",
            ...(lead.address_street ? { streetAddress: lead.address_street } : {}),
            ...(lead.address_zip ? { postalCode: lead.address_zip } : {}),
            addressLocality: lead.address_city,
            addressCountry: "DE",
          },
        }
      : {}),
  };

  const legalSeo = (title: string) => ({ title: `${title} — ${lead.company_name}`.slice(0, 90) });

  const legalPages: PageDraft[] = [
    { slug: "/impressum", page_type: "impressum", title: "Impressum", sections: [navbar, impressumSection(legalFacts), footer], seo: legalSeo("Impressum") },
    { slug: "/datenschutz", page_type: "datenschutz", title: "Datenschutz", sections: [navbar, datenschutzSection(legalFacts, { map: has("map"), booking: has("booking_request") }), footer], seo: legalSeo("Datenschutz") },
  ];

  const homePage: PageDraft = {
    slug: "/",
    page_type: "home",
    title: "Startseite",
    sections: onePager ? onePagerSections : homeSections,
    seo: { ...seoFor("/", "Startseite"), schema: businessSchema },
  };

  if (onePager) return [homePage, ...legalPages];

  return [
    homePage,
    { slug: "/leistungen", page_type: "leistungen", title: "Leistungen", sections: leistungenSections, seo: seoFor("/leistungen", "Leistungen") },
    { slug: "/kontakt", page_type: "kontakt", title: "Kontakt", sections: kontaktSections, seo: seoFor("/kontakt", "Kontakt") },
    ...legalPages,
  ];
}
