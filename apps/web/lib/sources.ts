import { PUBLISHERS } from "@/lib/laws-publishers"
import { STATE_NAMES } from "@/lib/filters"

// Every source GovBlock reads (Brendan, 2026-09-15): the /sources gallery, in
// place of the "Source:" line each record page used to end with. The federal
// offices are the ones the loaders call; each state's legislature is the host
// its own bill links point to (the most common "Bills".state_link host of the
// 2023 sessions on, read 2026-09-15); a state's law comes from its publisher
// in lib/laws-publishers.ts where one is loaded.

export type Source = {
  key: string
  name: string
  url: string
  /** What GovBlock takes from it. */
  provides: string[]
  /** A jurisdiction's flag, or a chamber's seal. */
  state?: string
  chamber?: "House" | "Senate"
}

export const FEDERAL: Source[] = [
  { key: "congress", name: "Library of Congress, congress.gov", url: "https://www.congress.gov/", provides: ["Bills", "Actions", "Sponsors", "Amendments", "Committees", "Nominations", "Hearings", "Members"], state: "US" },
  { key: "govinfo", name: "U.S. Government Publishing Office, GovInfo", url: "https://www.govinfo.gov/", provides: ["Bill text", "Public laws"], state: "US" },
  { key: "uscode", name: "Office of the Law Revision Counsel", url: "https://uscode.house.gov/", provides: ["United States Code"], state: "US" },
  { key: "clerk", name: "Office of the Clerk, U.S. House", url: "https://clerk.house.gov/", provides: ["House roll call votes", "House members"], state: "US", chamber: "House" },
  { key: "house-directory", name: "U.S. House directory", url: "https://directory.house.gov/", provides: ["House offices", "Staff"], state: "US", chamber: "House" },
  { key: "senate", name: "U.S. Senate", url: "https://www.senate.gov/", provides: ["Senate roll call votes", "Senators"], state: "US", chamber: "Senate" },
  { key: "lda", name: "Senate Office of Public Records", url: "https://lda.senate.gov/", provides: ["Lobbying disclosures"], state: "US", chamber: "Senate" },
  { key: "fec", name: "Federal Election Commission", url: "https://www.fec.gov/data/", provides: ["Campaign finance"], state: "US" },
  { key: "census", name: "U.S. Census Bureau, TIGER/Line", url: "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html", provides: ["District boundaries"], state: "US" },
]

const LEGISLATURE_HOSTS: Record<string, string> = {
  AK: "www.akleg.gov",
  AL: "alison.legislature.state.al.us",
  AR: "arkleg.state.ar.us",
  AZ: "apps.azleg.gov",
  CA: "leginfo.legislature.ca.gov",
  CO: "leg.colorado.gov",
  CT: "www.cga.ct.gov",
  DC: "lims.dccouncil.gov",
  DE: "legis.delaware.gov",
  FL: "www.flsenate.gov",
  GA: "www.legis.ga.gov",
  HI: "www.capitol.hawaii.gov",
  IA: "www.legis.iowa.gov",
  ID: "legislature.idaho.gov",
  IL: "www.ilga.gov",
  IN: "iga.in.gov",
  KS: "kslegislature.org",
  KY: "apps.legislature.ky.gov",
  LA: "www.legis.la.gov",
  MA: "malegislature.gov",
  MD: "mgaleg.maryland.gov",
  ME: "legislature.maine.gov",
  MI: "legislature.mi.gov",
  MN: "www.revisor.mn.gov",
  MO: "house.mo.gov",
  MS: "billstatus.ls.state.ms.us",
  MT: "bills.legmt.gov",
  NC: "www.ncleg.gov",
  ND: "ndlegis.gov",
  NE: "nebraskalegislature.gov",
  NH: "gc.nh.gov",
  NJ: "www.njleg.state.nj.us",
  NM: "www.nmlegis.gov",
  NV: "www.leg.state.nv.us",
  NY: "www.nysenate.gov",
  OH: "www.legislature.ohio.gov",
  OK: "www.oklegislature.gov",
  OR: "olis.oregonlegislature.gov",
  PA: "www.palegis.us",
  RI: "status.rilegislature.gov",
  SC: "www.scstatehouse.gov",
  SD: "sdlegislature.gov",
  TN: "wapp.capitol.tn.gov",
  TX: "capitol.texas.gov",
  UT: "le.utah.gov",
  VA: "lis.virginia.gov",
  VT: "legislature.vermont.gov",
  WA: "app.leg.wa.gov",
  WI: "docs.legis.wisconsin.gov",
  WV: "www.wvlegislature.gov",
  WY: "www.wyoleg.gov",
}

export const STATES: Source[] = Object.entries(LEGISLATURE_HOSTS).map(([state, host]) => {
  const law = PUBLISHERS[state]
  return {
    key: state.toLowerCase(),
    name: STATE_NAMES[state] ?? state,
    url: `https://${host}/`,
    provides: ["Bills", "Bill text", "Votes", ...(law ? ["Statutes"] : [])],
    state,
  }
})

/** A state's law publisher, where its statutes are loaded and it is not the legislature's own site. */
export const LAW_PUBLISHERS: Source[] = Object.entries(PUBLISHERS)
  .filter(([state]) => state !== "US")
  .map(([state, p]) => ({ key: `law-${state.toLowerCase()}`, name: p.name.replace(/^the /, ""), url: p.url, provides: [`${STATE_NAMES[state] ?? state} statutes`], state }))

export const SERVICES: Source[] = [
  { key: "legiscan", name: "LegiScan", url: "https://legiscan.com/", provides: ["State bill status, where a legislature publishes none"] },
  { key: "youtube", name: "YouTube", url: "https://www.youtube.com/", provides: ["Committee video"] },
]
