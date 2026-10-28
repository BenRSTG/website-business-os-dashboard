import type { Lead } from "@/lib/leads/types";
import type { LeadIndustry } from "@/lib/leads/constants";
import { LEAD_INDUSTRY_LABELS } from "@/lib/leads/constants";
import { telHref } from "./content/links";
import type { Section } from "./content/schemas";
import { datenschutzSection, impressumSection, type LegalFacts } from "./legal";
import type { HomeCopy, LeistungenCopy, Plan, SeoOutput } from "./prompts";
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
  leistungen: LeistungenCopy;
  seo: SeoOutput | null;
}

export function composePages(input: ComposeInput): PageDraft[] {
  const { lead, plan, style, home, leistungen } = input;
  const v = STYLE_VARIANTS[style];
  const address = leadAddress(lead);
  const callLabel = lead.phone ? "Jetzt anrufen" : "Anfrage senden";
  const callHref = lead.phone ? telHref(lead.phone) : "/kontakt";
  const legalFacts: LegalFacts = { companyName: lead.company_name, address, phone: lead.phone, email: lead.email };
  const hasRating = lead.google_rating !== null && lead.google_rating_count !== null;

  const navbar: Section = {
    component_type: "navbar",
    variant: v.navbar,
    content: {
      logo_text: lead.company_name,
      links: [
        { label: "Startseite", href: "/" },
        { label: "Leistungen", href: "/leistungen" },
        { label: "Kontakt", href: "/kontakt" },
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
        { label: "Leistungen", href: "/leistungen" },
        { label: "Kontakt", href: "/kontakt" },
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
      secondary_href: "/leistungen",
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
    { component_type: "faq", variant: "accordion", content: { headline: home.faq_headline, items: home.faq_items } },
    footer,
  ];

  const leistungenSections: Section[] = [
    navbar,
    {
      component_type: "services",
      variant: v.services,
      content: { headline: leistungen.headline, intro: leistungen.intro, items: leistungen.items },
    },
    footer,
  ];

  const kontaktSections: Section[] = [
    navbar,
    {
      component_type: "contact",
      variant: v.contact,
      content: {
        headline: leistungen.contact_headline,
        intro: leistungen.contact_intro,
        phone: lead.phone,
        email: lead.email,
        address,
        form_note: "Die Daten aus dem Formular verwenden wir nur, um Ihre Anfrage zu beantworten.",
      },
    },
    ...(address
      ? [
          {
            component_type: "location",
            variant: "map-text",
            content: {
              headline: "So finden Sie uns",
              address: oneLine(address),
              area_text: null,
              map_query: oneLine(address),
            },
          } satisfies Section,
        ]
      : []),
    footer,
  ];

  const seoFor = (slug: string, fallbackTitle: string) => {
    const generated = input.seo?.pages.find((p) => p.slug === slug);
    return {
      title: generated?.title ?? `${fallbackTitle} — ${lead.company_name}`.slice(0, 90),
      meta_description: generated?.meta_description,
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

  return [
    { slug: "/", page_type: "home", title: "Startseite", sections: homeSections, seo: { ...seoFor("/", "Startseite"), schema: businessSchema } },
    { slug: "/leistungen", page_type: "leistungen", title: "Leistungen", sections: leistungenSections, seo: seoFor("/leistungen", "Leistungen") },
    { slug: "/kontakt", page_type: "kontakt", title: "Kontakt", sections: kontaktSections, seo: seoFor("/kontakt", "Kontakt") },
    { slug: "/impressum", page_type: "impressum", title: "Impressum", sections: [navbar, impressumSection(legalFacts), footer], seo: legalSeo("Impressum") },
    { slug: "/datenschutz", page_type: "datenschutz", title: "Datenschutz", sections: [navbar, datenschutzSection(legalFacts), footer], seo: legalSeo("Datenschutz") },
  ];
}
