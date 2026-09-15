import { PUBLISHERS } from "@/lib/laws-publishers"
import { STATE_NAMES } from "@/lib/filters"
import NEWS_FEEDS from "@/lib/data/news-feeds.json"

// Every source GovBlock reads (Brendan, 2026-09-15): the /sources gallery, in
// place of the "Source:" line each record page used to end with. The federal
// offices are the ones the loaders call; each state's legislature is the host
// its own bill links point to (the most common "Bills".state_link host of the
// 2023 sessions on, read 2026-09-15); a state's law comes from its publisher
// in lib/laws-publishers.ts where one is loaded. The agencies are the ones the
// "Forms" table holds fetched PDFs from, the news outlets the active feeds in
// lib/data/news-feeds.json, and the APIs the ones that supplied rows.

export type Source = {
  key: string
  name: string
  url: string
  /** What GovBlock takes from it. */
  provides: string[]
  /** A jurisdiction's flag, or a chamber's seal. */
  state?: string
  chamber?: "House" | "Senate"
  /** An office's own seal or a service's logo, from public/. */
  image?: string
  /** An agency the "Forms" table files under, for its seal. */
  form?: { gov: string; agency: string }
}

export const FEDERAL: Source[] = [
  { key: "congress", name: "Library of Congress, congress.gov", url: "https://www.congress.gov/", provides: ["Bills", "Actions", "Sponsors", "Amendments", "Summaries", "Committees", "Committee reports", "Nominations", "Hearings", "Treaties", "Members", "Congressional Record", "CRS reports", "CBO cost estimates"], state: "US" },
  { key: "govinfo", name: "U.S. Government Publishing Office, GovInfo", url: "https://www.govinfo.gov/", provides: ["Bill text", "Bill status XML", "Public laws"], state: "US" },
  { key: "uscode", name: "Office of the Law Revision Counsel", url: "https://uscode.house.gov/", provides: ["United States Code"], state: "US" },
  { key: "clerk", name: "Office of the Clerk, U.S. House", url: "https://clerk.house.gov/", provides: ["House roll call votes", "House members", "Member photos"], state: "US", chamber: "House" },
  { key: "house-directory", name: "U.S. House directory", url: "https://directory.house.gov/", provides: ["House offices", "Staff"], state: "US", chamber: "House" },
  { key: "senate", name: "U.S. Senate", url: "https://www.senate.gov/", provides: ["Senate roll call votes", "Senators", "Senate offices"], state: "US", chamber: "Senate" },
  { key: "congress-legislators", name: "unitedstates/congress-legislators", url: "https://github.com/unitedstates/congress-legislators", provides: ["Committee membership"], state: "US" },
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
    provides: ["Bills", "Bill text", "Votes", "Legislator photos", ...(law ? ["Statutes"] : [])],
    state,
  }
})

/** A state's law publisher, where its statutes are loaded and it is not the legislature's own site. */
export const LAW_PUBLISHERS: Source[] = Object.entries(PUBLISHERS)
  .filter(([state]) => state !== "US")
  .map(([state, p]) => ({ key: `law-${state.toLowerCase()}`, name: p.name.replace(/^the /, ""), url: p.url, provides: [`${STATE_NAMES[state] ?? state} statutes`], state }))

export const MONEY: Source[] = [
  { key: "fec", name: "Federal Election Commission", url: "https://www.fec.gov/data/", provides: ["Candidates", "Committees", "Contributions", "Independent expenditures", "Receipts by state, size and employer"], image: "/seals/federal-election-commission.avif" },
  { key: "lda", name: "Senate Office of Public Records, Lobbying Disclosure", url: "https://lda.senate.gov/", provides: ["Lobbying registrations", "Lobbying reports"], state: "US", chamber: "Senate" },
  { key: "followthemoney", name: "FollowTheMoney, OpenSecrets", url: "https://www.followthemoney.org/", provides: ["State campaign finance", "Top contributors", "Contributor sectors"] },
  { key: "ny-coelig", name: "New York Commission on Ethics and Lobbying in Government", url: "https://ethics.ny.gov/", provides: ["New York lobbyists", "Clients", "Compensation"], state: "NY" },
  { key: "ny-openbook", name: "New York State Comptroller, Open Book New York", url: "https://www.openbooknewyork.com/", provides: ["State contracts"], state: "NY" },
  { key: "ny-budget", name: "New York Division of the Budget, Open Budget", url: "https://openbudget.ny.gov/", provides: ["Appropriations", "Spending", "Receipts"], state: "NY" },
]

const agency = (gov: string, agency: string, name: string, url: string): Source => ({ key: `form-${gov}-${agency}`.toLowerCase(), name, url, provides: ["Forms"], form: { gov, agency } })

export const FEDERAL_AGENCIES: Source[] = [
  agency("US", "DOL", "Department of Labor", "https://www.dol.gov/"),
  agency("US", "HUD", "Department of Housing and Urban Development", "https://www.hud.gov/"),
  agency("US", "CMS", "Centers for Medicare & Medicaid Services", "https://www.cms.gov/"),
  agency("US", "USDA-FNS", "USDA Food and Nutrition Service", "https://www.fns.usda.gov/"),
  agency("US", "GSA", "General Services Administration", "https://www.gsa.gov/"),
  agency("US", "SBA", "Small Business Administration", "https://www.sba.gov/"),
  agency("US", "IRS", "Internal Revenue Service", "https://www.irs.gov/"),
  agency("US", "ED", "Department of Education, Federal Student Aid", "https://studentaid.gov/"),
  agency("US", "VA", "Department of Veterans Affairs", "https://www.va.gov/"),
  agency("US", "SSA", "Social Security Administration", "https://www.ssa.gov/"),
  agency("US", "USCIS", "Citizenship and Immigration Services", "https://www.uscis.gov/"),
  agency("US", "Grants.gov", "Grants.gov", "https://www.grants.gov/"),
  agency("US", "OPM", "Office of Personnel Management", "https://www.opm.gov/"),
]

