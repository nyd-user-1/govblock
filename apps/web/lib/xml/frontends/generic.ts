import { node, tidy, type FrontEnd, type FrontEndResult, type IrChild, type IrNode, type Source } from "../ir"

// The generic state front end: one parser, a profile per jurisdiction. Every
// state's printed bill is the same shape under its own surface syntax: a
// preface, an enacting formula, sections, and inside a section either the
// bill's own words or the law it quotes. What differs is how each state
// signals those, and that is the profile: the enacting formula, the bill
// section opener, whether sections run strictly 1, 2, 3, how a quoted
// section opens, what introduces quoted law, and how omitted and new matter
// are marked. The hierarchy below a section is read by rank as it appears,
// a new enumerator style opening one level below the one that is open, and
// the USLM element for that rank is used with no role, since the state's
// own word for the rank is not known until its grammar is written by hand.

export type StateProfile = {
  jurisdiction: string
  name: string
  /** The enacting formula: where the preface ends and the main body begins. */
  enacting: RegExp
  /** A bill section opener at the start of a block; group 1 is the number. */
  section: RegExp
  /** Bill sections run 1, 2, 3 and a section-looking block out of sequence is quoted law. */
  strict: boolean
  /** Inside quoted law, a section opener; group 1 is the number. */
  quotedSection?: RegExp
  /** An instruction that introduces quoted law ("… is amended to read as follows:"). */
  quotesAfter: RegExp
  /** Omitted matter, as a capturing pattern; New York, New Jersey and Pennsylvania bracket it. */
  del?: RegExp
  /** New matter in CAPITALS (New York's convention in a text capture). */
  capsAreNew?: boolean
  /** A line number down the margin of every line, blank lines too (Oklahoma): always stripped, not by share. */
  marginNumbers?: boolean
  /** Page furniture, whole lines dropped before blocks are read: a running footer, a drafting code. */
  furniture?: RegExp
  /** The capture may hold the body alone, no title and no formula; an act with no section opener is one unnumbered section. */
  bodyOnly?: boolean
  /** Statutes: the citation before a section's number ("IC 6-3.6-7-9"), removed before the number is read. */
  statuteCite?: RegExp
  /** Statutes: the first block is the number and the whole heading, however long, verbs and all. */
  headingBlock?: boolean
  /** Statutes: the number said again where the body opens ("Sec. 9. (a) …"), removed once. */
  restated?: RegExp
  /** Statutes: a section printed a second time as it will read on a later date, opening on its own number ("109.206. (1) …"). */
  versionOpens?: RegExp
  /** Statutes: the history credit closing a section ("As added by P.L.2-2006, SEC.163."), kept as sourceCredit. */
  credit?: RegExp
}

const RANK_TAG = ["subsection", "paragraph", "subparagraph", "clause", "subclause", "item", "subitem"] as const

// ---------------------------------------------------------------- blocks ---

// "(2-a)" and "(b-1)" are insertions between numbered units; they open a block too.
const ENUM_OPEN = /^(?:\(\s*[0-9A-Za-z]{1,4}(?:[.-][0-9A-Za-z]{1,2})?\s*\)|[0-9]{1,3}(?:[.-][0-9A-Za-z]{1,2})?\.|[A-Za-z]\.|(?:SUBCHAPTER|CHAPTER|ARTICLE|SUBTITLE|TITLE|PART|SUBPART|DIVISION)\s+[\w.-]+)\s+/
/** The enacting formula alone, when it shares a block with the title before it or the first section after it. */
const ENACTING_SENTENCE = /(be it (?:further )?enacted|(?:hereby )?enacts? as follows|do enact as follows|enacted by the)[^:.]*[:.]?/i
const isOpener = (line: string, p: StateProfile) => p.section.test(line) || (p.quotedSection?.test(line) ?? false) || ENUM_OPEN.test(line) || /^\*\s*\*\s*\*/.test(line)

/** Line numbers down the left margin, as Pennsylvania prints them: stripped when most lines carry one. */
function stripLineNumbers(text: string): string {
  const lines = text.split("\n")
  // Pennsylvania: two or more spaces after the number; Illinois: one. A
  // number followed by a full stop or a parenthesis is an enumerator, not a
  // line number, and stays.
  const LINE_NUMBER = /^\s{0,3}\d{1,2}\s+(?![\d.)])\S/
  const numbered = lines.filter((l) => LINE_NUMBER.test(l)).length
  if (numbered < lines.length * 0.3) return text
  return lines.map((l) => (LINE_NUMBER.test(l) ? l.replace(/^\s{0,3}\d{1,2}\s+/, "   ") : l)).join("\n")
}

