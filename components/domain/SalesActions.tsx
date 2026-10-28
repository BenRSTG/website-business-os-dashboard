"use client";

import { useActionState, useEffect, useState } from "react";
import { CalendarClock, Mail, Phone, Send } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  TASK_CONTACT_TYPE_LABELS,
  TASK_CONTACT_TYPE_VALUES,
  TASK_RESULT_LABELS,
  TASK_RESULT_VALUES,
} from "@/lib/leads/constants";
import { logCall, scheduleFollowUp, type ActionState } from "@/lib/leads/actions";

const initialState: ActionState = { error: null };

const PRESETS = [
  { value: "tomorrow", label: "Morgen" },
  { value: "in3days", label: "In 3 Tagen" },
  { value: "in1week", label: "In 1 Woche" },
  { value: "custom", label: "Eigenes Datum" },
] as const;

const actionButton = buttonVariants({ variant: "outline", className: "w-full justify-start" });

function CallLog({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(logCall.bind(null, leadId), initialState);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg bg-muted p-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Ergebnis des Anrufs
        <NativeSelect name="result" defaultValue="" required>
          <option value="" disabled>
            Bitte wählen
          </option>
          {TASK_RESULT_VALUES.map((value) => (
            <option key={value} value={value}>
              {TASK_RESULT_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </label>
      <Textarea name="note" placeholder="Notiz (optional)" rows={2} />
      {state.error ? <p role="alert" className="text-xs text-destructive">{state.error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Wird gespeichert …" : "Anruf protokollieren"}
      </Button>
    </form>
  );
}

function FollowUpForm({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    scheduleFollowUp.bind(null, leadId),
    initialState,
  );
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["value"]>("tomorrow");

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg bg-muted p-3">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">Wann?</legend>
        {PRESETS.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="preset"
              value={option.value}
              checked={preset === option.value}
              onChange={() => setPreset(option.value)}
              className="accent-primary"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {preset === "custom" ? (
        <div className="flex flex-col gap-1">
          <Input type="date" name="custom_date" aria-label="Datum" required />
          {state.fieldErrors?.custom_date ? (
            <p className="text-xs text-destructive">{state.fieldErrors.custom_date[0]}</p>
          ) : null}
        </div>
      ) : null}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Art
        <NativeSelect name="contact_type" defaultValue="CALL">
          {TASK_CONTACT_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {TASK_CONTACT_TYPE_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </label>
      <Input name="note" placeholder="Kurznotiz (optional)" />
      {state.error ? <p role="alert" className="text-xs text-destructive">{state.error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Wird gespeichert …" : "Follow-up speichern"}
      </Button>
    </form>
  );
}

export function SalesActions({
  leadId,
  companyName,
  contactName,
  phone,
  email,
}: {
  leadId: string;
  companyName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
}) {
  const [panel, setPanel] = useState<"call" | "followup" | null>(null);
  const closePanel = () => setPanel(null);

  // Ohne KI-Entwurf (kommt mit Milestone 3): schlichte Vorlage, Versand im eigenen Mailprogramm.
  const greeting = contactName ? `Guten Tag ${contactName},` : "Guten Tag,";
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(`Ihre Website – kurze Rückfrage (${companyName})`)}&body=${encodeURIComponent(`${greeting}\n\n\n\nFreundliche Grüße`)}`
    : null;

  return (
    <div className="flex flex-col gap-2">
      {phone ? (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          onClick={() => setPanel("call")}
          className={actionButton}
        >
          <Phone aria-hidden /> Anrufen
        </a>
      ) : (
        <Button variant="outline" disabled title="Keine Telefonnummer hinterlegt" className="w-full justify-start">
          <Phone aria-hidden /> Anrufen
        </Button>
      )}
      {panel === "call" ? <CallLog leadId={leadId} onDone={closePanel} /> : null}

      {mailto ? (
        <a href={mailto} className={cn(actionButton)}>
          <Mail aria-hidden /> E-Mail vorbereiten
        </a>
      ) : (
        <Button variant="outline" disabled title="Keine E-Mail-Adresse hinterlegt" className="w-full justify-start">
          <Mail aria-hidden /> E-Mail vorbereiten
        </Button>
      )}

      <Button variant="outline" disabled title="Noch keine Demo vorhanden" className="w-full justify-start">
        <Send aria-hidden /> Demo senden
      </Button>

      <Button
        variant="outline"
        className="w-full justify-start"
        aria-expanded={panel === "followup"}
        onClick={() => setPanel(panel === "followup" ? null : "followup")}
      >
        <CalendarClock aria-hidden /> Follow-up planen
      </Button>
      {panel === "followup" ? <FollowUpForm leadId={leadId} onDone={closePanel} /> : null}
    </div>
  );
}
