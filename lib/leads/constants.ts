export const LEAD_STATUS_VALUES = [
  "NEW",
  "QUALIFIED",
  "DEMO_CREATED",
  "CONTACTED",
  "INTERESTED",
  "MEETING",
  "PROPOSAL",
  "WON",
  "LOST",
] as const;
export type LeadStatus = (typeof LEAD_STATUS_VALUES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Neu",
  QUALIFIED: "Qualifiziert",
  DEMO_CREATED: "Demo erstellt",
  CONTACTED: "Kontaktiert",
  INTERESTED: "Interessiert",
  MEETING: "Termin",
  PROPOSAL: "Angebot",
  WON: "Gewonnen",
  LOST: "Verloren",
};

export const LEAD_INDUSTRY_VALUES = [
  "maler",
  "elektro",
  "shk",
  "dachdecker",
  "garten_landschaft",
  "sonstiges",
] as const;
export type LeadIndustry = (typeof LEAD_INDUSTRY_VALUES)[number];

export const LEAD_INDUSTRY_LABELS: Record<LeadIndustry, string> = {
  maler: "Maler",
  elektro: "Elektro",
  shk: "Heizung/Sanitär",
  dachdecker: "Dachdecker",
  garten_landschaft: "Garten-/Landschaftsbau",
  sonstiges: "Sonstiges",
};

export const LEAD_SOURCE_VALUES = [
  "manual",
  "google_ads",
  "referral",
  "cold_call",
  "other",
] as const;
export type LeadSource = (typeof LEAD_SOURCE_VALUES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  manual: "Manuell erfasst",
  google_ads: "Google Ads",
  referral: "Empfehlung",
  cold_call: "Telefonakquise",
  other: "Sonstiges",
};

export const TASK_CONTACT_TYPE_VALUES = ["CALL", "EMAIL", "DEMO", "OTHER"] as const;
export type TaskContactType = (typeof TASK_CONTACT_TYPE_VALUES)[number];

export const TASK_CONTACT_TYPE_LABELS: Record<TaskContactType, string> = {
  CALL: "Anruf",
  EMAIL: "E-Mail",
  DEMO: "Demo",
  OTHER: "Sonstiges",
};

export const TASK_RESULT_VALUES = [
  "REACHED",
  "NOT_REACHED",
  "CALLBACK_SCHEDULED",
  "NOT_INTERESTED",
] as const;
export type TaskResult = (typeof TASK_RESULT_VALUES)[number];

export const TASK_RESULT_LABELS: Record<TaskResult, string> = {
  REACHED: "Erreicht",
  NOT_REACHED: "Nicht erreicht",
  CALLBACK_SCHEDULED: "Rückruf vereinbart",
  NOT_INTERESTED: "Kein Interesse",
};

// Regelbasierte Vorbefüllung der "nächsten Aktion" (docs/04-kern-user-flows.md), keine KI.
export function nextActionFor(status: LeadStatus): string | null {
  switch (status) {
    case "NEW":
      return "Anrufen";
    case "QUALIFIED":
      return "Website analysieren";
    case "DEMO_CREATED":
      return "Demo senden";
    case "CONTACTED":
      return "Follow-up planen";
    case "INTERESTED":
      return "Termin vereinbaren";
    case "MEETING":
      return "Gespräch vorbereiten";
    case "PROPOSAL":
      return "Nachfassen";
    case "WON":
      return "Onboarding starten";
    case "LOST":
      return null;
  }
}

export const STATUS_BADGE_CLASSES: Record<LeadStatus, string> = {
  NEW: "bg-muted text-muted-foreground",
  QUALIFIED: "bg-accent text-accent-foreground",
  DEMO_CREATED: "bg-accent text-accent-foreground",
  CONTACTED: "bg-warning-soft text-warning",
  INTERESTED: "bg-warning-soft text-warning",
  MEETING: "bg-warning-soft text-warning",
  PROPOSAL: "bg-warning-soft text-warning",
  WON: "bg-success-soft text-success",
  LOST: "bg-destructive-soft text-destructive",
};
