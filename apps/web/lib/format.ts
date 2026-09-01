// Ported from livingston-v3 lib/policy/format.ts — only what the home page uses.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function fmtDate(value: string | null | undefined, withYear = true) {
  if (!value) return ""
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return String(value)
  const [, y, m, d] = match
  const month = MONTHS[Number(m) - 1] ?? m
  return withYear ? `${month} ${Number(d)}, ${y}` : `${month} ${Number(d)}`
}

export function fmtTime(value: string | null | undefined) {
  if (!value || value === "00:00") return ""
  const [h, m] = value.split(":").map(Number)
  if (!Number.isFinite(h)) return value
  const suffix = h >= 12 ? "PM" : "AM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${suffix}`
}

export function fmtNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(Number(value ?? 0))
}

export function honorific(role: string | null | undefined, chamber: string | null | undefined) {
  if (role === "Sen") return "Sen."
  if (chamber === "Assembly") return "Asm."
  if (role === "Rep") return "Rep."
  return ""
}

export function truncate(value: string | null | undefined, length = 120) {
  const text = (value ?? "").replace(/\s+/g, " ").trim()
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text
}