const clean = (text: string) => text.replace(/�| /g, " ").replace(/\r/g, "")

/**
 * Oklahoma and Kentucky reach us with their line numbers as loose tokens in
 * running text ("… 2 Be it enacted … 3 Section 1. KRS …"): the newlines were
 * lost in the capture. When thirty or more small numbers appear in ascending
 * runs (restarting at 1 on each page), they are line numbers and are dropped,
 * and a block boundary is put back before each section or enumerator that
 * follows a sentence end.
 */
function unwrapInlineLineNumbers(text: string): string {
  if (text.split("\n").length > 40) return text
  const re = /(^|\s)(\d{1,2})(?=\s)/g
  const found: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) found.push(Number(m[2]))
  if (found.length < 30) return text
  let runs = 0
  for (let i = 1; i < found.length; i++) if (found[i] === found[i - 1] + 1 || found[i] === 1) runs++
  if (runs < found.length * 0.8) return text
  let expected = 1
  const stripped = text.replace(/(^|\s)(\d{1,2})(?=\s)/g, (all, lead: string, num: string) => {
    const n = Number(num)
    if (n === expected || (n === 1 && expected > 3)) {
      expected = n + 1
      return lead
    }
    return all
  })
  return stripped.replace(/([.;:])\s+(?=(?:SECTION|Section|SEC\.|Sec\.)\s+\d|\(?[0-9A-Za-z]{1,4}[.)]\s+[A-Z(])/g, "$1\n\n   ")
}

/**
 * Texas and a few others print a blank line after every line, so a blank
 * line means nothing there; when most lines are followed by one, the blanks
 * are dropped and blocks open on openers and indentation alone.
 */
function dropBlankPerLine(text: string): string {
  const lines = text.split("\n")
  const blank = lines.filter((l) => !l.trim()).length
  const full = lines.length - blank
  if (full < 20 || blank < full * 0.7) return text
  return lines.filter((l) => l.trim()).join("\n")
}

/**
 * Wrapped lines back into blocks. A block opens at a blank line, or at a line
 * that opens with a section or an enumerator when the line before ended a
 * sentence or the line is indented; anything else continues the block.
 */
export function stateBlocks(text: string, p: StateProfile): string[] {
  const out: string[] = []
  // Lines are collected and joined once at the close (see ny.ts's blocksOf).
  let current: string[] = []
  let prevEnded = true
  const close = () => {
    const t = tidy(current.join(" "))
    if (t) out.push(t)
    current = []
  }
  let lines = unwrapInlineLineNumbers(clean(text))
  // Oklahoma's older captures space the margin number's digits apart ("1 0", "2 4"); Massachusetts numbers a bill's lines straight through, into the thousands.
  if (p.marginNumbers) lines = lines.split("\n").map((l) => l.replace(/^\s{0,3}(?:\d \d|\d{1,4})(?=\s|$)/, "")).join("\n")
  if (p.furniture) lines = lines.split("\n").filter((l) => !p.furniture!.test(l)).join("\n")
  for (const raw of dropBlankPerLine(p.marginNumbers ? lines : stripLineNumbers(lines)).split("\n")) {
    const stripped = raw.trim()
    if (!stripped) {
      close()
      prevEnded = true
      continue
    }
    const indent = raw.length - raw.trimStart().length
    // A wrapped instruction can land an enumerator at the head of a
    // continuation line ("… adding Subsection" / "(f) to read as follows:"),
    // so an opener closes the block only after a sentence ended, or on the
    // deeper indent a new paragraph gets (three spaces or more).
    // Under margin numbers every line is indented alike; a lettered or numbered item ("a.", "12.")
    // at a line's head is an item there, since running prose does not wrap onto one.
    const dotItem = !!p.marginNumbers && /^(?:[a-z]|\d{1,3})\.\s+\S/.test(stripped)
    if (isOpener(stripped, p) && (prevEnded || indent >= 3 || dotItem)) close()
    const last = current.length - 1
    if (last >= 0 && current[last].endsWith("-") && /^[a-z]/.test(stripped)) current[last] = current[last].slice(0, -1) + stripped
    else current.push(stripped)
    prevEnded = /[.:;]$/.test(stripped)
  }
  close()
  return out
}

// ----------------------------------------------------------------- marks ---

