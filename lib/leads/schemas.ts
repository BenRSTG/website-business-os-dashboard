import { z } from "zod";
import {
  LEAD_INDUSTRY_VALUES,
  LEAD_SOURCE_VALUES,
  LEAD_STATUS_VALUES,
  TASK_CONTACT_TYPE_VALUES,
  TASK_RESULT_VALUES,
} from "./constants";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable());

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? null : Number(v)),
    schema.nullable(),
  );

export const leadFormSchema = z.object({
  company_name: z.string().trim().min(1, "Bitte Firmenname angeben").max(200),
  industry: z.enum(LEAD_INDUSTRY_VALUES, "Bitte Branche wählen"),
  source: z.enum(LEAD_SOURCE_VALUES, "Bitte Quelle wählen"),
  contact_name: optionalText(200),
  phone: optionalText(50),
  email: z.preprocess(emptyToNull, z.email("Ungültige E-Mail-Adresse").nullable()),
  address_street: optionalText(200),
  address_zip: optionalText(10),
  address_city: optionalText(100),
  existing_website_url: z.preprocess(
    emptyToNull,
    z.url("Bitte vollständige Adresse mit https:// angeben").nullable(),
  ),
  google_profile_url: z.preprocess(
    emptyToNull,
    z.url("Bitte vollständige Adresse mit https:// angeben").nullable(),
  ),
  google_rating: optionalNumber(z.number().min(0).max(5, "Bewertung liegt zwischen 0 und 5")),
  google_rating_count: optionalNumber(z.number().int().min(0)),
  notes: optionalText(5000),
});
export type LeadFormValues = z.infer<typeof leadFormSchema>;

export const leadIdSchema = z.uuid();
export const leadStatusSchema = z.enum(LEAD_STATUS_VALUES);

export const callLogSchema = z.object({
  result: z.enum(TASK_RESULT_VALUES, "Bitte Ergebnis wählen"),
  note: optionalText(2000),
});

export const followUpSchema = z
  .object({
    preset: z.enum(["tomorrow", "in3days", "in1week", "custom"]),
    custom_date: z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
    contact_type: z.enum(TASK_CONTACT_TYPE_VALUES),
    note: optionalText(2000),
  })
  .refine((v) => v.preset !== "custom" || v.custom_date !== null, {
    message: "Bitte ein Datum wählen",
    path: ["custom_date"],
  });

export const leadFiltersSchema = z.object({
  status: leadStatusSchema.optional().catch(undefined),
  industry: z.enum(LEAD_INDUSTRY_VALUES).optional().catch(undefined),
  city: z.string().trim().max(100).optional().catch(undefined),
});
