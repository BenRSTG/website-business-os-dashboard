# Dashboard

Internes Werkzeug (Leads, Pipeline, Kunden, KI-Funktionen) des Website Business OS.
Login-geschützt, nur für den Owner. Planungsdokumente liegen im übergeordneten
Docs-Repo (`../docs`). Stand: **Milestone 1** (Login/Logout + App-Shell mit Navigation, Seiten noch leer).

Stack: Next.js 16 (App Router, Cache Components) · TypeScript strict · Tailwind 4 ·
shadcn/ui · Supabase (Auth + Postgres, Region Frankfurt).

> Next.js 16 weicht in Details von älteren Versionen ab (z. B. `proxy.ts` statt
> `middleware.ts`). Vor Änderungen die mitgelieferte Doku unter
> `node_modules/next/dist/docs/` lesen — siehe `AGENTS.md`.

## Lokale Entwicklung

```bash
npm install
cp .env.example .env.local   # Werte eintragen, siehe unten
npm run dev                  # http://localhost:3000
```

Prüfungen (laufen auch in der CI): `npm run lint`, `npm run typecheck`, `npm run build`.

## Environment-Variablen

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Basis-URL des Supabase-Projekts, **ohne** `/rest/v1/` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | „anon public"-Key (Settings → API). Öffentlich unbedenklich — der Schutz liegt in RLS |

`.env.local` ist gitignored. Der `service_role`-Key wird in diesem Milestone nicht
gebraucht und gehört nie in den Chat oder ins Repo. Spätere Variablen stehen
auskommentiert in `.env.example`. Fehlt oder fehlerhaft: `lib/env.ts` bricht beim
Start mit einer klaren Zod-Fehlermeldung ab.

## Datenbank

Migrationen: `supabase/migrations/` (0001 Enums, 0002 Organisation + Nutzer + RLS).
Einspielen in ein neues Supabase-Projekt — einfachster Weg:

1. Supabase Dashboard → **SQL Editor** → Inhalt von `0001_…sql` einfügen → **Run**.
2. Dasselbe mit `0002_…sql`.
3. **Authentication → Users → Add user → Create new user** (E-Mail + Passwort,
   „Auto Confirm User" an). Das ist der Owner-Login.
4. `supabase/bootstrap-owner.sql` im SQL Editor öffnen, `DEINE@EMAIL.DE` durch die
   E-Mail aus Schritt 3 ersetzen, **Run**. Es legt Organisation + Owner-Zeile an und
   zeigt zur Kontrolle genau eine Zeile.

Neue Migrationen werden fortlaufend nummeriert und nie nachträglich geändert.

## Aufbau

- `app/(auth)/login` — Login (Server Action, Zod-validiert)
- `app/(app)/…` — geschützter Bereich mit App-Shell (Sidebar: Dashboard · Leads · Customers, Abmelden);
  `AuthGate` im Layout prüft die Session, `actions.ts` enthält `signOut`
- `components/domain/` — fachliche Bausteine (`SidebarNav`, `KpiCard`, `PageHeader`)
- `proxy.ts` — Session-Refresh + optimistischer Redirect (verbindlich prüft das Layout, Daten schützt RLS)
- `lib/supabase/server.ts` — authentifizierter Client (RLS greift)
- `components/ui/` — shadcn-Primitives; Palette/Fonts in `app/globals.css`

## Deployment (Vercel)

Repo auf GitHub pushen → Vercel → **Add New → Project → Import** → die beiden
Env-Variablen aus der Tabelle oben eintragen → Deploy. Läuft zunächst unter der
vorläufigen `*.vercel.app`-Adresse; eine eigene Domain ist erst ab Milestone 5/6 nötig.

## Troubleshooting

- **Login-Fehlermeldung trotz richtiger Daten:** Wurde „Auto Confirm User" aktiviert?
  Stimmt die URL (ohne `/rest/v1/`)?
- **Build-Fehler „uncached or runtime data during prerendering":** Code, der
  `cookies()`/`headers()` liest, muss hinter `<Suspense>` stehen (Cache Components).
- **Redirect-Schleife zu `/login`:** Session-Cookie nicht gesetzt — Env-Variablen und
  Browser-Cookies prüfen.
