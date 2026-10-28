"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const items: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/customers", label: "Customers", icon: Building2 },
];

function NavList({ isActive }: { isActive: (href: string) => boolean }) {
  return (
    <nav aria-label="Hauptnavigation" className="flex gap-1 md:flex-col">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// Der aktuelle Pfad ist erst zur Laufzeit bekannt (dynamische Routen wie /leads/[leadId]) —
// deshalb braucht SidebarNav eine Suspense-Grenze, solange liefert SidebarNavFallback die Links ohne Hervorhebung.
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <NavList isActive={(href) => pathname === href || pathname.startsWith(`${href}/`)} />
  );
}

export function SidebarNavFallback() {
  return <NavList isActive={() => false} />;
}
