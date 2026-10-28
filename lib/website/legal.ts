import type { Section } from "./content/schemas";

// Rechtstexte kommen aus einer festen Vorlage, nie von der KI (docs/10-sicherheitskonzept.md §B1).
// Alles, was nicht aus den Stammdaten kommt, bleibt leer und erscheint im Entwurf als "[bitte ergänzen]".
export interface LegalFacts {
  companyName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

const NOTICE =
  "Entwurf: Dieser Text ist eine Vorlage und wurde nicht rechtlich geprüft. Er muss vor der Veröffentlichung vervollständigt und bestätigt werden.";

export function impressumSection(f: LegalFacts): Section {
  return {
    component_type: "legal",
    variant: "standard",
    content: {
      kind: "impressum",
      title: "Impressum",
      notice: NOTICE,
      fields: [
        { label: "Anbieter", value: f.companyName },
        { label: "Anschrift", value: f.address },
        { label: "Vertretungsberechtigte Person", value: null },
        { label: "Telefon", value: f.phone },
        { label: "E-Mail", value: f.email },
        { label: "Berufsbezeichnung und Kammer", value: null },
        { label: "Umsatzsteuer-ID", value: null },
      ],
    },
  };
}

export function datenschutzSection(f: LegalFacts, options: { map: boolean; booking: boolean } = { map: true, booking: false }): Section {
  return {
    component_type: "legal",
    variant: "standard",
    content: {
      kind: "datenschutz",
      title: "Datenschutzerklärung",
      notice: NOTICE,
      fields: [
        { label: "Verantwortlicher", value: [f.companyName, f.address].filter(Boolean).join("\n") },
        { label: "Kontakt", value: [f.phone, f.email].filter(Boolean).join("\n") || null },
      ],
      sections: [
        { heading: "Hosting", placeholder: "[Angaben zum Hosting-Anbieter und zu Server-Logdateien ergänzen]" },
        { heading: "Kontaktaufnahme", placeholder: "[Angaben zur Verarbeitung von Anfragen per Telefon, E-Mail und Formular ergänzen]" },
        ...(options.map ? [{ heading: "Karten und externe Inhalte", placeholder: "[Angaben zu Google Maps und der Einwilligung ergänzen]" }] : []),
        ...(options.booking ? [{ heading: "Terminanfragen", placeholder: "[Angaben zur Verarbeitung von Terminanfragen (Name, Kontaktdaten, Wunschtermin) ergänzen]" }] : []),
        { heading: "Ihre Rechte", placeholder: "[Standardtext zu Auskunft, Berichtigung, Löschung und Beschwerde ergänzen]" },
      ],
    },
  };
}
