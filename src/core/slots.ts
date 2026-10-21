// Pure availability math for DJ meetings (shared with a future native app).

export type MeetingHours = { days: number[]; start: string; end: string };
export const DEFAULT_HOURS: MeetingHours = { days: [0, 1, 2, 3, 4], start: '10:00', end: '20:00' };
export type Interval = { start: number; end: number }; // epoch ms

export function parseHours(v: unknown): MeetingHours {
  const o = (v ?? {}) as Partial<MeetingHours>;
  const hm = (s: unknown, d: string) => (typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : d);
  const days = Array.isArray(o.days) ? [...new Set(o.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort() : DEFAULT_HOURS.days;
  const start = hm(o.start, DEFAULT_HOURS.start), end = hm(o.end, DEFAULT_HOURS.end);
  return end > start ? { days, start, end } : DEFAULT_HOURS;
}

/** Offset (ms) of a time zone from UTC at a given instant. */
function tzOffset(at: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(at)).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at / 1000) * 1000;
}

/** Wall-clock time in `tz` → epoch ms. */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz);
  return t;
}

/** Calendar date (y, m, d, weekday) of an instant in `tz`. */
export function zonedDate(at: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })
    .formatToParts(new Date(at)).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), weekday: wd };
}

export type DaySlots = { date: string; slots: string[] }; // date YYYY-MM-DD (tz), slots = ISO start times

/**
 * Free meeting starts between `from` and `to` (epoch ms), inside the DJ's weekly hours,
 * not overlapping any busy interval. Slots start on the half hour.
 */
export function computeSlots(opts: { hours: MeetingHours; busy: Interval[]; from: number; to: number; tz: string; durationMin: number; stepMin?: number }): DaySlots[] {
  const { hours, busy, from, to, tz, durationMin } = opts;
  const step = (opts.stepMin ?? 30) * 60_000, dur = durationMin * 60_000;
  const [sh, sm] = hours.start.split(':').map(Number), [eh, em] = hours.end.split(':').map(Number);
  const out: DaySlots[] = [];
  const first = zonedDate(from, tz);
  for (let i = 0; i < 62; i++) {
    const dayStart = zonedToUtc(first.y, first.m, first.d + i, 0, 0, tz);
    if (dayStart > to) break;
    const z = zonedDate(dayStart + 12 * 3600_000, tz);
    if (!hours.days.includes(z.weekday)) continue;
    const winStart = zonedToUtc(z.y, z.m, z.d, sh, sm, tz), winEnd = zonedToUtc(z.y, z.m, z.d, eh, em, tz);
    const slots: string[] = [];
    for (let t = winStart; t + dur <= winEnd; t += step) {
      if (t < from || t + dur > to) continue;
      if (busy.some((b) => t < b.end && t + dur > b.start)) continue;
      slots.push(new Date(t).toISOString());
    }
    if (slots.length) out.push({ date: `${z.y}-${String(z.m).padStart(2, '0')}-${String(z.d).padStart(2, '0')}`, slots });
  }
  return out;
}
