// KOPIE aus site-engine/lib/content/schemas.ts — bei Änderungen beide Dateien angleichen (Abgleich über tests/website/schema-drift.test.ts).
import { z } from "zod";
import { isSafeHref } from "./links";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullish());
const href = z.string().refine(isSafeHref, "Ungültiger Link");
const link = z.object({ label: text(60), href });

export const IMAGE_SOURCES = ["customer", "stock", "licensed", "ai_generated", "placeholder"] as const;

// Bildherkunft ist je Bild dokumentiert (docs/10-sicherheitskonzept.md §B3). Ein Platzhalter hat keine Quelle,
// jedes echte Bild braucht eine https-Adresse.
export const imageSchema = z
  .object({
    slot_id: text(60),
    alt: z.string().trim().max(200),
    source: z.enum(IMAGE_SOURCES),
    src: z.string().url().startsWith("https://").max(1000).nullish(),
    credit: optionalText(200),
  })
  .refine((img) => (img.source === "placeholder" ? !img.src : Boolean(img.src)), {
    message: "Platzhalter haben keine Bildadresse, echte Bilder brauchen eine",
    path: ["src"],
  });
export type ImageRef = z.infer<typeof imageSchema>;

const sectionBase = { id: z.string().regex(/^[a-z][a-z0-9-]{0,40}$/).optional() };

const navbar = z.object({
  ...sectionBase,
  component_type: z.literal("navbar"),
  variant: z.enum(["standard", "centered"]),
  content: z.object({
    logo_text: text(60),
    links: z.array(link).max(8),
    cta_label: optionalText(40),
    cta_href: href.nullish(),
  }),
});

const hero = z.object({
  ...sectionBase,
  component_type: z.literal("hero"),
  variant: z.enum(["split", "centered", "image-full"]),
  content: z.object({
    eyebrow: optionalText(80),
    headline: text(120),
    subheadline: optionalText(300),
    cta_label: text(40),
    cta_href: href,
    secondary_label: optionalText(40),
    secondary_href: href.nullish(),
    image: imageSchema.nullish(),
    points: z.array(text(60)).max(4).optional(),
  }),
});

const services = z.object({
  ...sectionBase,
  component_type: z.literal("services"),
  variant: z.enum(["grid-cards", "list-alternating"]),
  content: z.object({
    headline: text(100),
    intro: optionalText(300),
    items: z.array(z.object({ title: text(80), description: text(300) })).min(1).max(8),
  }),
});

const about = z.object({
  ...sectionBase,
  component_type: z.literal("about"),
  variant: z.enum(["text-image", "stats-highlight"]),
  content: z.object({
    headline: text(100),
    paragraphs: z.array(text(900)).min(1).max(4),
    image: imageSchema.nullish(),
    stats: z.array(z.object({ value: text(20), label: text(40) })).max(4).optional(),
  }),
});

const testimonials = z.object({
  ...sectionBase,
  component_type: z.literal("testimonials"),
  variant: z.enum(["cards-grid", "slider"]),
  content: z.object({
    headline: text(100),
    items: z
      .array(z.object({ name: text(60), quote: text(400), rating: z.number().int().min(1).max(5).nullish() }))
      .min(1)
      .max(9),
  }),
});

const faq = z.object({
  ...sectionBase,
  component_type: z.literal("faq"),
  variant: z.enum(["accordion"]),
  content: z.object({
    headline: text(100),
    items: z.array(z.object({ question: text(160), answer: text(700) })).min(1).max(10),
  }),
});

const contact = z.object({
  ...sectionBase,
  component_type: z.literal("contact"),
  variant: z.enum(["form-info-side", "form-centered"]),
  content: z.object({
    headline: text(100),
    intro: optionalText(300),
    phone: optionalText(40),
    email: z.preprocess((v) => (v === "" ? null : v), z.email().max(120).nullish()),
    address: optionalText(200),
    opening_hours: z.array(z.object({ days: text(40), hours: text(40) })).max(8).optional(),
    form_note: optionalText(300),
  }),
});

const location = z.object({
  ...sectionBase,
  component_type: z.literal("location"),
  variant: z.enum(["map-text"]),
  content: z.object({
    headline: text(100),
    address: text(200),
    area_text: optionalText(400),
    map_query: text(200),
  }),
});

