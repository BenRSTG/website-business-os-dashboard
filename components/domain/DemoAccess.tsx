"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { PasswordReveal } from "@/components/domain/PasswordReveal";
import {
  extendDemoAccess,
  lockDemo,
  removeDemoPassword,
  renewDemoPassword,
  type AccessResult,
} from "@/lib/website/access-actions";

export function DemoAccess({
  siteId,
  link,
  protectedByPassword,
  expiresLabel,
  expired,
}: {
  siteId: string;
  link: string;
  protectedByPassword: boolean;
  expiresLabel: string | null;
  expired: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "warning"; text: string } | null>(null);

  function run(action: () => Promise<AccessResult>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      setMessage(null);
      const result = await action();
      if (result.error) setMessage({ kind: "error", text: result.error });
      else if (result.warning) setMessage({ kind: "warning", text: result.warning });
      setPassword(result.password ?? null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {protectedByPassword ? "Mit Passwort geschützt" : "Ohne Passwort (jeder mit dem Link kann sie sehen)"} ·{" "}
        {expired ? (
          <span className="font-semibold text-destructive">Gesperrt oder abgelaufen</span>
        ) : expiresLabel ? (
          <>Erreichbar bis {expiresLabel}</>
        ) : (
          "ohne Ablaufdatum"
        )}
      </p>
      {password ? <PasswordReveal password={password} link={link} onClose={() => setPassword(null)} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => renewDemoPassword(siteId))}>
          {protectedByPassword ? "Neues Passwort erzeugen" : "Passwort setzen"}
        </Button>
        {protectedByPassword ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => removeDemoPassword(siteId), "Ohne Passwort kann jeder mit dem Link die Demo sehen. Passwort wirklich entfernen?")}
          >
            Passwort entfernen
          </Button>
        ) : null}
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => extendDemoAccess(siteId, 14))}>
          +14 Tage
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => extendDemoAccess(siteId, 30))}>
          +30 Tage
        </Button>
        {!expired ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => lockDemo(siteId), "Der Link wird sofort gesperrt. Mit „+14 Tage“ ist er wieder erreichbar. Fortfahren?")}
          >
            Link sperren
          </Button>
        ) : null}
      </div>
      {message ? (
        <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
