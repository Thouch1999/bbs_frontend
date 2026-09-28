import type { Language } from "../context/localePrefs";

// Back-office times are always shown and entered in Cambodia time, whatever
// the browser's own time zone (CLAUDE.md: store UTC, display
// Asia/Phnom_Penh). Cambodia has no DST, so the offset is a constant.
export const OPERATOR_TIME_ZONE = "Asia/Phnom_Penh";
const OFFSET = "+07:00";

const LOCALE_TAG: Record<Language, string> = { km: "km-KH", en: "en-GB" };

function parts(date: Date): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATOR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
}

/** "YYYY-MM-DD" of `date` in Cambodia. */
export function localDateISO(date: Date = new Date()): string {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Local calendar date of an ISO datetime from the API. */
export function localDateOf(isoDateTime: string): string {
  return localDateISO(new Date(isoDateTime));
}

/** Pure calendar arithmetic on "YYYY-MM-DD" (no time zone involved). */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday = 0 … Sunday = 6 (matches the backend's `weekdays`). */
export function weekdayIndex(isoDate: string): number {
  return (new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function startOfWeek(isoDate: string): string {
  return addDays(isoDate, -weekdayIndex(isoDate));
}

/** ISO datetime → value for <input type="datetime-local">, in Cambodia time. */
export function toLocalInputValue(isoDateTime: string): string {
  const p = parts(new Date(isoDateTime));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** <input type="datetime-local"> value (Cambodia time) → ISO datetime with offset. */
export function fromLocalInputValue(value: string): string {
  return `${value}:00${OFFSET}`;
}

export function addMinutesToLocalInput(value: string, minutes: number): string {
  const ms = new Date(fromLocalInputValue(value)).getTime() + minutes * 60_000;
  return toLocalInputValue(new Date(ms).toISOString());
}

export function formatTime(isoDateTime: string, language: Language): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[language], {
    timeZone: OPERATOR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(isoDateTime));
}

export function formatDate(isoDateOrDateTime: string, language: Language): string {
  const date = isoDateOrDateTime.length === 10 ? new Date(`${isoDateOrDateTime}T00:00:00${OFFSET}`) : new Date(isoDateOrDateTime);
  return new Intl.DateTimeFormat(LOCALE_TAG[language], {
    timeZone: OPERATOR_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(isoDateTime: string, language: Language): string {
  return `${formatDate(isoDateTime, language)} ${formatTime(isoDateTime, language)}`;
}

export function formatWeekday(isoDate: string, language: Language): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[language], { timeZone: OPERATOR_TIME_ZONE, weekday: "short" }).format(
    new Date(`${isoDate}T12:00:00${OFFSET}`)
  );
}
