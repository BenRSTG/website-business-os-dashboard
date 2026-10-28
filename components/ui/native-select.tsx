import * as React from "react";
import { cn } from "@/lib/utils";

// Bewusst das native <select>: bedienbar per Tastatur und mobil ohne Zusatz-Bibliothek.
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
