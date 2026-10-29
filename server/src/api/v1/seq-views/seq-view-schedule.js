/** When the next automatic fetch is due. Daily / weekly times are wall-clock times in an IANA time zone. */

export const isValidTimeZone = (tz) => {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const partsIn = (tz, ts) => {
  const out = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  })
    .formatToParts(new Date(ts))
    .forEach((p) => {
      if (p.type !== 'literal') out[p.type] = Number(p.value);
    });
  return out;
};

/** How far `tz` is ahead of UTC at instant `ts`, in ms. */
const offsetMs = (tz, ts) => {
  const p = partsIn(tz, ts);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000;
};

/** The UTC instant at which the wall clock in `tz` reads y-m-d h:mi. */
const zonedToUtc = (y, m, d, h, mi, tz) => {
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let guess = wall;
  for (let i = 0; i < 3; i += 1) guess = wall - offsetMs(tz, guess);
  return guess;
};

/** Next time after `from` (ms) that falls on one of `days` (0 = Sunday; omit for every day) at `time` ("HH:MM") in `tz`. */
export const nextTimedRun = ({ time, days, timezone }, from = Date.now()) => {
  const [h, mi] = time.split(':').map(Number);
  const local = partsIn(timezone, from);
  for (let i = 0; i <= 14; i += 1) {
    const day = new Date(Date.UTC(local.year, local.month - 1, local.day + i));
    if (days?.length && !days.includes(day.getUTCDay())) continue;
    const at = zonedToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), h, mi, timezone);
    if (at > from) return at;
  }
  return null;
};

/** ISO time of the next run for an enabled schedule, or null when it is off. */
export const nextRunAt = (schedule, from = Date.now()) => {
  if (!schedule?.enabled) return null;
  if (schedule.type === 'daily') {
    const at = nextTimedRun({ time: schedule.time, timezone: schedule.timezone }, from);
    return at ? new Date(at).toISOString() : null;
  }
  if (schedule.type === 'weekly') {
    const at = nextTimedRun({ time: schedule.time, days: schedule.days, timezone: schedule.timezone }, from);
    return at ? new Date(at).toISOString() : null;
  }
  return new Date(from + schedule.intervalMinutes * 60000).toISOString();
};
