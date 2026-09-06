// Ported from livingston-v3 lib/policy/imagery.ts — which picture a thing gets.
import { flagUrl } from "@/lib/filters"

const SEALS: Record<string, string> = {
  "NY:Senate": "/chambers/ny-senate.avif",
  "NY:Assembly": "/chambers/ny-assembly.avif",
  "NY:": "/chambers/ny.avif",
  "US:Senate": "/chambers/us-senate.png",
  "US:House": "/chambers/us-house.png",
  "US:": "/chambers/us.png",
  // Every state, DC and Puerto Rico, harvested from Wikimedia Commons on
  // 2026-09-03 and rendered to 288 px. The `XX:` key is the jurisdiction's own
  // Great Seal and covers any row without a chamber; a chamber key exists only
  // where that chamber has a seal of its own. Files and licences are logged in
  // public/chambers/SOURCES.md.
  // Texas — House and Senate each have their own seal.
  "TX:House": "/chambers/tx-house.png",
  "TX:Senate": "/chambers/tx-senate.png",
  "TX:": "/chambers/tx.png",
  // Alabama — only the Speaker's seal exists; the Legislature's own site brands both chambers alike, so both fall through.
  "AL:": "/chambers/al.png",
  // Alaska — the Great Seal alone; neither chamber publishes a seal of its own.
  "AK:": "/chambers/ak.png",
  // Arizona — the Great Seal alone; neither chamber publishes a seal of its own.
  "AZ:": "/chambers/az.png",
  // Arkansas — the House has its own seal; the Senate's site carries only a wordmark, so it falls through.
  "AR:House": "/chambers/ar-house.png",
  "AR:": "/chambers/ar.png",
  // California — Assembly and Senate each have their own seal.
  "CA:Assembly": "/chambers/ca-assembly.png",
  "CA:Senate": "/chambers/ca-senate.png",
  "CA:": "/chambers/ca.png",
  // Colorado — the Great Seal alone; neither chamber publishes a seal of its own.
  "CO:": "/chambers/co.png",
  // Connecticut — the Senate has its own seal; the House wears the General Assembly's, which is the whole legislature's, so it falls through.
  "CT:Senate": "/chambers/ct-senate.png",
  "CT:": "/chambers/ct.png",
  // Delaware — the Great Seal alone; neither chamber publishes a seal of its own.
  "DE:": "/chambers/de.png",
  // District of Columbia — the seal of the District; its Council is unicameral and has no seal on Commons.
  "DC:": "/chambers/dc.png",
  // Florida — House and Senate each have their own seal.
  "FL:House": "/chambers/fl-house.png",
  "FL:Senate": "/chambers/fl-senate.png",
  "FL:": "/chambers/fl.png",
  // Georgia — House and Senate each have their own seal.
  "GA:House": "/chambers/ga-house.png",
  "GA:Senate": "/chambers/ga-senate.png",
  "GA:": "/chambers/ga.png",
  // Hawaii — the Great Seal alone; neither chamber publishes a seal of its own.
  "HI:": "/chambers/hi.png",
  // Idaho — House and Senate each have their own seal, from the Legislature's own site.
  "ID:House": "/chambers/id-house.png",
  "ID:Senate": "/chambers/id-senate.png",
  "ID:": "/chambers/id.png",
  // Illinois — the Great Seal alone; neither chamber publishes a seal of its own.
  "IL:": "/chambers/il.png",
  // Indiana — the Great Seal alone; neither chamber publishes a seal of its own.
  "IN:": "/chambers/in.png",
  // Iowa — the Great Seal alone; neither chamber publishes a seal of its own.
  "IA:": "/chambers/ia.png",
  // Kansas — House and Senate each have their own seal, from the Legislature's own site.
  "KS:House": "/chambers/ks-house.png",
  "KS:Senate": "/chambers/ks-senate.png",
  "KS:": "/chambers/ks.png",
  // Kentucky — the Great Seal alone; neither chamber publishes a seal of its own.
  "KY:": "/chambers/ky.png",
  // Louisiana — the Senate has its own seal; the House falls through.
  "LA:Senate": "/chambers/la-senate.png",
  "LA:": "/chambers/la.png",
  // Maine — the Great Seal alone; neither chamber publishes a seal of its own.
  "ME:": "/chambers/me.png",
  // Maryland — the Great Seal alone; neither chamber publishes a seal of its own.
  "MD:": "/chambers/md.png",
  // Massachusetts — House and Senate each have their own seal.
  "MA:House": "/chambers/ma-house.png",
  "MA:Senate": "/chambers/ma-senate.png",
  "MA:": "/chambers/ma.png",
  // Michigan — the Great Seal alone; neither chamber publishes a seal of its own.
  "MI:": "/chambers/mi.png",
  // Minnesota — the Great Seal alone; neither chamber publishes a seal of its own.
  "MN:": "/chambers/mn.png",
  // Mississippi — the Great Seal alone; neither chamber publishes a seal of its own.
  "MS:": "/chambers/ms.png",
  // Missouri — House and Senate each have their own seal.
  "MO:House": "/chambers/mo-house.png",
  "MO:Senate": "/chambers/mo-senate.png",
  "MO:": "/chambers/mo.png",
  // Montana — the Great Seal alone; neither chamber publishes a seal of its own.
  "MT:": "/chambers/mt.png",
  // Nebraska — unicameral, and LegiScan calls its one body a Senate; that key wears the Legislature's seal.
  "NE:Senate": "/chambers/ne-senate.png",
  "NE:": "/chambers/ne.png",
  // Nevada — the Legislature's emblem covers both chambers, so Assembly and Senate fall through.
  "NV:": "/chambers/nv.png",
  // New Hampshire — the Great Seal alone; neither chamber publishes a seal of its own.
  "NH:": "/chambers/nh.png",
  // New Jersey — the Great Seal alone; neither chamber publishes a seal of its own.
  "NJ:": "/chambers/nj.png",
  // New Mexico — House and Senate each have their own seal.
  "NM:House": "/chambers/nm-house.png",
  "NM:Senate": "/chambers/nm-senate.png",
  "NM:": "/chambers/nm.png",
  // North Carolina — the Senate has its own seal; the House has only the Speaker's, so it falls through.
  "NC:Senate": "/chambers/nc-senate.png",
  "NC:": "/chambers/nc.png",
  // North Dakota — the Great Seal alone; neither chamber publishes a seal of its own.
  "ND:": "/chambers/nd.png",
  // Ohio — House and Senate each have their own seal.
  "OH:House": "/chambers/oh-house.png",
  "OH:Senate": "/chambers/oh-senate.png",
  "OH:": "/chambers/oh.png",
  // Oklahoma — House and Senate each have their own seal.
  "OK:House": "/chambers/ok-house.png",
  "OK:Senate": "/chambers/ok-senate.png",
  "OK:": "/chambers/ok.png",
  // Oregon — the House has its own seal; the Senate falls through.
  "OR:House": "/chambers/or-house.png",
  "OR:": "/chambers/or.png",
  // Pennsylvania — House and Senate each have their own seal.
  "PA:House": "/chambers/pa-house.png",
  "PA:Senate": "/chambers/pa-senate.png",
  "PA:": "/chambers/pa.png",
  // Puerto Rico — House and Senate each have their own seal.
  "PR:House": "/chambers/pr-house.png",
  "PR:Senate": "/chambers/pr-senate.png",
  "PR:": "/chambers/pr.png",
  // Rhode Island — House and Senate each have their own seal.
  "RI:House": "/chambers/ri-house.png",
  "RI:Senate": "/chambers/ri-senate.png",
  "RI:": "/chambers/ri.png",
  // South Carolina — House and Senate each have their own seal.
  "SC:House": "/chambers/sc-house.png",
  "SC:Senate": "/chambers/sc-senate.png",
  "SC:": "/chambers/sc.png",
  // South Dakota — the Great Seal alone; neither chamber publishes a seal of its own.
  "SD:": "/chambers/sd.png",
  // Tennessee — the Great Seal alone; neither chamber publishes a seal of its own.
  "TN:": "/chambers/tn.png",
  // Utah — the House has its own seal; the Senate uses the state seal, so it falls through.
  "UT:House": "/chambers/ut-house.png",
  "UT:": "/chambers/ut.png",
  // Vermont — the Great Seal alone; neither chamber publishes a seal of its own.
  "VT:": "/chambers/vt.png",
  // Virginia — the Senate has its own seal; the House falls through.
  "VA:Senate": "/chambers/va-senate.png",
  "VA:": "/chambers/va.png",
  // Washington — House and Senate each have their own seal.
  "WA:House": "/chambers/wa-house.png",
  "WA:Senate": "/chambers/wa-senate.png",
  "WA:": "/chambers/wa.png",
  // West Virginia — the Great Seal alone; neither chamber publishes a seal of its own.
  "WV:": "/chambers/wv.png",
  // Wisconsin — the Great Seal alone; neither chamber publishes a seal of its own.
  "WI:": "/chambers/wi.png",
  // Wyoming — the Legislature's trademarked seal covers both chambers, so both fall through to the Great Seal.
  "WY:": "/chambers/wy.png",
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

export const PARTY_BLUE = "var(--color-blue-600)"
export const PARTY_RED = "var(--color-red-600)"
export const PARTY_GREY = "var(--color-muted-foreground)"
export const PARTY_OTHER = "var(--color-amber-500)"

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
