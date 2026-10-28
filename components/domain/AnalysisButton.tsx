"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/leads/actions";

export function AnalysisButton({
  run,
  label,
  pendingLabel,
  variant = "default",
  hint,
}: {
  run: () => Promise<ActionState>;
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline";
  hint?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={variant}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await run();
            setError(result.error);
          })
        }
      >
        {pending ? pendingLabel : label}
      </Button>
      {pending && hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="max-w-xl text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
