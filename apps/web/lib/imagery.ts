// Ported from livingston-v3 lib/policy/imagery.ts — which picture a thing gets.
import { flagUrl } from "@/lib/filters"

const SEALS: Record<string, string> = {
  "NY:Senate": "/chambers/ny-senate.avif",
  "NY:Assembly": "/chambers/ny-assembly.avif",
  "NY:": "/chambers/ny.avif",
  "US:Senate": "/chambers/us-senate.avif",
  "US:House": "/chambers/us-house.avif",
  "US:": "/chambers/us.avif",
  // Every state, DC and Puerto Rico, harvested from Wikimedia Commons on
  // 2026-09-03 and rendered to 288 px. The `XX:` key is the jurisdiction's own
  // Great Seal and covers any row without a chamber; a chamber key exists only
  // where that chamber has a seal of its own. Files and licences are logged in
  // public/chambers/SOURCES.md.
  // Texas — House and Senate each have their own seal.
  "TX:House": "/chambers/tx-house.avif",
  "TX:Senate": "/chambers/tx-senate.avif",
  "TX:": "/chambers/tx.avif",
  // Alabama — only the Speaker's seal exists; the Legislature's own site brands both chambers alike, so both fall through.
  "AL:": "/chambers/al.avif",
  // Alaska — the Great Seal alone; neither chamber publishes a seal of its own.
  "AK:": "/chambers/ak.avif",
  // Arizona — the Great Seal alone; neither chamber publishes a seal of its own.
  "AZ:": "/chambers/az.avif",
  // Arkansas — the House has its own seal; the Senate's site carries only a wordmark, so it falls through.
  "AR:House": "/chambers/ar-house.avif",
  "AR:": "/chambers/ar.avif",
  // California — Assembly and Senate each have their own seal.
  "CA:Assembly": "/chambers/ca-assembly.avif",
  "CA:Senate": "/chambers/ca-senate.avif",
  "CA:": "/chambers/ca.avif",
  // Colorado — the Great Seal alone; neither chamber publishes a seal of its own.
  "CO:": "/chambers/co.avif",
  // Connecticut — the Senate has its own seal; the House wears the General Assembly's, which is the whole legislature's, so it falls through.
  "CT:Senate": "/chambers/ct-senate.avif",
  "CT:": "/chambers/ct.avif",
  // Delaware — the Great Seal alone; neither chamber publishes a seal of its own.
  "DE:": "/chambers/de.avif",
  // District of Columbia — the seal of the District; its Council is unicameral and has no seal on Commons.
  "DC:": "/chambers/dc.avif",
  // Florida — House and Senate each have their own seal.
  "FL:House": "/chambers/fl-house.avif",
  "FL:Senate": "/chambers/fl-senate.avif",
  "FL:": "/chambers/fl.avif",
  // Georgia — House and Senate each have their own seal.
  "GA:House": "/chambers/ga-house.avif",
  "GA:Senate": "/chambers/ga-senate.avif",
  "GA:": "/chambers/ga.avif",
  // Hawaii — the Great Seal alone; neither chamber publishes a seal of its own.
  "HI:": "/chambers/hi.avif",
  // Idaho — House and Senate each have their own seal, from the Legislature's own site.
  "ID:House": "/chambers/id-house.avif",
  "ID:Senate": "/chambers/id-senate.avif",
  "ID:": "/chambers/id.avif",
  // Illinois — the Great Seal alone; neither chamber publishes a seal of its own.
  "IL:": "/chambers/il.avif",
  // Indiana — the Great Seal alone; neither chamber publishes a seal of its own.
  "IN:": "/chambers/in.avif",
  // Iowa — the Great Seal alone; neither chamber publishes a seal of its own.
  "IA:": "/chambers/ia.avif",
  // Kansas — House and Senate each have their own seal, from the Legislature's own site.
  "KS:House": "/chambers/ks-house.avif",
  "KS:Senate": "/chambers/ks-senate.avif",
  "KS:": "/chambers/ks.avif",
  // Kentucky — the Great Seal alone; neither chamber publishes a seal of its own.
  "KY:": "/chambers/ky.avif",
  // Louisiana — the Senate has its own seal; the House falls through.
  "LA:Senate": "/chambers/la-senate.avif",
  "LA:": "/chambers/la.avif",
  // Maine — the Great Seal alone; neither chamber publishes a seal of its own.
  "ME:": "/chambers/me.avif",
  // Maryland — the Great Seal alone; neither chamber publishes a seal of its own.
  "MD:": "/chambers/md.avif",
  // Massachusetts — House and Senate each have their own seal.
  "MA:House": "/chambers/ma-house.avif",
  "MA:Senate": "/chambers/ma-senate.avif",
  "MA:": "/chambers/ma.avif",
  // Michigan — the Great Seal alone; neither chamber publishes a seal of its own.
  "MI:": "/chambers/mi.avif",
  // Minnesota — the Great Seal alone; neither chamber publishes a seal of its own.
  "MN:": "/chambers/mn.avif",
  // Mississippi — the Great Seal alone; neither chamber publishes a seal of its own.
  "MS:": "/chambers/ms.avif",
  // Missouri — House and Senate each have their own seal.
  "MO:House": "/chambers/mo-house.avif",
  "MO:Senate": "/chambers/mo-senate.avif",
  "MO:": "/chambers/mo.avif",
  // Montana — the Great Seal alone; neither chamber publishes a seal of its own.
  "MT:": "/chambers/mt.avif",
  // Nebraska — unicameral, and LegiScan calls its one body a Senate; that key wears the Legislature's seal.
  "NE:Senate": "/chambers/ne-senate.avif",
  "NE:": "/chambers/ne.avif",
  // Nevada — the Legislature's emblem covers both chambers, so Assembly and Senate fall through.
  "NV:": "/chambers/nv.avif",
  // New Hampshire — the Great Seal alone; neither chamber publishes a seal of its own.
  "NH:": "/chambers/nh.avif",
  // New Jersey — the Great Seal alone; neither chamber publishes a seal of its own.
  "NJ:": "/chambers/nj.avif",
  // New Mexico — House and Senate each have their own seal.
  "NM:House": "/chambers/nm-house.avif",
  "NM:Senate": "/chambers/nm-senate.avif",
  "NM:": "/chambers/nm.avif",
  // North Carolina — the Senate has its own seal; the House has only the Speaker's, so it falls through.
  "NC:Senate": "/chambers/nc-senate.avif",
  "NC:": "/chambers/nc.avif",
  // North Dakota — the Great Seal alone; neither chamber publishes a seal of its own.
  "ND:": "/chambers/nd.avif",
  // Ohio — House and Senate each have their own seal.
  "OH:House": "/chambers/oh-house.avif",
  "OH:Senate": "/chambers/oh-senate.avif",
  "OH:": "/chambers/oh.avif",
  // Oklahoma — House and Senate each have their own seal.
  "OK:House": "/chambers/ok-house.avif",
  "OK:Senate": "/chambers/ok-senate.avif",
  "OK:": "/chambers/ok.avif",
  // Oregon — the House has its own seal; the Senate falls through.
  "OR:House": "/chambers/or-house.avif",
  "OR:": "/chambers/or.avif",
  // Pennsylvania — House and Senate each have their own seal.
  "PA:House": "/chambers/pa-house.avif",
  "PA:Senate": "/chambers/pa-senate.avif",
  "PA:": "/chambers/pa.avif",
  // Puerto Rico — House and Senate each have their own seal.
  "PR:House": "/chambers/pr-house.avif",
  "PR:Senate": "/chambers/pr-senate.avif",
  "PR:": "/chambers/pr.avif",
  // Rhode Island — House and Senate each have their own seal.
  "RI:House": "/chambers/ri-house.avif",
  "RI:Senate": "/chambers/ri-senate.avif",
  "RI:": "/chambers/ri.avif",
  // South Carolina — House and Senate each have their own seal.
  "SC:House": "/chambers/sc-house.avif",
  "SC:Senate": "/chambers/sc-senate.avif",
  "SC:": "/chambers/sc.avif",
  // South Dakota — the Great Seal alone; neither chamber publishes a seal of its own.
  "SD:": "/chambers/sd.avif",
  // Tennessee — the Great Seal alone; neither chamber publishes a seal of its own.
  "TN:": "/chambers/tn.avif",
  // Utah — the House has its own seal; the Senate uses the state seal, so it falls through.
  "UT:House": "/chambers/ut-house.avif",
  "UT:": "/chambers/ut.avif",
  // Vermont — the Great Seal alone; neither chamber publishes a seal of its own.
  "VT:": "/chambers/vt.avif",
  // Virginia — the Senate has its own seal; the House falls through.
  "VA:Senate": "/chambers/va-senate.avif",
  "VA:": "/chambers/va.avif",
  // Washington — House and Senate each have their own seal.
  "WA:House": "/chambers/wa-house.avif",
  "WA:Senate": "/chambers/wa-senate.avif",
  "WA:": "/chambers/wa.avif",
  // West Virginia — the Great Seal alone; neither chamber publishes a seal of its own.
  "WV:": "/chambers/wv.avif",
  // Wisconsin — the Great Seal alone; neither chamber publishes a seal of its own.
  "WI:": "/chambers/wi.avif",
  // Wyoming — the Legislature's trademarked seal covers both chambers, so both fall through to the Great Seal.
  "WY:": "/chambers/wy.avif",
}