const footer = z.object({
  ...sectionBase,
  component_type: z.literal("footer"),
  variant: z.enum(["standard"]),
  content: z.object({
    company_name: text(100),
    tagline: optionalText(160),
    address: optionalText(200),
    phone: optionalText(40),
    email: z.preprocess((v) => (v === "" ? null : v), z.email().max(120).nullish()),
    links: z.array(link).max(8),
    legal_links: z.array(link).max(4),
    social: z.array(link).max(5).optional(),
  }),
});

// Rechtstexte werden vom System aus einer festen Vorlage befüllt, nie von der KI (docs/10-sicherheitskonzept.md §B1).
const legal = z.object({
  ...sectionBase,
  component_type: z.literal("legal"),
  variant: z.enum(["standard"]),
  content: z.object({
    kind: z.enum(["impressum", "datenschutz"]),
    title: text(80),
    notice: optionalText(300),
    fields: z.array(z.object({ label: text(60), value: optionalText(300) })).max(20),
    sections: z.array(z.object({ heading: text(100), placeholder: text(500) })).max(12).optional(),
  }),
});

// Feature-Bausteine (Etappe 4C). Angaben, die nicht bekannt sind (Preise, Zeiten, Namen), stehen als "[… ergänzen]" im Text:
// die Qualitätsprüfung im Dashboard listet sie, die Veröffentlichung bleibt gesperrt, solange welche übrig sind.
const hours = z.object({
  ...sectionBase,
  component_type: z.literal("hours"),
  variant: z.enum(["standard"]),
  content: z.object({
    headline: text(100),
    intro: optionalText(300),
    hours: z.array(z.object({ days: text(40), hours: text(60) })).max(8),
    area_headline: optionalText(80),
    area_text: optionalText(400),
  }),
});

const gallery = z.object({
  ...sectionBase,
  component_type: z.literal("gallery"),
  variant: z.enum(["grid"]),
  content: z.object({
    headline: text(100),
    intro: optionalText(300),
    items: z.array(z.object({ image: imageSchema, caption: text(120) })).min(3).max(9),
  }),
});

const pricing = z.object({
  ...sectionBase,
  component_type: z.literal("pricing"),
  variant: z.enum(["cards"]),
  content: z.object({
    headline: text(100),
    intro: optionalText(300),
    note: optionalText(300),
    items: z
      .array(
        z.object({
          title: text(80),
          price: text(40),
          description: text(300),
          features: z.array(text(80)).max(5).optional(),
        }),
      )
      .min(1)
      .max(4),
  }),
});

const team = z.object({
  ...sectionBase,
  component_type: z.literal("team"),
  variant: z.enum(["cards"]),
  content: z.object({
    headline: text(100),
    intro: optionalText(300),
    members: z.array(z.object({ name: text(60), role: text(80), image: imageSchema.nullish() })).min(1).max(6),
  }),
});

const booking = z.object({
  ...sectionBase,
  component_type: z.literal("booking"),
  variant: z.enum(["request-form"]),
  content: z.object({
    headline: text(100),
    intro: optionalText(300),
    note: optionalText(300),
  }),
});

export const sectionSchema = z.discriminatedUnion("component_type", [
  navbar,
  hero,
  services,
  about,
  testimonials,
  faq,
  contact,
  location,
  footer,
  legal,
  hours,
  gallery,
  pricing,
  team,
  booking,
]);
export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section["component_type"];
export type SectionOf<T extends SectionType> = Extract<Section, { component_type: T }>;

export type ParsedSection = { ok: true; section: Section } | { ok: false; error: string; raw: unknown };

/** Validiert jeden Abschnitt einzeln: ein kaputter Abschnitt darf die übrige Seite nicht mitreißen. */
export function parseSections(raw: unknown): ParsedSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry): ParsedSection => {
    const parsed = sectionSchema.safeParse(entry);
    if (parsed.success) return { ok: true, section: parsed.data };
    const first = parsed.error.issues[0];
    return { ok: false, error: `${first.path.join(".") || "Abschnitt"}: ${first.message}`, raw: entry };
  });
}

export const seoSchema = z.object({
  title: z.string().trim().min(1).max(90).nullish(),
  meta_description: z.string().trim().max(220).nullish(),
  schema: z.record(z.string(), z.unknown()).nullish(),
});
export type SeoData = z.infer<typeof seoSchema>;

/** JSON-LD für ein <script>-Tag: "<" wird entschärft, damit der Inhalt das Tag nicht beenden kann. */
const LINE_SEPARATORS = new RegExp("[\\u2028\\u2029]", "g");

export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(LINE_SEPARATORS, "");
}
