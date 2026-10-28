"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Zeigt ein Passwort genau einmal an. Nach dem Schließen ist es nirgends mehr lesbar (nur sein Hash ist gespeichert). */
export function PasswordReveal({ password, link, onClose }: { password: string; link?: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = link ? `${link}\nPasswort: ${password}` : password;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div role="status" className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
      <p className="font-semibold">Passwort (wird nur jetzt angezeigt)</p>
      <p className="mt-1 select-all break-all font-mono text-base">{password}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={copy}>
          {copied ? "Kopiert" : link ? "Link und Passwort kopieren" : "Kopieren"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Schließen
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Nach dem Schließen lässt es sich nicht mehr anzeigen; bei Verlust erzeugst du ein neues.</p>
    </div>
  );
}
