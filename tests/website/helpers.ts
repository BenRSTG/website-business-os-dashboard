import type { CompanyProfileRow } from "@/lib/intelligence/types";
import type { Lead } from "@/lib/leads/types";
import type { HomeCopy, LeistungenCopy, Plan, SeoOutput } from "@/lib/website/prompts";

export const lead: Lead = {
  id: "11111111-1111-4111-8111-111111111111",
  organization_id: "22222222-2222-4222-8222-222222222222",
  company_name: "Elektro Weber",
  industry: "elektro",
  contact_name: "Herr Weber",
  phone: "07821 555 0101",
  email: "info@elektro-weber.example.com",
  address_street: "Hauptstraße 12",
  address_zip: "77933",
  address_city: "Lahr",
  existing_website_url: null,
  google_profile_url: null,
  google_rating: 4.6,
  google_rating_count: 87,
  status: "DEMO_CREATED",
  source: "google_ads",
  next_contact_at: null,
  notes: null,
  reactivated_at: null,
  reactivation_count: 0,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
} as Lead;

export const profile: CompanyProfileRow = {
  id: "33333333-3333-4333-8333-333333333333",
  lead_id: lead.id,
  facts: [
    { claim: "Elektro Weber ist ein Elektrobetrieb in Lahr", category: "services", status: "verified", source: "lead_record", confidence: "high" },
    { claim: "Bietet Notdienst an", category: "usp", status: "placeholder", source: "inference", confidence: "low" },
  ],
  recommended_services: ["Elektroinstallation", "Störungsbehebung", "Smart Home"],
  recommended_page_structure: [],
  recommended_ctas: ["Jetzt anrufen"],
  used_website_text: false,
  model_used: "test",
  cost_estimate_eur: 0.02,
  generated_at: "2026-10-01T00:00:00Z",
};

export const plan: Plan = { style: "traditional", palette_id: "traditional-02", hero_variant: "centered", reason: "Bodenständiger Familienbetrieb" };

export const home: HomeCopy = {
  eyebrow: "Elektrobetrieb in Lahr",
  headline: "Strom, auf den Sie sich verlassen können",
  subheadline: "Installation und Reparatur für Haus und Betrieb in Lahr.",
  points: ["Persönliche Beratung", "Saubere Arbeit"],
  services_headline: "Unsere Leistungen",
  services_intro: "Von der Steckdose bis zur Verteilung.",
  services_items: [
    { title: "Elektroinstallation", description: "Neubau, Umbau und Erweiterung der Elektroinstallation." },
    { title: "Störungsbehebung", description: "Wir suchen die Ursache, wenn der Strom ausfällt." },
    { title: "Smart Home", description: "Licht und Heizung bequem steuern." },
  ],
  about_headline: "Über uns",
  about_paragraphs: ["Elektro Weber ist ein Elektrobetrieb in Lahr."],
  faq_headline: "Häufige Fragen",
  faq_items: [
    { question: "Wie läuft ein Auftrag ab?", answer: "Sie melden sich, wir besprechen den Bedarf und vereinbaren einen Termin." },
    { question: "Wie erreiche ich Sie?", answer: "Über die Kontaktseite oder telefonisch." },
  ],
};

export const leistungen: LeistungenCopy = {
  headline: "Leistungen im Überblick",
  intro: "Das erledigen wir für Sie.",
  items: [
    { title: "Elektroinstallation", description: "Steckdosen, Beleuchtung und Verteiler." },
    { title: "Störungsbehebung", description: "Fehlersuche und Reparatur." },
    { title: "Smart Home", description: "Nachrüstung und Steuerung." },
  ],
  contact_headline: "Sprechen Sie uns an",
  contact_intro: "Wir melden uns zeitnah bei Ihnen.",
};

export const seo: SeoOutput = {
  pages: [
    { slug: "/", title: "Elektro Weber — Elektrobetrieb in Lahr", meta_description: "Installation und Reparatur in Lahr." },
    { slug: "/leistungen", title: "Leistungen — Elektro Weber", meta_description: "Unsere Leistungen im Überblick." },
    { slug: "/kontakt", title: "Kontakt — Elektro Weber", meta_description: "So erreichen Sie Elektro Weber in Lahr." },
  ],
};
