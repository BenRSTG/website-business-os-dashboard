"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { refreshLeadViews } from "@/lib/leads/events";
import { generatePassword } from "./password";
import { revalidateSites } from "./revalidate";

export type AccessResult = { error: string | null; password?: string; warning?: string };

const STALE_HINT = "Die Änderung wurde gespeichert, der site-engine konnte aber nicht benachrichtigt werden. Sie wirkt spätestens nach einigen Minuten.";
const DAY_MS = 24 * 60 * 60 * 1000;
const idSchema = z.uuid();

async function loadSite(siteId: string) {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(siteId).success) return { supabase, site: null };
  const { data } = await supabase
    .from("sites")
    .select("id, preview_slug, status, preview_expires_at")
    .eq("id", siteId)
    .maybeSingle();
  // Zugang gibt es nur für Vorschauen mit Adresse; veröffentlichte Sites haben keinen Passwortschutz.
  return { supabase, site: data && data.status === "PREVIEW" && data.preview_slug ? data : null };
}

async function finish(slug: string, extra: Partial<AccessResult> = {}): Promise<AccessResult> {
  refreshLeadViews();
  const ok = await revalidateSites([slug]);
  return { error: null, ...extra, ...(ok ? {} : { warning: STALE_HINT }) };
}

/** Erzeugt ein neues Passwort. Es wird nur dieses eine Mal zurückgegeben und nirgends im Klartext gespeichert. */
export async function renewDemoPassword(siteId: string): Promise<AccessResult> {
  const { supabase, site } = await loadSite(siteId);
  if (!site) return { error: "Vorschau nicht gefunden." };
  const password = generatePassword();
  const { error } = await supabase.rpc("set_preview_password", { p_site: site.id, p_password: password });
  if (error) return { error: "Das Passwort konnte nicht gesetzt werden." };
  return finish(site.preview_slug!, { password });
}

export async function removeDemoPassword(siteId: string): Promise<AccessResult> {
  const { supabase, site } = await loadSite(siteId);
  if (!site) return { error: "Vorschau nicht gefunden." };
  const { error } = await supabase.rpc("clear_preview_password", { p_site: site.id });
  if (error) return { error: "Das Passwort konnte nicht entfernt werden." };
  return finish(site.preview_slug!);
}

/** Verlängert die Laufzeit: ab dem späteren von „jetzt" und bisherigem Ablauf, damit eine abgelaufene Vorschau wieder lebt. */
export async function extendDemoAccess(siteId: string, days: number): Promise<AccessResult> {
  if (![7, 14, 30].includes(days)) return { error: "Ungültige Laufzeit." };
  const { supabase, site } = await loadSite(siteId);
  if (!site) return { error: "Vorschau nicht gefunden." };
  const current = site.preview_expires_at ? Date.parse(site.preview_expires_at) : 0;
  const until = new Date(Math.max(Date.now(), current) + days * DAY_MS).toISOString();
  const { error } = await supabase.from("sites").update({ preview_expires_at: until }).eq("id", site.id);
  if (error) return { error: "Die Laufzeit konnte nicht geändert werden." };
  return finish(site.preview_slug!);
}

/** Sperrt den Link sofort: Ablaufdatum auf jetzt. Mit „Verlängern" ist er wieder erreichbar. */
export async function lockDemo(siteId: string): Promise<AccessResult> {
  const { supabase, site } = await loadSite(siteId);
  if (!site) return { error: "Vorschau nicht gefunden." };
  const { error } = await supabase.from("sites").update({ preview_expires_at: new Date().toISOString() }).eq("id", site.id);
  if (error) return { error: "Der Link konnte nicht gesperrt werden." };
  return finish(site.preview_slug!);
}
