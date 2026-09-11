// Where each jurisdiction publishes its own standing law.
//
// A jurisdiction whose law is not loaded yet still has a page, and that page
// has to say something true rather than "coming soon". This is what it says:
// who publishes the law, and where. The working survey behind it, with formats
// and rate limits, is docs/state-law-sources.md.

export type Publisher = {
  /** Who publishes it — the legislature's own office wherever there is one. */
  name: string
  url: string
  /**
   * Set where a commercial publisher sits between the legislature and the
   * reader. The statute is still public; what the vendor may own is the layer
   * it added, and that layer is not taken.
   */
  vendor?: string
  /**
   * The date the source itself states its text is current to — a release
   * point, a file's own date, a "current through" line. Set only where the
   * source says; a live API with nothing to say falls back to the day its rows
   * were last read, which the page works out for itself.
   *
   * Every loaded jurisdiction prints one of the two at the foot of its page,
   * because every one of them is a copy taken at a moment and a reader is
   * entitled to know which moment.
   */
  asOf?: string
}

export const PUBLISHERS: Record<string, Publisher> = {
  // Release point 119-103: Public Law 119-103, 2 September 2026.
  US: { name: "Office of the Law Revision Counsel", url: "https://uscode.house.gov/", asOf: "2026-09-02" },
  // The pubinfo archive's own Last-Modified: 7 September 2026.
  CA: { name: "California Legislative Counsel", url: "https://leginfo.legislature.ca.gov/", asOf: "2026-09-07" },
  NY: { name: "the New York State Senate", url: "https://legislation.nysenate.gov/" },
  // The Council's XML states its own recency: current through 7 October 2021.
  DC: { name: "the Council of the District of Columbia", url: "https://code.dccouncil.gov/", asOf: "2021-10-07" },
  MA: { name: "the Massachusetts General Court", url: "https://malegislature.gov/Laws/GeneralLaws" },
  TX: { name: "the Texas Legislative Council", url: "https://statutes.capitol.texas.gov/" },
  FL: { name: "the Florida Legislature", url: "https://www.flsenate.gov/Laws/Statutes" },
  WA: { name: "the Washington Code Reviser", url: "https://app.leg.wa.gov/RCW/" },
  VA: { name: "the Virginia Division of Legislative Automated Systems", url: "https://law.lis.virginia.gov/vacode" },
  OH: { name: "the Ohio Legislative Service Commission", url: "https://codes.ohio.gov/ohio-revised-code" },
  AZ: { name: "the Arizona Legislature", url: "https://www.azleg.gov/arstitle/" },
  DE: { name: "the Delaware General Assembly", url: "https://delcode.delaware.gov/" },
  CT: { name: "the Connecticut General Assembly", url: "https://www.cga.ct.gov/current/pub/titles.htm" },
  AK: { name: "the Alaska State Legislature", url: "https://www.akleg.gov/basis/statutes.asp" },
  CO: { name: "the Colorado General Assembly", url: "https://leg.colorado.gov/colorado-revised-statutes" },
  AL: { name: "the Alabama Legislature", url: "https://alison.legislature.state.al.us/code-of-alabama" },
  HI: { name: "the Hawaii State Legislature", url: "https://www.capitol.hawaii.gov/docs/hrs.htm" },
  GA: { name: "the Georgia General Assembly", url: "https://www.legis.ga.gov/legislation/ocga", vendor: "LexisNexis" },
  AR: { name: "the Arkansas General Assembly", url: "https://www.arkleg.state.ar.us/", vendor: "LexisNexis" },
  IL: { name: "the Illinois General Assembly", url: "https://www.ilga.gov/" },
  MI: { name: "the Michigan Legislature", url: "https://www.legislature.mi.gov/" },
}