function marksFor(p: StateProfile) {
  return (text: string): IrChild[] => {
    const out: IrChild[] = []
    const parts = p.del ? text.split(p.del) : [text]
    parts.forEach((part, i) => {
      if (!part) return
      if (p.del && i % 2 === 1) {
        out.push(node("del", {}, [part]))
        return
      }
      if (!p.capsAreNew) {
        out.push(part)
        return
      }
      let run: string[] = []
      let plain = ""
      const flush = () => {
        if (!run.length) return
        const joined = run.join("")
        if (run.some((t) => /[A-Z]{2,}/.test(t))) {
          if (plain) out.push(plain)
          plain = ""
          out.push(node("ins", {}, [joined]))
        } else plain += joined
        run = []
      }
      for (const t of part.split(/(\s+)/)) {
        const caps = !/[a-z]/.test(t) && /[A-Z]/.test(t)
        if (caps || (run.length && /^\s+$/.test(t))) run.push(t)
        else {
          flush()
          plain += t
        }
      }
      flush()
      if (plain) out.push(plain)
    })
    return out
  }
}

// ------------------------------------------------------------ enumerators ---

type Style = "1." | "(1)" | "(a)" | "a." | "(i)" | "(A)" | "A." | "(I)" | "(a.1)"
type Enumerator = { style: Style; label: string; ordinal: number; rest: string; inserted: boolean }

const romanToInt = (s: string) => {
  const v: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 }
  let n = 0
  const t = s.toLowerCase()
  for (let i = 0; i < t.length; i++) {
    const a = v[t[i]]
    const b = v[t[i + 1]] ?? 0
    n += a < b ? -a : a
  }
  return n
}
const alphaToInt = (s: string) => {
  let n = 0
  for (const ch of s.toLowerCase()) n = n * 26 + (ch.charCodeAt(0) - 96)
  return n
}

/** A label with a hyphenated suffix ("2-a", "b-1") is a unit inserted after the one it names. */
const split = (label: string) => {
  const m = /^([0-9A-Za-z]+)(?:-([0-9A-Za-z]{1,2}))?$/.exec(label)
  return { base: m?.[1] ?? label, inserted: !!m?.[2] }
}

