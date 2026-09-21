/**
 * A database timestamp as a Date. Postgres writes a timestamptz as
 * "2026-09-20 21:48:52.320039+00"; JavaScript takes neither the space nor an
 * offset without minutes, and an invalid date compares false with everything.
 * On the Database dashboard that read every jurisdiction's dot red whatever
 * Aurora held, until the day a fleet turned all 52 green and the board showed
 * none of it (2026-09-20). A timestamp without an offset is UTC, as the
 * database keeps it; a date alone is left to JavaScript, which reads it.
 */
export function asDate(at: string): Date {
  const iso = at.trim().replace(" ", "T")
  if (!iso.includes("T")) return new Date(iso)
  const day = iso.slice(0, iso.indexOf("T"))
  const time = iso.slice(iso.indexOf("T") + 1).replace(/(\.\d{3})\d+/, "$1")
  return new Date(`${day}T${/[Z+-]/.test(time) ? time.replace(/([+-]\d{2})$/, "$1:00") : `${time}Z`}`)
}
