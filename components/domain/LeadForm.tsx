"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAD_INDUSTRY_LABELS,
  LEAD_INDUSTRY_VALUES,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_VALUES,
} from "@/lib/leads/constants";
import type { ActionState } from "@/lib/leads/actions";
import type { Lead } from "@/lib/leads/types";

const initialState: ActionState = { error: null };

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string;
  name: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {errors?.length ? (
        <p id={`${name}-error`} className="text-xs text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

export function LeadForm({
  action,
  lead,
  submitLabel,
  cancelHref,
}: {
  action: Action;
  lead?: Lead;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state.fieldErrors ?? {};
  const invalid = (name: string) => (errors[name]?.length ? true : undefined);

  const text = (name: keyof Lead, label: string, extra?: React.ComponentProps<"input">) => (
    <Field label={label} name={name} errors={errors[name]}>
      <Input
        id={name}
        name={name}
        defaultValue={(lead?.[name] as string | number | null | undefined) ?? ""}
        aria-invalid={invalid(name)}
        aria-describedby={invalid(name) ? `${name}-error` : undefined}
        {...extra}
      />
    </Field>
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Card className="gap-4 px-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Unternehmen
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("company_name", "Firmenname *", { required: true, autoFocus: !lead })}
          <Field label="Branche *" name="industry" errors={errors.industry}>
            <NativeSelect id="industry" name="industry" defaultValue={lead?.industry ?? "sonstiges"}>
              {LEAD_INDUSTRY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {LEAD_INDUSTRY_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {text("contact_name", "Ansprechpartner")}
          <Field label="Quelle" name="source" errors={errors.source}>
            <NativeSelect id="source" name="source" defaultValue={lead?.source ?? "manual"}>
              {LEAD_SOURCE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {LEAD_SOURCE_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </Card>

      <Card className="gap-4 px-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Kontakt und Adresse
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("phone", "Telefon", { type: "tel", autoComplete: "off" })}
          {text("email", "E-Mail", { type: "email", autoComplete: "off" })}
          {text("address_street", "Straße und Hausnummer")}
          <div className="grid grid-cols-[6rem_1fr] gap-4">
            {text("address_zip", "PLZ")}
            {text("address_city", "Ort")}
          </div>
        </div>
      </Card>

      <Card className="gap-4 px-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Online-Präsenz
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("existing_website_url", "Bestehende Website", {
            type: "url",
            placeholder: "https://",
          })}
          {text("google_profile_url", "Google-Profil", { type: "url", placeholder: "https://" })}
          {text("google_rating", "Google-Bewertung (0–5)", {
            type: "number",
            step: "0.1",
            min: 0,
            max: 5,
          })}
          {text("google_rating_count", "Anzahl Bewertungen", { type: "number", min: 0, step: 1 })}
        </div>
      </Card>

      <Card className="gap-4 px-4">
        <Field label="Notizen" name="notes" errors={errors.notes}>
          <Textarea id="notes" name="notes" defaultValue={lead?.notes ?? ""} rows={4} />
        </Field>
      </Card>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Wird gespeichert …" : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
