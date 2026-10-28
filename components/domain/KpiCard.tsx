import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  size = "default",
}: {
  label: string;
  value: string;
  size?: "default" | "small";
}) {
  return (
    <Card className="gap-1.5 px-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-mono font-semibold tabular-nums",
          size === "small" ? "text-lg" : "text-2xl",
        )}
      >
        {value}
      </p>
    </Card>
  );
}
