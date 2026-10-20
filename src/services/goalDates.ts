const DAY = 86_400_000;

function dateParts(value: Date, timezone: string) {
  if (!/^[A-Za-z][A-Za-z0-9_+/-]*$/.test(timezone)) throw new Error("invalid timezone");
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(value).map(part => [part.type, part.value]));
}

export function goalCalendarDate(value: string | Date, timezone: string): string {
  const parts = dateParts(new Date(value), timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function goalDeadline(date: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("invalid date");
  const desired = Date.parse(`${date}T23:59:59Z`);
  if (!Number.isFinite(desired) || new Date(desired).toISOString().slice(0, 10) !== date) throw new Error("invalid date");
  let guess = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = dateParts(new Date(guess), timezone);
    const actual = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    if (actual === desired) return new Date(guess).toISOString();
    guess += desired - actual;
  }
  throw new Error("unsupported date in timezone");
}

export function goalDateRange(timezone: string, now = new Date()) {
  return {
    min: goalCalendarDate(now, timezone),
    max: goalCalendarDate(new Date(now.getTime() + 365 * DAY), timezone),
  };
}
