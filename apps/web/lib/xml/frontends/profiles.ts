import type { StateProfile } from "./generic"

// One profile per state (program brief, "The compiler": fifty front ends).
// A profile is what a state's printed bill signals; the generic front end
// does the rest. The first six were read from the corpus on 2026-09-14; the
// remainder start from the common form and are corrected as their coverage
// line says where they fall out.

const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
}

/** The common form: "Be it enacted …", "Section 1." or "SECTION 1." or "Sec. 1.", quoted law after "as follows:" or "to read:". */
const common = (jurisdiction: string): StateProfile => ({
  jurisdiction,
  name: STATES[jurisdiction] ?? jurisdiction,
  enacting: /\b(be it (further )?enacted|(hereby )?enacts? as follows|do enact as follows|ordained|enacted by the)\b/i,
  section: /^(?:SECTION|Section|SEC\.|Sec\.)\s*(\d{1,3}[A-Za-z]?)\.?\s*(.*)$/s,
  strict: false,
  quotesAfter: /(as follows|to read|read as follows|amended by adding|inserting|the following(?: \w+){0,3}|thereof)[:.]?-?$/i,
})

export const PROFILES: Record<string, StateProfile> = Object.fromEntries(Object.keys(STATES).map((k) => [k, common(k)]))

// Illinois: sections run 1, 5, 10 …; the capture carries the General
// Assembly site's translation chrome before the bill, which the enacting
// formula skips; quoted sections open "Sec. 1-15."
PROFILES.IL = {
  ...common("IL"),
  enacting: /Be it enacted by the People of the State of Illinois/i,
  section: /^Section\s+(\d{1,3}[A-Za-z]?)\.\s*(.*)$/s,
  quotedSection: /^Sec\.\s*([\d][\w.-]*)\.\s*(.*)$/s,
}

// Texas: "SECTION 1." for the bill, "Sec. 545.256." for the code it amends;
// subsections (a), subdivisions (1), paragraphs (A), subparagraphs (i).
PROFILES.TX = {
  ...common("TX"),
  enacting: /BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS/i,
  section: /^SECTION\s+(\d{1,3}[A-Za-z]?)\.\s*(.*)$/s,
  quotedSection: /^Sec\.\s*([\d][\w.-]*)\.\s*(.*)$/s,
}

// New Jersey: the bill's sections are bare digits, "1.", strictly in
// sequence, and so is the law it quotes; omitted matter in brackets.
PROFILES.NJ = {
  ...common("NJ"),
  enacting: /Be It Enacted by the Senate and General Assembly of the State of New Jersey/i,
  section: /^(\d{1,3})\.\s*(.*)$/s,
  strict: true,
  del: /\[([^\]]+)\]/,
}

// California: the Legislative Counsel's digest precedes the bill; "SECTION 1."
// then "SEC. 2."; quoted sections are a bare number, "1798.99.80."
PROFILES.CA = {
  ...common("CA"),
  enacting: /The people of the State of California do enact as follows/i,
  section: /^(?:SECTION|SEC\.)\s*(\d{1,3})\.\s*(.*)$/s,
  quotedSection: /^(\d{1,5}(?:\.\d+)*[a-z]?)\.\s+(?=[A-Z(“"])(.*)$/s,
}

// Pennsylvania: line numbers down the margin (stripped), "Section 1." for
// the bill, "§ 2102." for the statute, "* * *" for unchanged text left out,
// omitted matter in brackets.
PROFILES.PA = {
  ...common("PA"),
  enacting: /hereby enacts as follows/i,
  section: /^Section\s+(\d{1,3}(?:\.\d+)?)\.\s*(.*)$/s,
  quotedSection: /^§\s*([\w.-]+)\.\s*(.*)$/s,
  del: /\[([^\]]+)\]/,
}

// Massachusetts: a petition and docket furniture precede the bill; "SECTION 1."
PROFILES.MA = {
  ...common("MA"),
  enacting: /Be it enacted by the Senate and House of Representatives in General Court assembled/i,
  section: /^SECTION\s+(\d{1,3}[A-Za-z]?)\.\s*(.*)$/s,
  quotedSection: /^Section\s+(\d{1,3}[A-Za-z]?)\.\s*(.*)$/s,
}
