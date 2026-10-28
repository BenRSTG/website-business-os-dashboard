import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Verbindliche Prüfung — proxy.ts macht nur optimistische Redirects.
// Mit Cache Components darf die Session nur hinter einer Suspense-Grenze gelesen werden.
async function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<p className="p-8 text-muted-foreground">Wird geladen …</p>}
    >
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}
