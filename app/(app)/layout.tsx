import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNav, SidebarNavFallback } from "@/components/domain/SidebarNav";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

// Verbindliche Prüfung — proxy.ts macht nur optimistische Redirects.
// Mit Cache Components darf die Session nur hinter einer Suspense-Grenze gelesen werden.
async function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return <>{children}</>;
}

async function UserFooter() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-2 border-t border-sidebar-border pt-3">
      <p
        className="truncate text-xs text-muted-foreground"
        title={data.user?.email}
      >
        {data.user?.email}
      </p>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
          <LogOut aria-hidden />
          Abmelden
        </Button>
      </form>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen flex-1 md:grid-cols-[14rem_1fr]">
      <aside className="flex flex-col gap-4 border-b border-sidebar-border bg-sidebar p-4 md:border-r md:border-b-0">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-md bg-primary font-heading text-sm font-bold text-primary-foreground"
          >
            W
          </span>
          <span className="font-heading text-sm font-bold">Website Business OS</span>
        </div>
        <Suspense fallback={<SidebarNavFallback />}>
          <SidebarNav />
        </Suspense>
        <div className="md:mt-auto">
          <Suspense fallback={<div className="h-20" />}>
            <UserFooter />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 p-6 md:p-8">
        <div className="mx-auto w-full max-w-6xl">
          <Suspense
            fallback={<p className="text-muted-foreground">Wird geladen …</p>}
          >
            <AuthGate>{children}</AuthGate>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
