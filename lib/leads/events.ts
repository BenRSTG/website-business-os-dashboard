import "server-only";
import { revalidatePath } from "next/cache";
import type { Supabase } from "@/lib/auth";

// Lead-Ereignisse speisen den Aktivitäts-Feed. Ein Fehler hier darf die eigentliche Aktion nicht kippen.
export async function logLeadEvent(
  supabase: Supabase,
  userId: string,
  actionType: string,
  leadId: string,
  input: Record<string, unknown>,
) {
  const { error } = await supabase.from("audit_log").insert({
    actor: "USER",
    user_id: userId,
    action_type: actionType,
    entity_type: "lead",
    entity_id: leadId,
    input,
  });
  if (error) console.error("audit_log-Eintrag fehlgeschlagen:", error.message);
}

export function refreshLeadViews() {
  revalidatePath("/dashboard");
  revalidatePath("/leads", "layout");
}
