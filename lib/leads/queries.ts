import "server-only";
import { createClient } from "@/lib/supabase/server";
import { startOfMonthBerlin, startOfTomorrowBerlin } from "@/lib/datetime";
import type { LeadIndustry, LeadStatus } from "./constants";
import { leadFiltersSchema, leadIdSchema } from "./schemas";
import type { ActivityEntry, Lead, Task, TaskWithLead } from "./types";

export interface LeadFilters {
  status?: LeadStatus;
  industry?: LeadIndustry;
  city?: string;
}

export function parseLeadFilters(raw: Record<string, string | string[] | undefined>): LeadFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const parsed = leadFiltersSchema.parse({
    status: first(raw.status),
    industry: first(raw.industry),
    city: first(raw.city),
  });
  return { ...parsed, city: parsed.city || undefined };
}

// % und _ sind in LIKE-Mustern Platzhalter — Nutzereingaben müssen wörtlich gelten.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

function fail(what: string, message: string): never {
  throw new Error(`${what}: ${message}`);
}

export async function listLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.industry) query = query.eq("industry", filters.industry);
  if (filters.city) query = query.ilike("address_city", `%${escapeLike(filters.city)}%`);

  const { data, error } = await query;
  if (error) fail("Leads konnten nicht geladen werden", error.message);
  return data as Lead[];
}

export async function getLead(id: string): Promise<Lead | null> {
  if (!leadIdSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("Lead konnte nicht geladen werden", error.message);
  return data as Lead | null;
}

export async function getLeadTasks(leadId: string): Promise<Task[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) fail("Aufgaben konnten nicht geladen werden", error.message);
  return data as Task[];
}

export async function getDueTasks(): Promise<TaskWithLead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*, lead:leads(id, company_name)")
    .eq("status", "OPEN")
    .lt("due_at", startOfTomorrowBerlin().toISOString())
    .order("due_at", { ascending: true });
  if (error) fail("Fällige Aufgaben konnten nicht geladen werden", error.message);
  return data as TaskWithLead[];
}

export async function getRecentActivity(limit = 8): Promise<ActivityEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, action_type, entity_id, input, created_at")
    .like("action_type", "lead.%")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Aktivität konnte nicht geladen werden", error.message);
  return data as ActivityEntry[];
}

export interface DashboardStats {
  newLeads7d: number;
  lostThisMonth: number;
  countsByStatus: Record<string, number>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("status, created_at, updated_at");
  if (error) fail("Kennzahlen konnten nicht geladen werden", error.message);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const monthStart = startOfMonthBerlin().getTime();
  const stats: DashboardStats = { newLeads7d: 0, lostThisMonth: 0, countsByStatus: {} };

  for (const row of data as Pick<Lead, "status" | "created_at" | "updated_at">[]) {
    stats.countsByStatus[row.status] = (stats.countsByStatus[row.status] ?? 0) + 1;
    if (new Date(row.created_at).getTime() >= weekAgo) stats.newLeads7d += 1;
    // Näherung: ein verlorener Lead zählt in dem Monat, in dem er zuletzt geändert wurde.
    if (row.status === "LOST" && new Date(row.updated_at).getTime() >= monthStart) {
      stats.lostThisMonth += 1;
    }
  }
  return stats;
}
