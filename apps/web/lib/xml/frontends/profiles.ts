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

// Vermont bills (window 8, from fifty printings of every session): the
// Legislative Counsel's printed bill, a line number down the margin, a running
// head "BILL AS INTRODUCED H.429" over "2023 Page 1 of 10", a foot
// "VT LEG #366703 v.4". "It is hereby enacted by the General Assembly of the
// State of Vermont:", "* * * Sore Loser Law * * *" over a group of sections,
// "Sec. 1. 17 V.S.A. § 2381(c) is added to read:" and the quoted section
// "§ 2401. APPLICABILITY OF SUBCHAPTER". Resolutions "Resolved by the Senate:";
// short-form bills carry "(TEXT OMITTED IN SHORT-FORM BILLS)" and no sections.
PROFILES.VT = {
  ...common("VT"),
  enacting: /It is hereby enacted by the General Assembly of the State of Vermont/i,
  quotedSection: /^§\s*(\d[\w.-]*[\w])\.\s*(.*)$/s,
  marginNumbers: true,
  furniture: /^\s*(?:VT LEG #\d+ v\.\d+.*|BILL AS (?:INTRODUCED|PASSED BY THE (?:HOUSE|SENATE)(?: AND (?:HOUSE|SENATE))?)(?: AND AS AMENDED)?\s+[HSJR.\d ]+|\d{4}\s+Page \d+ of \d+|R-\d+\s+Page \d+ of \d+\s+\d{4}|Page \d+ of \d+)\s*$/,
}

// New Mexico bills (window 8, from fifty printings of every session): the
// Legislative Council Service's printed bill as text, a line number set
// thirty-two spaces in (1 to 25 a page), the legend "[bracketed material] =
// delete" and "underscored material = new" beside every page, a drafting code
// ".202884.1" and a page number "- 2 -". "BE IT ENACTED BY THE LEGISLATURE OF
// THE STATE OF NEW MEXICO:", "SECTION 1. APPROPRIATION.--…", quoted law after
// "is amended to read:" opening "\"52-1-1.1. DEFINITIONS.--"; memorials and
// resolutions "WHEREAS, …" and "NOW, THEREFORE, BE IT RESOLVED …". Units A.,
// (1), (a); struck matter in brackets.
PROFILES.NM = {
  ...common("NM"),
  enacting: /BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF NEW MEXICO/i,
  section: /^SECTION\s+(\d{1,3}[A-Z]?)\.\s*(.*)$/s,
  quotedSection: /^["“]?(\d{1,2}[A-Z]?-\d{1,3}[A-Z]?-\d{1,4}(?:\.\d{1,2})?)\.\s+(.*)$/s,
  del: /\[([^\]]+)\]/,
  lowerAfterCapital: true,
  marginNumbers: true,
  marginIndent: true,
  furniture: /^\s*(?:\[bracketed material\] = delete|underscored material = new|\.\d{5,7}\.\d{1,2}[A-Za-z]{0,3}|-\s*\d{1,3}\s*-)\s*$/,
}

// New Hampshire bills (window 8, from fifty printings of every session): the
// General Court's web text, the docket and "ANALYSIS" first, "Explanation:
// Matter added to current law appears in bold italics. Matter removed …
// appears [in brackets and struckthrough.]", then "Be it Enacted by the Senate
// and House of Representatives in General Court convened:" and sections that
// are a bare number and a catchline, "1 Voter; Office Holder. Amend RSA 654:1,
// I to read as follows:", strictly 1, 2, 3. The RSA it quotes opens a section
// "654:1" or "21-I:5" and numbers paragraphs in roman, "I.", subparagraphs
// "(a)", items "(1)".
PROFILES.NH = {
  ...common("NH"),
  enacting: /Be it Enacted by the Senate and House of Representatives in General Court convened/i,
  section: /^(\d{1,3})\s+(?=[A-Z])(.*)$/s,
  strict: true,
  quotedSection: /^(\d{1,3}(?:-[A-Z])?:\d{1,3}(?:-[a-z])?)\s+(.*)$/s,
  del: /\[([^\]]+)\]/,
  romanDot: true,
  // The web text never wraps a paragraph, so a unit at a line's head is a unit ("…; and" then "III.").
  openersAtLineHead: true,
  // A chaptered law ("CHAPTER 55", the final version) numbers its sections "55:1", "55:2": the
  // chapter's own prefix is taken off so they read as 1, 2; a quoted "654:1" or "204-C:8-b" is left.
  prepare: (text) => {
    const chapter = /^\s*CHAPTER\s+(\d{1,4})\b/.exec(text)?.[1]
    return chapter ? text.replace(new RegExp(`^(\\s*)${chapter}:(\\d{1,3})(?=\\s)`, "gm"), "$1$2") : text
  },
}

