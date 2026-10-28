"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, type Supabase } from "@/lib/auth";
import { logLeadEvent, refreshLeadViews } from "./events";
import { berlinDateStringAt, berlinDayAt } from "@/lib/datetime";
import type { LeadStatus } from "./constants";
import {
  callLogSchema,
  followUpSchema,
  leadFormSchema,
  leadIdSchema,
  leadStatusSchema,
} from "./schemas";

export type ActionState = {
  error: string | null;
  fieldErrors?: Record<string, string[] | undefined>;
  ok?: boolean;
};

const initialError = (message: string): ActionState => ({ error: message });

// "Nächster Kontakt" am Lead ist immer der früheste offene Termin — wird nach jeder Änderung neu abgeleitet.
async function syncNextContact(supabase: Supabase, leadId: string | null) {
  if (!leadId) return;
  const { data } = await supabase
    .from("tasks")
    .select("due_at")
    .eq("lead_id", leadId)
    .eq("status", "OPEN")
    .not("due_at", "is", null)
    .order("due_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  await supabase
    .from("leads")
    .update({ next_contact_at: data?.due_at ?? null })
    .eq("id", leadId);
}

function formToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createLead(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, userId } = await requireUser();
  const parsed = leadFormSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      error: "Bitte die markierten Felder prüfen.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { data, error } = await supabase
    .from("leads")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return initialError("Der Lead konnte nicht gespeichert werden.");

  await logLeadEvent(supabase, userId, "lead.created", data.id, {
    company_name: parsed.data.company_name,
  });
  refreshLeadViews();
  redirect(`/leads/${data.id}`);
}

export async function updateLead(
  leadId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  if (!leadIdSchema.safeParse(leadId).success) return initialError("Ungültiger Lead.");

  const parsed = leadFormSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      error: "Bitte die markierten Felder prüfen.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { error } = await supabase.from("leads").update(parsed.data).eq("id", leadId);
  if (error) return initialError("Die Änderungen konnten nicht gespeichert werden.");

  refreshLeadViews();
  redirect(`/leads/${leadId}`);
}

export async function changeLeadStatus(leadId: string, status: LeadStatus) {
  const { supabase, userId } = await requireUser();
  const parsedStatus = leadStatusSchema.safeParse(status);
  if (!leadIdSchema.safeParse(leadId).success || !parsedStatus.success) return;

  const { data: current } = await supabase
    .from("leads")
    .select("status, company_name, reactivation_count")
    .eq("id", leadId)
    .maybeSingle();
  if (!current || current.status === parsedStatus.data) return;

  // Wechsel aus LOST in einen aktiven Status zählt als Reaktivierung (docs/04-kern-user-flows.md).
  const reactivation =
    current.status === "LOST" && parsedStatus.data !== "LOST"
      ? {
          reactivated_at: new Date().toISOString(),
          reactivation_count: current.reactivation_count + 1,
        }
      : {};

  const { error } = await supabase
    .from("leads")
    .update({ status: parsedStatus.data, ...reactivation })
    .eq("id", leadId);
  if (error) return;

  await logLeadEvent(supabase, userId, "lead.status_changed", leadId, {
    company_name: current.company_name,
    from: current.status,
    to: parsedStatus.data,
    reactivated: Object.keys(reactivation).length > 0,
  });
  refreshLeadViews();
}

export async function logCall(
  leadId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  if (!leadIdSchema.safeParse(leadId).success) return initialError("Ungültiger Lead.");

  const parsed = callLogSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      error: "Bitte ein Ergebnis wählen.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { error } = await supabase.from("tasks").insert({
    lead_id: leadId,
    contact_type: "CALL",
    status: "DONE",
    result: parsed.data.result,
    note: parsed.data.note,
    completed_at: new Date().toISOString(),
  });
  if (error) return initialError("Der Anruf konnte nicht protokolliert werden.");

  refreshLeadViews();
  return { error: null, ok: true };
}

export async function scheduleFollowUp(
  leadId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  if (!leadIdSchema.safeParse(leadId).success) return initialError("Ungültiger Lead.");

  const parsed = followUpSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      error: "Bitte die Angaben prüfen.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { preset, custom_date, contact_type, note } = parsed.data;
  const dueAt =
    preset === "custom" && custom_date
      ? berlinDateStringAt(custom_date, 9)
      : berlinDayAt(preset === "tomorrow" ? 1 : preset === "in3days" ? 3 : 7, 9);

  const { error } = await supabase.from("tasks").insert({
    lead_id: leadId,
    contact_type,
    status: "OPEN",
    due_at: dueAt.toISOString(),
    note,
  });
  if (error) return initialError("Das Follow-up konnte nicht gespeichert werden.");

  await syncNextContact(supabase, leadId);
  refreshLeadViews();
  return { error: null, ok: true };
}

export async function completeTask(taskId: string) {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(taskId).success) return;

  const { data } = await supabase
    .from("tasks")
    .update({ status: "DONE", completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .select("lead_id")
    .maybeSingle();
  await syncNextContact(supabase, data?.lead_id ?? null);
  refreshLeadViews();
}

export async function postponeTask(taskId: string) {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(taskId).success) return;

  const { data } = await supabase
    .from("tasks")
    .update({ due_at: berlinDayAt(1, 9).toISOString() })
    .eq("id", taskId)
    .select("lead_id")
    .maybeSingle();
  await syncNextContact(supabase, data?.lead_id ?? null);
  refreshLeadViews();
}
