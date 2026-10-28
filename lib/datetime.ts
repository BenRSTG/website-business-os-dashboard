const TZ = "Europe/Berlin";

// Server laufen in UTC — alle Tages-Grenzen und Anzeigen werden bewusst in deutscher Zeit gerechnet.
function berlinOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "longOffset",
  }).formatToParts(at);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function berlinYmd(at: Date): [number, number, number] {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(at);
  const [y, m, d] = ymd.split("-").map(Number);
  return [y, m, d];
}

/** Zeitpunkt "Tag + dayOffset, hour:00 Uhr" in deutscher Zeit, bezogen auf das Datum von `from`. */
export function berlinDayAt(dayOffset: number, hour: number, from = new Date()): Date {
  const [y, m, d] = berlinYmd(from);
  const asUtc = Date.UTC(y, m - 1, d + dayOffset, hour);
  return new Date(asUtc - berlinOffsetMinutes(new Date(asUtc)) * 60_000);
}

/** Zeitpunkt für ein Datum "YYYY-MM-DD" um `hour` Uhr deutscher Zeit. */
export function berlinDateStringAt(ymd: string, hour: number): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hour);
  return new Date(asUtc - berlinOffsetMinutes(new Date(asUtc)) * 60_000);
}

/** Beginn des morgigen Tages (00:00 Uhr deutscher Zeit) — Obergrenze für "heute fällig". */
export function startOfTomorrowBerlin(from = new Date()): Date {
  return berlinDayAt(1, 0, from);
}

/** Beginn des aktuellen Kalendermonats (deutscher Zeit). */
export function startOfMonthBerlin(from = new Date()): Date {
  const [y, m] = berlinYmd(from);
  const asUtc = Date.UTC(y, m - 1, 1);
  return new Date(asUtc - berlinOffsetMinutes(new Date(asUtc)) * 60_000);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** "heute", "morgen" oder Datum — für kompakte Listen. */
export function formatRelativeDay(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  const todayStart = berlinDayAt(0, 0);
  if (date < berlinDayAt(1, 0)) return date < todayStart ? "überfällig" : "heute";
  if (date < berlinDayAt(2, 0)) return "morgen";
  return formatDate(date);
}
