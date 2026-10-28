"use client";

import { useTransition } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
  type LeadStatus,
} from "@/lib/leads/constants";
import { changeLeadStatus } from "@/lib/leads/actions";

export function StatusSelect({
  leadId,
  status,
  className,
}: {
  leadId: string;
  status: LeadStatus;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <NativeSelect
      aria-label="Status ändern"
      value={status}
      disabled={pending}
      className={className}
      onChange={(event) => {
        const next = event.target.value as LeadStatus;
        startTransition(() => changeLeadStatus(leadId, next));
      }}
    >
      {LEAD_STATUS_VALUES.map((value) => (
        <option key={value} value={value}>
          {LEAD_STATUS_LABELS[value]}
        </option>
      ))}
    </NativeSelect>
  );
}