function enumerator(block: string, expectRoman: boolean, letter = false): Enumerator | null {
  // "(1)(a) Notwithstanding …", "(3)(a)(A) At the election …": units of three ranks opening on
  // one line with no space between them (Oregon, Washington); the first is read and the rest carried.
  block = block.replace(/^(\(\s*[0-9A-Za-z]{1,4}(?:[.-][0-9A-Za-z]{1,2})?\s*\))(?=\([0-9A-Za-z])/, "$1 ")
  let m =/^(\d{1,3}(?:-[a-z]{1,2})?)\.\s+(.*)$/s.exec(block)
  if (m) return { style: "1.", label: m[1], ordinal: Number(split(m[1]).base), rest: m[2], inserted: split(m[1]).inserted }
  block = block.replace(/^\(\s+([0-9A-Za-z.-]{1,6})\s+\)/, "($1)")
  m = /^\((\d{1,3}(?:-[a-z]{1,2})?)\)\s+(.*)$/s.exec(block)
  if (m) return { style: "(1)", label: m[1], ordinal: Number(split(m[1]).base), rest: m[2], inserted: split(m[1]).inserted }
  m = /^\(([a-z])\.(\d{1,2})\)\s+(.*)$/s.exec(block)
  if (m) return { style: "(a.1)", label: `${m[1]}.${m[2]}`, ordinal: alphaToInt(m[1]) * 100 + Number(m[2]), rest: m[3], inserted: false }
  m = /^\(([a-z]{1,4}(?:-\d{1,2})?)\)\s+(.*)$/s.exec(block)
  if (m) {
    const { base, inserted } = split(m[1])
    if (base.length <= 2 || /^[ivxl]+$/.test(base)) {
      const roman = !letter && /^[ivxl]+$/.test(base) && (expectRoman || !/^[a-h]$/.test(base))
      return roman ? { style: "(i)", label: m[1], ordinal: romanToInt(base), rest: m[2], inserted } : { style: "(a)", label: m[1], ordinal: alphaToInt(base), rest: m[2], inserted }
    }
  }
  m = /^\(([A-Z]{1,4}(?:-\d{1,2})?)\)\s+(.*)$/s.exec(block)
  if (m) {
    const { base, inserted } = split(m[1])
    if (base.length <= 2 || /^[IVXL]+$/.test(base)) {
      const roman = /^[IVXL]+$/.test(base) && (expectRoman || !/^[A-H]$/.test(base))
      return roman ? { style: "(I)", label: m[1], ordinal: romanToInt(base), rest: m[2], inserted } : { style: "(A)", label: m[1], ordinal: alphaToInt(base), rest: m[2], inserted }
    }
  }
  m = /^([a-z])\.\s+(?=\S)(.*)$/s.exec(block)
  if (m) return { style: "a.", label: m[1], ordinal: alphaToInt(m[1]), rest: m[2], inserted: false }
  // "B. 1. Notwithstanding …": a subsection whose first paragraph opens on its line (Oklahoma, Arizona).
  m = /^([A-Z])\.\s+(?=[A-Z(]|\d{1,3}\.\s)(.*)$/s.exec(block)
  if (m) return { style: "A.", label: m[1], ordinal: alphaToInt(m[1]), rest: m[2], inserted: false }
  return null
}

// ------------------------------------------------------------- hierarchy ---

/**
 * Enumerated blocks into levels by the rank they appear at: a style already
 * open is a sibling at its rank; a new style opens one rank below the open
 * one. Sequence is checked between siblings of one style outside quoted law.
 */
function nest(blocks: string[], problems: string[], inline: (t: string) => IrChild[], quoted: boolean): IrNode[] {
  const out: IrNode[] = []
  type Open = { style: Style; rank: number; node: IrNode; last: number }
  const stack: Open[] = []
  const container = () => (stack.length ? stack[stack.length - 1].node : ({ children: out } as IrNode))
  // A cursor, not shift and unshift: a budget bill is tens of thousands of
  // blocks, and shifting an array that size on every block is quadratic
  // (ninety seconds at sixty thousand; the pipeline's watchdog cut it off).
  let i = 0
  let carry: string | null = null
  while (carry !== null || i < blocks.length) {
    const block = carry !== null ? carry : blocks[i++]
    carry = null
    if (/^\*\s*\*\s*\*$/.test(block)) {
      container().children.push(node("p", { role: "ellipsis" }, ["* * *"]))
      continue
    }
    const top = stack[stack.length - 1]
    const expectRoman = !!top && (top.style === "(a)" || top.style === "(A)") && top.last !== 8
    // "(i)", "(v)" or "(x)" right after "(h)", "(u)" or "(w)" of a lettered rank that is still open
    // under a deeper one: the next letter when the next lettered block is its successor ("(j)"),
    // a numeral when it is "(ii)".
    let letter = false
    const amb = /^\(\s*([ivx])\s*\)\s/.exec(block)
    const letters = amb ? stack.find((s) => s.style === "(a)") : undefined
    if (amb && letters && alphaToInt(amb[1]) === letters.last + 1) {
      const successor = String.fromCharCode(amb[1].charCodeAt(0) + 1)
      for (let k = i; k < Math.min(blocks.length, i + 60); k++) {
        const next = /^\(\s*([a-z]{1,4})\s*\)\s/.exec(blocks[k])
        if (!next) continue
        if (next[1] === successor) letter = true
        if (next[1] === successor || /^[ivx]+$/.test(next[1])) break
      }
    }
    const e = enumerator(block, expectRoman, letter)
    if (!e) {
      if (ENUM_OPEN.test(block)) problems.push(`unmatched enumerator: ${block.slice(0, 40)}`)
      if (top) top.node.children.push(node("continuation", {}, inline(block)))
      else out.push(node("p", {}, inline(block)))
      continue
    }
    const open = stack.find((s) => s.style === e.style)
    let rank: number
    if (open) {
      rank = open.rank
      while (stack.length && stack[stack.length - 1].rank > rank) stack.pop()
      const same = stack.pop()!
      const ok = e.ordinal === same.last + 1 || (e.inserted && e.ordinal === same.last)
      if (!ok && !quoted) problems.push(`${RANK_TAG[rank]} ${e.label} after ${same.last}`)
    } else {
      rank = Math.min(top ? top.rank + 1 : 0, RANK_TAG.length - 1)
      if (e.ordinal !== 1 && !quoted && !e.inserted && e.style !== "(a.1)") problems.push(`${RANK_TAG[rank]} opens at ${e.label}`)
    }
    const level = node(RANK_TAG[rank], {}, [node("num", {}, [e.label])])
    const inner = enumerator(e.rest, false)
    if (inner && inner.style !== e.style) carry = e.rest
    else level.children.push(node("content", {}, inline(e.rest)))
    container().children.push(level)
    stack.push({ style: e.style, rank, node: level, last: e.ordinal })
  }
  return out
}

// ------------------------------------------------------------------ bills ---

// Oklahoma's: the legislature site's navigation ("Home / Legislature Home / Senate Home …") in place of the bill.
// Massachusetts's: "To view the text of House, No. 4215, please copy and paste the following URL …".
const ERROR_PAGE = /^\s*(Sorry, your query could not be completed|Service Unavailable|404 Not Found|Access Denied|Home\s+Legislature Home\s+Senate Home|To view the text of (?:House|Senate),? No\.)/i

export function parseStateBill(source: Source, p: StateProfile): FrontEndResult {
  const problems: string[] = []
  // A capture that is the legislature site's error page, not a bill (Virginia
  // has these): nothing to parse, and the report says so for a re-fetch.
  if (ERROR_PAGE.test(source.body)) {
    return { doc: node("bill", {}, [node("main")]), report: { dialect: "error-page", elements: 2, known: 2, unknown: {}, renamed: {}, coverage: 0, notes: ["error page captured instead of the bill; re-fetch"] } }
  }
  const inline = marksFor(p)
  const blocks = stateBlocks(source.body, p)
  const doc = node("bill")
  const preface = node("preface")
  const main = node("main")
  doc.children.push(preface, main)
  let start = blocks.findIndex((b, i) => i < blocks.length * 0.7 && p.enacting.test(b))
  // An amendment document (Oregon's "HOUSE AMENDMENTS TO HOUSE BILL 2999"):
  // page-and-line instructions against the printed bill, not a bill. Each
  // instruction is its own block, kept as such for the amendment engine.
  if (blocks.slice(0, 3).some((b) => /\bAMENDMENTS? TO (?:HOUSE|SENATE|ASSEMBLY) BILL\b/i.test(b)) && blocks.some((b) => /^(?:On page|In line|Delete|After line|Before line)\b/i.test(b))) {
    doc.tag = "amendment"
    for (const b of blocks) main.children.push(node(/^(?:On page|In line|Delete|After line|Before line)\b/i.test(b) ? "amendmentInstruction" : "p", {}, inline(b)))
    let elements = 0
    const count = (n: IrNode) => {
      elements++
      for (const c of n.children) if (typeof c !== "string") count(c)
    }
    count(doc)
    return { doc, report: { dialect: `${p.jurisdiction.toLowerCase()}-amendment`, elements, known: elements, unknown: {}, renamed: {}, coverage: 1, notes: [] } }
  }
  // Massachusetts prints no enacting formula: the bill opens at "SECTION 1."
  const opensWithSection = blocks.length > 0 && p.section.test(blocks[0])
  if (start < 0 && !opensWithSection) {
    // A resolution: recitals and a resolving clause, no enacting formula.
    if (blocks.some((b) => /^WHEREAS\b/i.test(b)) || blocks.some((b) => /\bRESOLVED\b/.test(b))) {
      doc.tag = "resolution"
      for (const b of blocks) {
        if (/^WHEREAS\b/i.test(b)) main.children.push(node("recital", {}, inline(b)))
        else if (/\bRESOLVED\b/.test(b)) main.children.push(node("resolvingClause", {}, inline(b)))
        else main.children.push(node("p", {}, inline(b)))
      }
      let elements = 0
      const count = (n: IrNode) => {
        elements++
        for (const c of n.children) if (typeof c !== "string") count(c)
      }
      count(doc)
      return { doc, report: { dialect: `${p.jurisdiction.toLowerCase()}-resolution`, elements, known: elements, unknown: {}, renamed: {}, coverage: 1, notes: [] } }
    }
    if (!p.bodyOnly) problems.push("no enacting formula")
    start = 0
  } else if (start < 0) {
    start = 0
  } else {
    for (const b of blocks.slice(0, start)) {
      if (/^AN? ACT\b/i.test(b)) preface.children.push(node("longTitle", {}, [b]))
      else if (/^(Introduced|Sponsored|By:|PRESENTED BY)/i.test(b)) preface.children.push(node("sponsor", {}, [b]))
      else preface.children.push(node("p", {}, [b]))
    }
    // The formula shares its block with the title before it (California's
    // digest runs straight into it) or the first section after it; each
    // part goes where it belongs.
    const block = blocks[start]
    const at = ENACTING_SENTENCE.exec(block)
    // The formula's sentence begins after the last full stop before the
    // match, so "The people of the State of California do enact as follows:"
    // stays whole.
    const from = at ? Math.max(0, block.lastIndexOf(". ", at.index) + 2, block.lastIndexOf(": ", at.index) + 2) : 0
    if (at && from > 0) preface.children.push(node("p", {}, [block.slice(0, from).trim()]))
    preface.children.push(node("enactingFormula", {}, [at ? block.slice(from, at.index + at[0].length).trim() : block]))
    const after = at ? block.slice(at.index + at[0].length).trim() : ""
    start += 1
    if (after) blocks.splice(start, 0, after)
  }
  let expected = 1
  let section: IrNode | null = null
  let pending: string[] = []
  const closeSection = () => {
    if (!section) return
    if (pending.length) {
      const contentNode = section.children.find((c): c is IrNode => typeof c !== "string" && c.tag === "content")
      const contentText = (n: IrNode | undefined) => tidy(n ? n.children.map((x) => (typeof x === "string" ? x : "")).join("") : "")
      // A section opener alone on its line ("SECTION 1." then the instruction
      // on the next): the first pending block is the instruction.
      if (contentNode && !contentText(contentNode) && pending.length && !enumerator(pending[0], false) && !(p.quotedSection && p.quotedSection.test(pending[0]))) {
        contentNode.children = inline(pending.shift()!)
      }
      let instruction = contentText(contentNode)
      // The introducer followed by more text on the same block ("… to read as
      // follows: SUBCHAPTER G. PROHIBITED ACTIONS"): the rest is the first
      // quoted block, and the instruction ends at the introducer.
      // "… amended by adding Subchapter G to read as follows: SUBCHAPTER G …"
      // splits after "as follows:", the strongest introducer, not the first.
      const intro =
        /(read as follows|as follows|to read)[:.]?-?(\s+)(?=\S)/i.exec(instruction) ??
        /(the following(?: \w+){0,3}|thereof)[:.]?-?(\s+)(?=\S)/i.exec(instruction) ??
        /(amended by adding|inserting)[:.]?-?(\s+)(?=\S)/i.exec(instruction)
      if (intro && contentNode && intro.index + intro[0].length < instruction.length) {
        const cut = intro.index + intro[0].length - intro[2].length
        pending.unshift(instruction.slice(cut).trim())
        contentNode.children = inline(instruction.slice(0, cut).trim())
        instruction = contentText(contentNode)
      }
      const quoted = p.quotesAfter.test(instruction)
      // Inside quoted law, a quoted section opener starts a section of its own.
      const groups: { section: IrNode | null; blocks: string[] }[] = [{ section: null, blocks: [] }]
      const QUOTED_LEVEL = /^(SUBCHAPTER|CHAPTER|ARTICLE|SUBTITLE|TITLE|PART|SUBPART|DIVISION)\s+([\w.-]+)\.?\s*(.*)$/s
      for (const b of pending) {
        const ql = quoted ? QUOTED_LEVEL.exec(b) : null
        const qs = quoted && p.quotedSection ? p.quotedSection.exec(b) : null
        if (ql) {
          // A quoted level above the section ("SUBCHAPTER G. PROHIBITED …").
          const lvl = node(ql[1].toLowerCase(), {}, [node("num", {}, [ql[2]])])
          if (tidy(ql[3])) lvl.children.push(node("heading", {}, inline(tidy(ql[3]))))
          groups.push({ section: lvl, blocks: [] })
        } else if (qs) {
          // The rest of a quoted section's first line: a catchline when it
          // reads as one (short, no verb, ending at its full stop), then a
          // chapeau when what follows ends in a colon, else the section's text.
          const rest = tidy(qs[2] ?? "")
          const sec = node("section", {}, [node("num", {}, [qs[1]])])
          // "Section 461. A. If the defendant …": the first line opens the section's first
          // subsection, which is not a catchline and goes to the hierarchy.
          if (enumerator(rest, false)) {
            groups.push({ section: sec, blocks: [rest] })
            continue
          }
          const stop = /^(.{1,80}?\.)\s+(.*)$/s.exec(rest)
          const first = stop ? stop[1] : rest
          const catchline = first.length > 0 && first.length <= 120 && !/\b(shall|may|must|is|are|was|were|has|have|be)\b/.test(first)
          if (catchline) {
            sec.children.push(node("heading", {}, inline(first)))
            const after = stop ? tidy(stop[2]) : ""
            if (after) sec.children.push(node(/:$/.test(after) ? "chapeau" : "content", {}, inline(after)))
          } else if (rest) sec.children.push(node("content", {}, inline(rest)))
          groups.push({ section: sec, blocks: [] })
        } else groups[groups.length - 1].blocks.push(b)
      }
      const parts: IrNode[] = []
      for (const g of groups) {
        const nested = nest(g.blocks, problems, inline, quoted)
        if (g.section) {
          g.section.children.push(...nested)
          parts.push(g.section)
        } else parts.push(...nested.map((n) => (n.tag === "p" && !quoted ? node("continuation", {}, n.children) : n)))
      }
      if (quoted) section.children.push(node("quotedContent", {}, parts))
      else section.children.push(...parts)
    }
    main.children.push(section)
    section = null
    pending = []
  }
  // An act of one section prints no "SECTION 1.": its first block is the section's instruction.
  if (p.bodyOnly && start < blocks.length && !blocks.slice(start).some((b) => p.section.test(b))) {
    section = node("section", {}, [node("content", {}, inline(blocks[start]))])
    start++
  }
  for (let i = start; i < blocks.length; i++) {
    const b = blocks[i]
    const m = p.section.exec(b)
    if (m) {
      const n = Number(String(m[1]).replace(/[^\d].*$/, ""))
      const ok = p.strict ? n === expected : n >= expected
      if (ok) {
        closeSection()
        expected = n + 1
        section = node("section", {}, [node("num", {}, [m[1]]), node("content", {}, inline(m[2] ?? ""))])
        continue
      }
    }
    if (!section) main.children.push(node("p", {}, inline(b)))
    else pending.push(b)
  }
  closeSection()
  if (!main.children.some((c) => typeof c !== "string" && c.tag === "section")) problems.push("no sections")
  let elements = 0
  const count = (n: IrNode) => {
    elements++
    for (const c of n.children) if (typeof c !== "string") count(c)
  }
  count(doc)
  const coverage = blocks.length ? Math.max(0, 1 - problems.length / blocks.length) : 0
  return { doc, report: { dialect: `${p.jurisdiction.toLowerCase()}-bill`, elements, known: elements, unknown: {}, renamed: {}, coverage: Number(coverage.toFixed(4)), notes: problems.slice(0, 5) } }
}

// -------------------------------------------------------------- statutes ---

const DOC_TYPE_TAG: Record<string, string> = { SECTION: "section", ARTICLE: "article", CHAPTER: "chapter", SUBCHAPTER: "subchapter", TITLE: "title", SUBTITLE: "subtitle", PART: "part", SUBPART: "subpart", DIVISION: "division", SUBDIVISION: "subdivision", RULE: "section" }

/**
 * A statute row from `Laws`, any state: the row's own level from its
 * doc_type, the section's number and heading read off the first block
 * ("§ 1-1-1. Heading. Body", "Sec. 12.5. Heading", "12.5 Heading."), then
 * the body by rank of appearance. A heading is taken only when it reads as
 * one, short and without a verb.
 */
export function parseStateStatute(source: Source, p: StateProfile): FrontEndResult {
  const problems: string[] = []
  const inline = marksFor({ ...p, capsAreNew: false })
  const meta = (source.meta ?? {}) as { doc_type?: string; location_id?: string; law_id?: string }
  const docType = String(meta.doc_type ?? "SECTION").toUpperCase()
  const tag = DOC_TYPE_TAG[docType] ?? "level"
  const level = node(tag, { ...(tag === "level" ? { role: docType.toLowerCase() } : {}), ...(meta.location_id ? { identifier: String(meta.location_id) } : {}) })
  const blocks = stateBlocks(source.body.replace(/^\s*\*\s*/, ""), p)
  let body = blocks
  let first = blocks[0] ?? ""
  // Illinois opens a section with its citation, "(505 ILCS 145/50) (from Ch.
  // 122, par. 19a-4) Sec. 50. …": the citations are kept as an attribute and
  // the number is read after them.
  const cites: string[] = []
  let m: RegExpExecArray | null
  let at = 0
  while ((m = /^\(([^)]{3,60})\)(?:\s+|$)/.exec(first))) {
    cites.push(m[1])
    first = first.slice(m[0].length)
    // A citation that was the whole first block: the number is in the next.
    if (!first && blocks.length > at + 1) first = blocks[++at]
  }
  if (cites.length) level.attrs.cite = cites.join("; ")
  if (at > 0) body = blocks.slice(at)
  if (p.statuteCite) first = first.replace(p.statuteCite, "")
  const head = p.headingBlock
    ? /^([0-9][\w.:-]*[\w)]|[0-9])\.?(?:\s+(.*))?$/s.exec(first)
    : /^(?:§+\s*|Section\s+|Sec\.\s*)?([0-9][\w.:-]*[\w)]|[0-9])\.?\s+(.*)$/s.exec(first)
  if (head && /\d/.test(head[1]) && p.headingBlock) {
    level.children.push(node("num", {}, [head[1]]))
    if (tidy(head[2] ?? "")) level.children.push(node("heading", {}, [tidy(head[2])]))
    body = blocks.slice(at + 1)
  } else if (head && /\d/.test(head[1])) {
    level.children.push(node("num", {}, [head[1]]))
    const split = /^(.*?\.)\s+(?=[A-Z(\d§])(.*)$/s.exec(head[2])
    const candidate = split ? split[1] : head[2]
    const isHeading = candidate.length <= 120 && !/\b(shall|may|must|is|are|was|were|has|have|be)\b/.test(candidate)
    if (isHeading && split) {
      level.children.push(node("heading", {}, [split[1]]))
      body = [split[2], ...blocks.slice(at + 1)]
    } else if (isHeading) {
      level.children.push(node("heading", {}, [head[2]]))
      body = blocks.slice(at + 1)
    } else body = [head[2], ...blocks.slice(at + 1)]
  } else if (tag !== "section") {
    level.children.push(node("heading", {}, [first]))
    body = blocks.slice(at + 1)
  } else problems.push(`no number at the start: ${first.slice(0, 40)}`)
  body = body.slice()
  if (p.restated) {
    const i = body.findIndex((b) => p.restated!.test(b))
    if (i >= 0) {
      const rest = body[i].replace(p.restated, "").trim()
      body.splice(i, 1, ...(rest ? [rest] : []))
    }
  }
  // A section printed twice (Oregon): as it stands, a note, then the text operative on a later
  // date, opening on the section's own number; the second is a `level` of its own.
  const twice = p.versionOpens ? body.findIndex((b, k) => k > 0 && p.versionOpens!.test(b)) : -1
  const later = twice > 0 ? [body[twice].replace(p.versionOpens!, "").trim(), ...body.slice(twice + 1)].filter(Boolean) : []
  if (twice > 0) body = body.slice(0, twice)
  const creditsOf = (part: string[]) => {
    const out: string[] = []
    if (p.credit) while (part.length && p.credit.test(part[part.length - 1])) out.unshift(part.pop()!)
    return out
  }
  // A recodification citation in brackets or an editor's "Note:" is a note; the history of enactment is the source credit.
  const credit = (c: string) => node(/^(?:\[|Note:)/.test(c) ? "note" : "sourceCredit", {}, [c])
  const credits = creditsOf(body)
  const nested = nest(body, problems, inline, false)
  if (nested.length && nested[0].tag === "p" && tag === "section") {
    level.children.push(node("content", {}, nested[0].children))
    nested.shift()
  }
  level.children.push(...nested)
  level.children.push(...credits.map(credit))
  if (later.length) {
    const laterCredits = creditsOf(later)
    level.children.push(node("level", { role: "later version" }, [...nest(later, problems, inline, false), ...laterCredits.map(credit)]))
  }
  let elements = 0
  const count = (n: IrNode) => {
    elements++
    for (const c of n.children) if (typeof c !== "string") count(c)
  }
  count(level)
  const coverage = blocks.length ? Math.max(0, 1 - problems.length / blocks.length) : 0
  return { doc: level, report: { dialect: `${p.jurisdiction.toLowerCase()}-statute`, elements, known: elements, unknown: {}, renamed: {}, coverage: Number(coverage.toFixed(4)), notes: problems.slice(0, 5) } }
}

export function stateFrontEnd(p: StateProfile): FrontEnd {
  return {
    profile: {
      jurisdiction: p.jurisdiction,
      name: p.name,
      dialects: [`${p.jurisdiction.toLowerCase()}-bill`, `${p.jurisdiction.toLowerCase()}-statute`, "text"],
      units: [
        { name: "section", uslm: "section", signal: p.section.source },
        { name: "quoted law", uslm: "quotedContent", signal: `after ${p.quotesAfter.source}` + (p.quotedSection ? `; sections open with ${p.quotedSection.source}` : "") },
        { name: "levels below the section", uslm: "subsection, paragraph, subparagraph, clause, subclause by rank of appearance", signal: "1. (1) (a) a. (i) (A) A. (I) (a.1)" },
        ...(p.del ? [{ name: "omitted matter", uslm: "del", signal: p.del.source }] : []),
        ...(p.capsAreNew ? [{ name: "new matter", uslm: "ins", signal: "CAPITALS" }] : []),
      ],
    },
    parse: (source) => {
      const kind = (source.meta as { kind?: string } | undefined)?.kind ?? (source.meta && "doc_type" in (source.meta as object) ? "law" : "bill")
      return kind === "law" ? parseStateStatute(source, p) : parseStateBill(source, p)
    },
  }
}
