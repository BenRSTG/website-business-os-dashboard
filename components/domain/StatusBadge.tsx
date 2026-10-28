import { cn } from "@/lib/utils";
import {
  LEAD_STATUS_LABELS,
  STATUS_BADGE_CLASSES,
  type LeadStatus,
} from "@/lib/leads/constants";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_BADGE_CLASSES[status],
      )}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}