export function chamberImage(state: string, chamber?: string | null) {
  const code = (state || "").toUpperCase()
  const body = chamber ?? ""
  return SEALS[`${code}:${body}`] ?? SEALS[`${code}:`] ?? flagUrl(code || "US")
}

export function hasSeal(state: string, chamber?: string | null) {
  const code = (state || "").toUpperCase()
  return `${code}:${chamber ?? ""}` in SEALS || `${code}:` in SEALS
}

export function portraitFor(member: { photo_url?: string | null; bioguide_id?: string | null }) {
  // The bioguide depiction covers the whole federal roster — clerk.house.gov
  // never had senators, which is why the directory wore seals. congress.gov
  // serves it by bioguide id at a stable URL (probed 200, image/jpeg).
  if (member.bioguide_id) {
    return `https://www.congress.gov/img/member/${member.bioguide_id.toLowerCase()}_200.jpg`
  }
  return member.photo_url ?? null
}

// Literal colours, not Tailwind's theme variables (2026-09-12): the file
// ships in the registry, and a consumer on Tailwind v3 has no
// --color-blue-600, so the party dot vanished there. These are v4's
// blue-600, red-600, zinc-500 and amber-500.
export const PARTY_BLUE = "#155dfc"
export const PARTY_RED = "#e7000b"
export const PARTY_GREY = "#71717b"
export const PARTY_OTHER = "#fd9a00"

export function partyColor(
  party: string | null | undefined,
  { serving = true }: { serving?: boolean } = {}
) {
  if (!serving) return PARTY_GREY
  const code = (party ?? "").toUpperCase().slice(0, 1)
  if (code === "D") return PARTY_BLUE
  if (code === "R") return PARTY_RED
  return PARTY_OTHER
}

/**
 * The chamber a bill's own number names, for a row whose record carries none:
 * New York's A and S, Congress's HB and SB, the Houses of most states.
 */
export function chamberFromNumber(number: string | null | undefined): string | null {
  const letter = String(number ?? "").trim().charAt(0).toUpperCase()
  return letter === "A" ? "Assembly" : letter === "S" ? "Senate" : letter === "H" ? "House" : null
}
