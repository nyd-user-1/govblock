// When a hearing is, in the shape Google Calendar wants.
//
// Two facts from the rows themselves decided this. First, `time` is often
// "00:00", which is LegiScan's way of saying it holds no time: 93 of New York's
// 200 most recent hearings, and a "00:00" event on someone's calendar at
// midnight would be our artefact, not their hearing. Those go on as ALL-DAY
// entries. Second, when a time *is* held it carries no zone, and the reader's
// own zone is the wrong one — a Texas hearing is at 8:30 in Austin whoever is
// reading. So a timed entry is stamped with the timezone of the state's
// CAPITOL, which is where a legislature sits.
//
// A jurisdiction we have no capitol zone for falls back to all-day rather than
// guessing: a day that is right beats an hour that might not be.

const CAPITOL_TZ: Record<string, string> = {
  US: "America/New_York", // the Capitol
  DC: "America/New_York",
  AL: "America/Chicago",
  AK: "America/Juneau",
  AZ: "America/Phoenix", // no DST
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  FL: "America/New_York", // Tallahassee, though the panhandle is Central
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  IA: "America/Chicago",
  ID: "America/Boise",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  KS: "America/Chicago",
  KY: "America/New_York", // Frankfort, though the west is Central
  LA: "America/Chicago",
  MA: "America/New_York",
  MD: "America/New_York",
  ME: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MO: "America/Chicago",
  MS: "America/Chicago",
  MT: "America/Denver",
  NC: "America/New_York",
  ND: "America/Chicago", // Bismarck, though the southwest is Mountain
  NE: "America/Chicago",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NV: "America/Los_Angeles",
  NY: "America/New_York",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago", // Pierre, though the west is Mountain
  TN: "America/Chicago", // Nashville, though the east is Eastern
  TX: "America/Chicago",
  UT: "America/Denver",
  VA: "America/New_York",
  VT: "America/New_York",
  WA: "America/Los_Angeles",
  WI: "America/Chicago",
  WV: "America/New_York",
  WY: "America/Denver",
}

export type When = { start: string; end: string; timeZone?: string; allDay: boolean }

const plusDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * A hearing's date and (maybe) time as a Google Calendar span.
 *
 * All-day entries end the NEXT day because Google reads `end.date` as
 * exclusive — an all-day event ending on its own start date is an empty range
 * and the API refuses it.
 */
export function hearingWhen(date: string, time: string | null | undefined, state: string): When {
  const clean = (time ?? "").trim()
  const zone = CAPITOL_TZ[state?.toUpperCase() ?? ""]
  const timed = /^\d{1,2}:\d{2}/.test(clean) && !/^0?0:00/.test(clean) && Boolean(zone)

  if (!timed) return { start: date, end: plusDay(date), allDay: true }

  const [hour, minute] = clean.split(":")
  const at = (h: number, m: number) =>
    `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
  const h = Number(hour)
  const m = Number(minute.slice(0, 2))
  // An hour, because a committee calendar says when a hearing starts and
  // almost never when it ends. A wrong end time is a smaller lie than a
  // zero-length event, and the reader can drag it.
  return { start: at(h, m), end: at((h + 1) % 24, m), timeZone: zone, allDay: false }
}

/** A datetime the source already resolved — Congress meetings carry one. */
export function instantWhen(value: string): When {
  const end = new Date(value)
  return {
    start: value,
    end: Number.isNaN(end.getTime()) ? value : new Date(end.getTime() + 3_600_000).toISOString(),
    allDay: false,
  }
}
