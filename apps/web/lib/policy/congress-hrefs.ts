// Names and links for the congress.gov families a page prints, kept in a
// plain module so a server page and a client block can both call them.

export const CONGRESS = 119

/** "SAMDT" 5512 → "S.Amdt. 5512", the way congress.gov prints it. */
export function fmtAmendment(type: string, number: string) {
  const t = type.toUpperCase()
  const label = t.startsWith("S") ? "S.Amdt." : t.startsWith("H") ? "H.Amdt." : t
  return `${label} ${number}`.trim()
}

export const amendmentPath = (type: string, number: string) => `/amendments/${type.toLowerCase()}-${number}`

export const nominationPath = (r: { citation: string | null; key: string }) => `/nominations/${encodeURIComponent((r.citation ?? r.key).toLowerCase())}`

export const congressNominationHref = (r: { congress: number; number: string; part: string | null }) => `https://www.congress.gov/nomination/${r.congress}th-congress/${r.number}${r.part && r.part !== "00" ? `/${Number(r.part)}` : ""}`