// Kentucky bills (window 8, from fifty printings of every session): the
// Legislative Research Commission's printed bill, a line number down the
// margin (1 to 27 a page), a running head "UNOFFICIAL COPY 21 RS BR 104", a
// foot "Page 1 of 20" with "XXXX Jacketed" or a drafting code
// "SB009410.100 - 852 - XXXX GA". "Section 1." or "SECTION 1. A NEW SECTION
// OF KRS CHAPTER 120 IS CREATED TO READ AS FOLLOWS:" then the KRS section's
// units, (1) (a) 1. a.
PROFILES.KY = {
  ...common("KY"),
  enacting: /Be it enacted by the General Assembly of the Commonwealth of Kentucky/i,
  // The older captures carry a stray mark before the opener: "®SECTION 1.".
  section: /^®?(?:SECTION|Section|SEC\.|Sec\.)\s*(\d{1,3}[A-Za-z]?)\.?\s*(.*)$/s,
  marginNumbers: true,
  furniture: /^\s*(?:UNOFFICIAL COPY\b.*|Page \d+ of \d+|XXXX\s+\S+|[A-Z]{2,3}\d{5,7}\.\d{3}\s+-\s+\d+\s+-\s+\S+.*)\s*$/,
}

// South Carolina statutes (window 8, from fifty sections of the Code of Laws):
// the Legislative Council's chapter page as the loader writes it, "SECTION
// 58-27-2760. Catchline" as the first block, the law, then one block "HISTORY:
// 1962 Code SECTION 65-1675; 1952 Code …". Subsections (A), items (1),
// subitems (a), sub-subitems (i), the Council's own words for its ranks.
PROFILES.SC = {
  ...common("SC"),
  statuteCite: /^SECTION\s+/,
  headingBlock: true,
  credit: /^HISTORY:\s/,
}

// Louisiana statutes (window 8, from fifty sections of the Revised Statutes
// and codes): the Legislature's document page as text, "RS 48:1402" (or CC,
// CCP, CCRP, CE, CHC, CONST) alone, then "§1402. Authority of commission",
// then the law, then its history ("Acts 1968, No. 232, §2. Amended by …",
// "Added by Acts 1968, No. 16, §4 …").
PROFILES.LA = {
  ...common("LA"),
  statuteCite: /^(?:RS|CC|CCP|CCRP|CE|CHC|CONST(?:-AN)?)\s+/,
  headingBlock: true,
  headingNext: true,
  restated: /^(?:§+|Art\.)\s*[\w.:-]+\.\s*/,
  credit: /^(?:Acts \d{4}\b|Added by Acts\b|Amended by Acts\b|Redesignated\b|Acts No\.|\{\{NOTE:)/,
}

// Utah bills (window 8, from fifty printings of every session): half the
// stored printings are a firewall's refusal and report as error pages. The
// rest are the Legislature's printed bill: its lines numbered straight through,
// a page number "-4-", a running head and foot with the printing's date and
// time and the bill ("02-05 09:17 1st Sub. (Buff) H.B. 274"), the bar code
// "*SB0169S03*", the bill number set against the right margin. "Section 1.
// Section 10-8-22 is amended to read:" then "10-8-22 . Water rates." (a space
// before the full stop from 2025) and the section's units, (1) (a) (i) (A);
// struck matter in brackets, "[and]".
PROFILES.UT = {
  ...common("UT"),
  enacting: /Be it enacted by the Legislature of the state of Utah/i,
  section: /^Section\s+(\d{1,3})\.\s+(.*)$/s,
  quotedSection: /^(\d{1,2}[A-Z]?-\d{1,3}[a-z]?-\d{1,4}(?:\.\d{1,2})?)\s?\.\s+(.*)$/s,
  del: /\[([^\]]+)\]/,
  marginNumbers: true,
  openersAtLineHead: true,
  furniture: /^(?:\s{30,}\S.{0,40}|\s*-\d{1,3}-|\s*\*[A-Z]{2,3}\d{3,4}\w*\*|.*\b\d{1,2}:\d{2}\b.*\b[HS]\.\s?[BJCR]\.(?:R\.)?\s?\d+.*|.*\b[HS]\.\s?[BJCR]\.(?:R\.)?\s?\d+.*\b\d{1,2}:\d{2}\b.*|\s*LEGISLATIVE GENERAL COUNSEL.*|\s*\d?\s*Approved for Filing:.*)\s*$/,
}

// Maryland statutes (window 8, from fifty sections of the Annotated Code):
// the General Assembly's section page as text, "§16–702." alone (an en dash,
// not a hyphen; "§21–2A–03."), no catchline, then the law: subsections (a),
// paragraphs (1), subparagraphs (i), sub-subparagraphs 1. and 2., often
// opening on one line, "(a) (1) In this section …".
PROFILES.MD = {
  ...common("MD"),
  statuteCite: /^§\s*/,
  headingBlock: true,
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