export const NEW_YORK_AGENCIES: Source[] = [
  agency("NYS", "DTF", "Department of Taxation and Finance", "https://www.tax.ny.gov/"),
  agency("NYS", "DOH", "Department of Health", "https://www.health.ny.gov/"),
  agency("NYS", "DOL", "Department of Labor", "https://dol.ny.gov/"),
  agency("NYS", "HCR", "Homes and Community Renewal", "https://hcr.ny.gov/"),
  agency("NYS", "OCFS", "Office of Children and Family Services", "https://ocfs.ny.gov/"),
  agency("NYS", "OASAS", "Office of Addiction Services and Supports", "https://oasas.ny.gov/"),
  agency("NYS", "OTDA", "Office of Temporary and Disability Assistance", "https://otda.ny.gov/"),
  agency("NYS", "DMV", "Department of Motor Vehicles", "https://dmv.ny.gov/"),
  agency("NYS", "HESC", "Higher Education Services Corporation", "https://www.hesc.ny.gov/"),
  agency("NYS", "OMH", "Office of Mental Health", "https://omh.ny.gov/"),
  agency("NYC", "HPD", "NYC Housing Preservation and Development", "https://www.nyc.gov/site/hpd/"),
  agency("NYC", "HRA", "NYC Human Resources Administration", "https://www.nyc.gov/site/hra/"),
  agency("NYC", "DHS", "NYC Department of Homeless Services", "https://www.nyc.gov/site/dhs/"),
]

export const MODEL_LEGISLATION: Source[] = [
  { key: "alec", name: "American Legislative Exchange Council", url: "https://alec.org/model-policy/", provides: ["Model bills"] },
  { key: "cpi", name: "Center for Public Integrity", url: "https://github.com/PublicI/religious-freedom-bills-data", provides: ["Model bills", "State bill matches"] },
]

const NEWS_KIND: Record<string, string> = { statehouse: "Statehouse news", local: "Local news", wire: "Wire", governor: "Governor's office" }

export const NEWS: Source[] = (NEWS_FEEDS as { state: string; name: string; url: string; kind: string; active: boolean }[])
  .filter((feed) => feed.active && NEWS_KIND[feed.kind])
  .map((feed) => ({
    key: `news-${new URL(feed.url).host}`,
    // An outlet with two feeds ("The Hill — House", "The Hill — Senate") is one source.
    name: feed.kind === "governor" ? `Office of the Governor of ${STATE_NAMES[feed.state] ?? feed.state}` : feed.name.replace(/ — .*$/, ""),
    url: new URL(feed.url).origin + "/",
    provides: [NEWS_KIND[feed.kind] ?? feed.kind],
    state: feed.state,
  }))
  .filter((source, i, all) => all.findIndex((other) => other.key === source.key) === i)
  .sort((a, b) => (a.state === b.state ? a.name.localeCompare(b.name) : a.state === "US" ? -1 : b.state === "US" ? 1 : a.state!.localeCompare(b.state!)))

export const MAPS: Source[] = [
  { key: "census", name: "U.S. Census Bureau, TIGER/Line", url: "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html", provides: ["District boundaries"], state: "US" },
  { key: "census-geocoder", name: "U.S. Census Bureau, Geocoder", url: "https://geocoding.geo.census.gov/", provides: ["Address to district"], state: "US" },
  { key: "tigerweb", name: "U.S. Census Bureau, TIGERweb", url: "https://tigerweb.geo.census.gov/", provides: ["Map overlays"], state: "US" },
  { key: "openfreemap", name: "OpenFreeMap", url: "https://openfreemap.org/", provides: ["Base map"] },
]

export const SERVICES: Source[] = [
  { key: "legiscan", name: "LegiScan", url: "https://legiscan.com/", provides: ["Bulk session datasets", "Nightly bill status", "State bill status, where a legislature publishes none"], image: "/sources/legiscan.png" },
  { key: "youtube", name: "YouTube Data API", url: "https://developers.google.com/youtube/v3", provides: ["Committee hearing video", "Clips"], image: "/sources/youtube.webp" },
  { key: "internet-archive", name: "Internet Archive, Wayback Machine", url: "https://web.archive.org/", provides: ["Forms an agency has taken down"] },
  { key: "newsapi", name: "NewsAPI", url: "https://newsapi.org/", provides: ["News stories"] },
  { key: "gnews", name: "GNews", url: "https://gnews.io/", provides: ["News stories"] },
  { key: "newsapiai", name: "NewsAPI.ai, Event Registry", url: "https://newsapi.ai/", provides: ["News stories"] },
  { key: "newsdata", name: "NewsData.io", url: "https://newsdata.io/", provides: ["News stories"] },
  { key: "thenewsapi", name: "TheNewsAPI", url: "https://www.thenewsapi.com/", provides: ["News stories"] },
  { key: "exa", name: "Exa", url: "https://exa.ai/", provides: ["News stories", "Web search for the agents"] },
  { key: "tavily", name: "Tavily", url: "https://www.tavily.com/", provides: ["Web search for the agents", "Page reading"] },
]
