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
  enacting: /\b(be it (further )?enacted|(hereby )?enacts? as follows|do enact as follows|ordained|enacted by the|enacts?:)/i,
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
  del: /\[([^\]]+)\]/,
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
  quotedSection: /^(\d{1,5}(?:\.\d+)*[a-z]?)\.(?:\s+(?=[A-Z(“"])(.*)|\s*)$/s,
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

// Michigan: "the people of the state of michigan enact:" in lower case, then
// "Sec. 272." for the section of the act it amends.
PROFILES.MI = {
  ...common("MI"),
  enacting: /the people of the state of michigan enact:/i,
  quotedSection: /^Sec\.\s*([\d][\w.-]*)\.\s*(.*)$/s,
}

// North Carolina: "The General Assembly of North Carolina enacts:", quoted
// statute sections as "§ 160A-536." or "\"§ 160A-536."
PROFILES.NC = {
  ...common("NC"),
  enacting: /The General Assembly of North Carolina enacts:/i,
  quotedSection: /^"?§\s*([\w.-]+)\.\s*(.*)$/s,
}

// Oklahoma (window 8, read from fifty printings of every session): a number
// down the margin of every line, blank lines included, and a page footer
// ("Req. No. 11796 Page 1", "ENGR. H. B. NO. 2394 Page 1") with a drafting
// code ("60-1-11796 GRS 01/13/25") at the end. "SECTION 1. AMENDATORY 22 O.S.
// 2021, Section 461, is amended to read as follows:" or "SECTION 2. NEW LAW A
// new section of law … reads as follows:"; the quoted section opens "Section
// 461." or "Section 11-1401.2" with no full stop.
PROFILES.OK = {
  ...common("OK"),
  enacting: /BE IT ENACTED BY THE PEOPLE OF THE STATE OF OKLAHOMA/i,
  section: /^SECTION\s+(\d{1,3}[A-Za-z]?)\.\s*(.*)$/s,
  quotedSection: /^Section\s+(\d(?:[\w.-]*\w)?)\.?\s+(.*)$/s,
  quotesAfter: /(as follows|to read|reads as follows|read as follows)[:.]?-?$/i,
  marginNumbers: true,
  furniture: /^\s*(?:.{0,60}\bPage\s+\d+|\d{1,3}-\d-\d{2,6}\s+\S{1,6}\s+\d{1,2}\/\d{1,2}\/\d{2,4}|(?:UNDERLINED|BOLD FACE CAPITALIZED|Strike thru) language denotes .*|(?:HOUSE OF REPRESENTATIVES|SENATE) - FLOOR VERSION)\s*$/,
}

// Indiana statutes (window 8, from fifty sections of the Code): the loader
// writes "IC 6-3.6-7-9 Heading" as the first block, then an optional "Note:"
// on versions, then "Sec. 9." opening the body, then the history credit ("As
// added by P.L.243-2015, SEC.10. Amended by …"), with a recodification
// citation in brackets before it. Subsections (a), subdivisions (1), clauses
// (A), items (i).
PROFILES.IN = {
  ...common("IN"),
  statuteCite: /^IC\s+/,
  headingBlock: true,
  restated: /^Sec\.\s*[\w.-]+\.\s*/,
  credit: /^(?:As added by|As amended by|Amended by|Repealed by|Formerly:|\[(?:Pre-|\d{4} )[\w\s-]*Recodification Citation)/,
}

// Colorado bills (window 8, from fifty printings of every session): a third
// of the stored printings are the archive site's banner and report as error
// pages. The rest are the General Assembly's printed bill: margin numbers,
// the title's lines numbered from 101, a page number "-3- HB19-1312", the
// reading stamps down the right edge ("2nd Reading Unamended", "April 22,
// 2019", "SENATE") and the amendment legend ("Shading denotes HOUSE
// amendment. …"). "SECTION 1. In Colorado Revised Statutes, 25-4-902, amend
// (1); and add (6) as follows:" then "25-4-902. Catchline. (1) …". New matter
// in CAPITALS; struck matter is dashes the capture does not keep.
PROFILES.CO = {
  ...common("CO"),
  enacting: /Be it enacted by the General Assembly of the State of Colorado/i,
  section: /^SECTION\s+(\d{1,3})\.\s*(.*)$/s,
  quotedSection: /^(\d{1,2}(?:\.\d)?-\d{1,3}(?:\.\d{1,2})?-\d{1,4}(?:\.\d{1,2})?)\.\s+(.*)$/s,
  capsAreNew: true,
  marginNumbers: true,
  openersAtLineHead: true,
  furniture: /^(?:\s{40,}\S.{0,40}|\s*-\d{1,3}-\s+\S{1,12}|\s*(?:Shading denotes|Capital letters or bold|Dashes through the words) .*)\s*$/,
}

// Nevada statutes (window 8, from fifty sections of the NRS): the loader
// writes "NRS 33.090 Catchline" as the first block, then the law (subsections
// "1.", paragraphs "(a)", subparagraphs "(1)", sub-subparagraphs "(I)"), then
// the Legislative Counsel Bureau's source note: "(Added to NRS by 1985, 2286;
// A 1997, 1810)" or, for a section older than the NRS, "[Part 1:49:1883; …]—(NRS
// A 1971, 827)".
PROFILES.NV = {
  ...common("NV"),
  statuteCite: /^NRS\s+/,
  headingBlock: true,
  credit: /^(?:\(Added to NRS by\b|\((?:NRS )?A \d{4}\b|\[(?:Part \d|\d+:\d+:\d{4})|\(Substituted in revision\b)/,
}

// Kansas statutes (window 8, from fifty sections of the K.S.A.): the Revisor's
// section file as text, "21-5604." alone, the catchline as the next block
// ("Same; meetings; quorum." carries the article's subject forward), the law,
// then "History:" and the session laws ("L. 2010, ch. 136, § 81; July 1.").
// Numbers carry a comma where the article runs past 99 ("68-5,101.").
PROFILES.KS = {
  ...common("KS"),
  headingBlock: true,
  headingNext: true,
  creditStart: /^History:$/,
}

// Washington statutes (window 8, from fifty sections of the RCW): the loader
// writes "RCW 11.68.110 Catchline." as the first block, then the law, then the
// session laws in brackets ("[ 2021 c 140 s 4014; 2016 c 202 s 8. Prior: …]"),
// then "Notes:" and the Code Reviser's notes, one to a block. Subsections
// (1), paragraphs (a), subparagraphs (i), units of several ranks opening on
// one line, "(a)(i)".
PROFILES.WA = {
  ...common("WA"),
  statuteCite: /^RCW\s+/,
  headingBlock: true,
  credit: /^\[\s*\d{4}\b[\s\S]*\]\s*$/,
  notesStart: /^Notes:$/,
}

// Oregon statutes (window 8, from fifty sections of the ORS): the loader
// writes "701.625 Catchline" as the first block, or the number alone for a
// section repealed or renumbered, whose bracketed history is then its only
// text; units of several ranks open on one line, "(3)(a)(A)"; the Legislative
// Counsel's "Note: 536.605 was enacted into law … but was not added to …"
// closes a section left outside the series.
PROFILES.OR = {
  ...common("OR"),
  headingBlock: true,
  credit: /^Note:\s/,
  versionOpens: /^\d{1,3}[A-Za-z]?\.\d{1,4}[A-Za-z]?\.\s+/,
}

// Massachusetts: a petition and docket furniture precede the bill; "SECTION 1."
// Window 8, from fifty printings of every session: the captures before 2013
// hold the body alone, tab-indented, often one unnumbered section ("Chapter
// 127 … is hereby amended by inserting … the following section:" and then
// "197A." alone on its line); from 2017 the printed bill, its lines numbered
// straight through into the thousands, pages marked "7 of 92".
PROFILES.MA = {
  ...common("MA"),
  enacting: /Be it enacted by the Senate and House of Representatives in General Court assembled/i,
  section: /^SECTION\s+(\d{1,3}[A-Za-z]?)\.\s*(.*)$/s,
  quotedSection: /^(?:Section\s+|(?=\d{1,3}[A-Z]{0,2}\.$))(\d{1,3}[A-Za-z]{0,2})\.\s*(.*)$/s,
  marginNumbers: true,
  furniture: /^\s*\d{1,3} of \d{1,3}\s*$/,
  bodyOnly: true,
}
