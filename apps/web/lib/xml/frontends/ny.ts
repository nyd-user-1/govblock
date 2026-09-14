import { node, tidy, type FrontEnd, type FrontEndResult, type IrChild, type IrNode, type Source } from "../ir"

// The New York front end, derived from the corpus (program brief, "The
// compiler"). Two surfaces reach us and neither is XML:
//
// Statutes: the Senate's Open Legislation API gives the Consolidated Laws as
// a tree (Laws rows carry doc_type ARTICLE/TITLE/PART/SECTION, depth and the
// parent), and a section's text as "§ 1262-u. Heading. Body". The hierarchy
// above the section is the row's; below it, New York's own units in New
// York's own order: subdivision "1.", paragraph "(a)", subparagraph "(i)",
// clause "(A)", subclause "(I)". USLM names all five.
//
// Bills: the printed bill as text, hard-wrapped at 72 columns and justified,
// with the drafting conventions carried in the capture: new matter is in
// CAPITALS (underlined in print), omitted matter in [brackets]. A bill is a
// preface (the number, the sponsors, "AN ACT to amend …"), the enacting
// formula, and sections "Section 1." then "§ 2." …; a section that ends "as
// follows:" quotes the law it amends, and that quoted content carries the
// marks. The marks come out as <ins> and <del>; the amendment engine reads
// them back.
//
// Coverage here is measured, not assumed: an enumerator out of sequence, or a
// block that opens like an enumerator and matches none, counts against the
// document, and the report names the first few.

// ------------------------------------------------------------ enumerators ---

// New York's units below the section, by rank, and the USLM element each
// rank takes: the federal standard is imposed by rank, and the state's own
// word rides in `role` (schema.md, the role convention; Window 1,
// 2026-09-14). So a New York subdivision is <subsection role="subdivision">,
// the same element type as a federal subsection at the same position, which
// is what lets one diff and one amendment engine serve both.
const RANK_TAG = ["subsection", "paragraph", "subparagraph", "clause", "subclause", "item"] as const
const RANK_ROLE = ["subdivision", "paragraph", "subparagraph", "clause", "subclause", "item"] as const

// How a unit is written: "1.", "A." and "a." (a letter with a full stop),
// "(a)", "(i)", "(A)", "(I)", and "(1)", whose rank depends on where it sits.
type Kind = "digit" | "Alpha." | "alpha." | "alpha" | "roman" | "ALPHA" | "ROMAN" | "(digit)"
const FIXED_RANK: Partial<Record<Kind, number>> = { digit: 0, "Alpha.": 0, "alpha.": 1, alpha: 1, roman: 2, ALPHA: 3, ROMAN: 4 }

const ROMAN = /^[ivxlc]+$/
const ROMAN_UP = /^[IVXLC]+$/
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
/** The ordinal an enumerator names, in its kind: "3" → 3, "c" → 3, "iii" → 3. A suffix like "1-a" keeps 1. */
function ordinal(kind: Kind, label: string): number {
  const core = label.replace(/-.*$/, "")
  if (kind === "digit" || kind === "(digit)") return Number(core)
  if (kind === "roman" || kind === "ROMAN") return romanToInt(core)
  return alphaToInt(core)
}
const hasSuffix = (label: string) => /-/.test(label)

type Enumerator = { kinds: Kind[]; label: string; rest: string }

/** What a block opens with, if an enumerator: every kind the token could be, most likely first. A note marker after it ("1. * Indeterminate") is dropped. */
function enumeratorOf(block: string): Enumerator | null {
  const strip = (rest: string) => rest.replace(/^\*\s*/, "")
  let m = /^(\d{1,3}(?:-[a-z]{1,2})?)\.\s+(.*)$/s.exec(block)
  if (m) return { kinds: ["digit"], label: m[1], rest: strip(m[2]) }
  m = /^\((\d{1,3}(?:-[a-z])?)\)\s+(.*)$/s.exec(block)
  if (m) return { kinds: ["(digit)"], label: m[1], rest: strip(m[2]) }
  m = /^([A-Za-z])\.\s+(?=\S)(.*)$/s.exec(block)
  if (m && !/^(A|I)\.\s+[a-z]/.test(block)) return { kinds: [/[A-Z]/.test(m[1]) ? "Alpha." : "alpha."], label: m[1], rest: strip(m[2]) }
  m = /^\(([A-Za-z]{1,3}(?:-\d)?)\)\s+(.*)$/s.exec(block)
  if (!m) return null
  const label = m[1]
  const kinds: Kind[] = []
  if (ROMAN.test(label)) kinds.push("roman")
  if (/^[a-z]{1,2}(-\d)?$/.test(label)) kinds.push("alpha")
  if (ROMAN_UP.test(label)) kinds.push("ROMAN")
  if (/^[A-Z]{1,2}$/.test(label)) kinds.push("ALPHA")
  if (!kinds.length) return null
  return { kinds, label, rest: strip(m[2]) }
}

// ----------------------------------------------------------------- marks ---

/** New York's marks, read back: [omitted matter] as <del>, NEW MATTER IN CAPITALS as <ins>. */
export function marks(text: string): IrChild[] {
  const out: IrChild[] = []
  const parts = text.split(/(\[[^\]]+\])/)
  for (const part of parts) {
    if (!part) continue
    if (part.startsWith("[") && part.endsWith("]")) {
      out.push(node("del", {}, [part.slice(1, -1)]))
      continue
    }
    // Runs of tokens with no lowercase letter and at least one capital; a run
    // stands only if some token in it has two or more letters, so a lone "A"
    // or a section sign does not read as new matter.
    const tokens = part.split(/(\s+)/)
    let run: string[] = []
    let plain = ""
    const flush = () => {
      if (!run.length) return
      const joined = run.join("")
      const letters = run.filter((t) => /[A-Z]{2,}/.test(t)).length
      if (letters > 0) {
        if (plain) out.push(plain)
        plain = ""
        out.push(node("ins", {}, [joined]))
      } else plain += joined
      run = []
    }
    for (const t of tokens) {
      const isCaps = /^[^a-z]*[A-Z][^a-z]*$/.test(t) && /[A-Z]/.test(t)
      if (isCaps || (run.length && /^\s+$/.test(t))) run.push(t)
      else {
        flush()
        plain += t
      }
    }
    flush()
    if (plain) out.push(plain)
  }
  // Trailing whitespace that a run swallowed: fine as text.
  return out
}

// ---------------------------------------------------------------- blocks ---

const OPENS = /^(§\s*\d|Section\s+\d|\d{1,3}(?:-[a-z]{1,2})?\.\s|\([A-Za-z0-9]{1,3}(?:-\d)?\)\s)/

/**
 * Wrapped, justified lines back into blocks. A new block opens at a blank
 * line, or at a line indented two or more spaces that opens with an
 * enumerator; everything else continues the block before it. A line that
 * ends in a hyphen joins the next without a space.
 */
export function blocksOf(text: string): string[] {
  const blocks: string[] = []
  let current = ""
  const close = () => {
    const t = tidy(current)
    if (t) blocks.push(t)
    current = ""
  }
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const stripped = raw.trim()
    if (!stripped) {
      close()
      continue
    }
    const indent = raw.length - raw.trimStart().length
    if (indent >= 2 && OPENS.test(stripped)) close()
    if (current.endsWith("-") && /^[a-z]/.test(stripped)) current = current.slice(0, -1) + stripped
    else current += (current ? " " : "") + stripped
  }
  close()
  return blocks
}

// ------------------------------------------------------------- hierarchy ---

type Problem = string

/**
 * Enumerated blocks into nested levels. A stack of open levels, one per
 * rank; an ambiguous "(i)" is the next paragraph when the open paragraph
 * sequence expects "i", else a subparagraph; "(1)" takes the rank one below
 * whatever is open. A block whose text itself opens with a deeper
 * enumerator ("1. (a) The …") is split, so the inner unit is its own level.
 * Out of sequence is recorded and the block still lands.
 */
function nest(blocks: string[], problems: Problem[], inline: (t: string) => IrChild[], quoted = false): IrNode[] {
  const out: IrNode[] = []
  type Open = { kind: Kind; rank: number; node: IrNode; last: number }
  const stack: Open[] = []
  const container = () => (stack.length ? stack[stack.length - 1].node : ({ children: out } as IrNode))
  const queue = [...blocks]
  while (queue.length) {
    const block = queue.shift()!
    const e = enumeratorOf(block)
    if (!e) {
      if (/^\(?[0-9A-Za-z]{1,3}[.)]\s/.test(block)) problems.push(`unmatched enumerator: ${block.slice(0, 40)}`)
      // Flush language: the text after a list, at the level that owns it.
      if (stack.length) stack[stack.length - 1].node.children.push(node("continuation", {}, inline(block)))
      else out.push(node("p", {}, inline(block)))
      continue
    }
    // Which kind and rank: the open sequence that expects this label wins;
    // else the first kind that opens a new sequence below the current level.
    let kind: Kind | null = null
    let rank = 0
    for (const k of e.kinds) {
      const open = stack.find((s) => s.kind === k)
      if (open && (ordinal(k, e.label) === open.last + 1 || (hasSuffix(e.label) && ordinal(k, e.label) === open.last))) {
        kind = k
        rank = open.rank
        break
      }
    }
    if (!kind) {
      const top = stack[stack.length - 1]
      const below = top ? top.rank + 1 : 0
      const fixed = e.kinds.find((k) => FIXED_RANK[k] !== undefined && (!top || FIXED_RANK[k]! > top.rank))
      if (fixed) {
        kind = fixed
        rank = FIXED_RANK[fixed]!
      } else {
        kind = e.kinds[0]
        rank = FIXED_RANK[kind] ?? Math.min(below, RANK_TAG.length - 1)
      }
    }
    const n = ordinal(kind, e.label)
    while (stack.length && stack[stack.length - 1].rank > rank) stack.pop()
    const same = stack.length && stack[stack.length - 1].rank === rank ? stack.pop()! : null
    const role = RANK_ROLE[rank]
    // Inside quoted law a bill shows only the units it amends, so gaps and
    // late starts are not faults there; a sibling written in another style
    // ("B." after "2.") starts a new sequence rather than breaking one.
    if (same) {
      const ok = same.kind !== kind || n === same.last + 1 || (hasSuffix(e.label) && n === same.last)
      if (!ok && !quoted) problems.push(`${role} ${e.label} after ${same.last}`)
    } else if (n !== 1 && !hasSuffix(e.label) && !quoted) problems.push(`${role} opens at ${e.label}`)
    const level = node(RANK_TAG[rank], { role }, [node("num", {}, [e.label])])
    // "1. (a) The …": the content belongs to the inner unit, which is next in the queue.
    const inner = enumeratorOf(e.rest)
    if (inner && inner.kinds.some((k) => (FIXED_RANK[k] ?? rank + 1) > rank)) queue.unshift(e.rest)
    else level.children.push(node("content", {}, inline(e.rest)))
    container().children.push(level)
    stack.push({ kind, rank, node: level, last: hasSuffix(e.label) && same ? same.last : n })
  }
  return out
}

// --------------------------------------------------------------- statutes ---

// Above the section, the Senate API's doc_type, as schema.md §2 v1 settles
// it (Window 1, 2026-09-14): USLM has article, title, subtitle, part and
// subpart as levels, so each keeps its own name; a New York Law is the
// title with role "law".
const DOC_TYPE_LEVEL: Record<string, [tag: string, role: string]> = {
  ARTICLE: ["article", "article"], SUBARTICLE: ["subarticle", "subarticle"], TITLE: ["title", "title"], SUBTITLE: ["subtitle", "subtitle"],
  PART: ["part", "part"], SUBPART: ["subpart", "subpart"], CHAPTER: ["chapter", "chapter"], SECTION: ["section", "section"], RULE: ["section", "rule"], LAW: ["title", "law"],
}

/** A Laws row: "§ 1262-u. Heading. Body" with the row's own level above it. */
export function parseNyStatute(source: Source): FrontEndResult {
  const meta = (source.meta ?? {}) as { doc_type?: string; location_id?: string; law_id?: string; law_name?: string }
  const problems: Problem[] = []
  // A leading asterisk marks a section with a note (an expiry, a pending
  // amendment); it is kept as an attribute, not read as text.
  const marked = /^\s*\*/.test(source.body)
  const blocks = blocksOf(source.body.replace(/^\s*\*\s*/, ""))
  const docType = String(meta.doc_type ?? "SECTION").toUpperCase()
  const [levelTag, role] = DOC_TYPE_LEVEL[docType] ?? ["level", docType.toLowerCase()]
  const level = node(levelTag, { role, ...(meta.location_id ? { identifier: String(meta.location_id) } : {}), ...(marked ? { note: "*" } : {}) })
  let body = blocks
  let first = blocks[0] ?? ""
  // The Constitution's first section in an article carries the article's
  // own heading before it and opens "Section 1." rather than "§ 1."; the
  // article heading is the ARTICLE row's, so it is set aside here.
  const lead = /^(ARTICLE\s+[IVXLC\d]+[^§]*?)\s+(?=(?:§|Section)\s*[\w.-]+\.)/s.exec(first)
  if (lead) first = first.slice(lead[0].length)
  // The number runs to the first space: "§ 20.05 Criminal liability …" has no
  // full stop after a dotted number, and "§ 1262-u. Allocation …" has one.
  const head = /^(?:§|Section)\s*(\S+?)\.?\s+(.*)$/s.exec(first)
  if (head) {
    level.children.push(node("num", {}, [`§ ${head[1]}`]))
    // The heading runs to the first full stop that a capital, a digit, a
    // parenthesis or a section sign follows, and is a heading only when it
    // reads as one: short, and not a sentence with a verb in it. The
    // Constitution's sections have no heading; their body starts at once.
    const split = /^(.*?\.)\s+(?=[A-Z(\d§])(.*)$/s.exec(head[2])
    const candidate = split ? split[1] : head[2]
    const isHeading = candidate.length <= 120 && !/\b(shall|may|must|is|are|was|were|has|have|be)\b/.test(candidate)
    if (isHeading && split) {
      level.children.push(node("heading", {}, [split[1]]))
      body = [split[2], ...blocks.slice(1)]
    } else if (isHeading) {
      level.children.push(node("heading", {}, [head[2]]))
      body = blocks.slice(1)
    } else {
      body = [head[2], ...blocks.slice(1)]
    }
  } else if (levelTag !== "section") {
    // An article's or a title's text is its table of contents: the heading,
    // then one line per section.
    level.children.push(node("heading", {}, [first]))
    const toc = node("toc")
    for (const b of blocks.slice(1)) {
      const item = /^(?:Section\s+)?([\w.-]+)\.\s+(.*)$/s.exec(b)
      toc.children.push(item ? node("tocItem", { role: "section", num: item[1] }, [item[2]]) : node("tocItem", {}, [b]))
    }
    level.children.push(toc)
    return finish(level, "ny-statute", blocks.length, problems)
  } else problems.push(`no § at the start: ${first.slice(0, 40)}`)
  const nested = nest(body, problems, (t) => [t])
  if (nested.length && nested[0].tag === "p" && levelTag === "section") {
    // Text before the first subdivision is the section's own content.
    level.children.push(node("content", {}, nested[0].children))
    nested.shift()
  }
  level.children.push(...nested)
  return finish(level, "ny-statute", blocks.length, problems)
}

// ------------------------------------------------------------------ bills ---

const ENACTING = /DO ENACT AS FOLLOWS:?/
const SECTION_OPEN = /^(?:Section|§)\s*(\d{1,3}(?:-[a-z])?)\.\s+(.*)$/s

/** The printed bill as text: preface, enacting formula, sections with the law they quote. */
export function parseNyBill(source: Source): FrontEndResult {
  const problems: Problem[] = []
  const blocks = blocksOf(source.body)
  const doc = node("bill")
  const preface = node("preface")
  const main = node("main")
  doc.children.push(preface, main)
  let i = 0
  for (; i < blocks.length; i++) {
    const b = blocks[i]
    if (ENACTING.test(b)) {
      preface.children.push(node("enactingFormula", {}, [b]))
      i++
      break
    }
    if (/^\d{3,5}(--[A-Z])?$/.test(b)) preface.children.push(node("docNumber", {}, [b]))
    else if (/^AN ACT/.test(b)) preface.children.push(node("longTitle", {}, [b]))
    else if (/^Introduced\s+by/i.test(b)) preface.children.push(node("sponsor", {}, [b]))
    else if (/^S T A T E/.test(b) || /^I N\s+(SENATE|ASSEMBLY)/.test(b) || /^\d{4}-\d{4}/.test(b) || /^_+$/.test(b)) preface.children.push(node("p", {}, [b]))
    else preface.children.push(node("p", {}, [b]))
  }
  const enacted = preface.children.some((c) => typeof c !== "string" && c.tag === "enactingFormula")
  // A resolution has no enacting formula: its body is recitals ("WHEREAS,
  // …") and a resolving clause, and it is read as such, not as sections.
  if (!enacted) {
    const isResolution = blocks.some((b) => /^WHEREAS/i.test(b) || /RESOLVED,? (?:That|by)/i.test(b))
    if (isResolution) {
      doc.tag = "resolution"
      for (const b of blocks) {
        if (/^WHEREAS/i.test(b)) main.children.push(node("recital", {}, marks(b)))
        else if (/RESOLVED/i.test(b)) main.children.push(node("resolvingClause", {}, marks(b)))
        else main.children.push(node("p", {}, marks(b)))
      }
      preface.children.length = 0
      return finish(doc, "ny-resolution", blocks.length, problems)
    }
    problems.push("no enacting formula")
    i = 0
  }
  // Sections: each opens at "Section 1." or "§ 2."; the blocks until the next
  // section belong to it. The instruction sentence is content; if it ends in
  // "as follows:" the rest is the quoted law, with the marks.
  let expected = 1
  let section: IrNode | null = null
  let pending: string[] = []
  const closeSection = () => {
    if (!section) return
    if (pending.length) {
      const quoted = section.children.some((c) => typeof c !== "string" && c.tag === "content" && /as follows:?$/i.test(tidy(c.children.map((x) => (typeof x === "string" ? x : "")).join(""))))
      const nested = nest(pending, problems, marks, quoted)
      if (quoted) section.children.push(node("quotedContent", {}, nested))
      else section.children.push(...nested.map((n) => (n.tag === "p" ? node("continuation", {}, n.children) : n)))
    }
    main.children.push(section)
    section = null
    pending = []
  }
  for (; i < blocks.length; i++) {
    const b = blocks[i]
    const m = SECTION_OPEN.exec(b)
    // A bill's sections run 1, 2, 3 (a "2-a" may be slipped in); a "§ 5."
    // out of that order is quoted law, not the bill's own section.
    if (m && (Number(m[1].replace(/-.*$/, "")) === expected || (hasSuffix(m[1]) && Number(m[1].replace(/-.*$/, "")) === expected - 1))) {
      closeSection()
      if (!hasSuffix(m[1])) expected += 1
      section = node("section", {}, [node("num", {}, [`§ ${m[1]}`]), node("content", {}, marks(m[2]))])
      continue
    }
    if (!section) {
      main.children.push(node("p", {}, marks(b)))
      continue
    }
    pending.push(b)
  }
  closeSection()
  if (!main.children.length) problems.push("no sections")
  return finish(doc, "ny-bill", blocks.length, problems)
}

function finish(doc: IrNode, dialect: string, blocks: number, problems: Problem[]): FrontEndResult {
  let elements = 0
  const count = (n: IrNode) => {
    elements++
    for (const c of n.children) if (typeof c !== "string") count(c)
  }
  count(doc)
  const coverage = blocks ? Math.max(0, 1 - problems.length / blocks) : 0
  return {
    doc,
    report: { dialect, elements, known: elements, unknown: {}, renamed: {}, coverage: Number(coverage.toFixed(4)), notes: problems.slice(0, 5) },
  }
}

export function parseNy(source: Source): FrontEndResult {
  const kind = String((source.meta as { kind?: string } | undefined)?.kind ?? (source.meta && "doc_type" in (source.meta as object) ? "law" : "bill"))
  return kind === "law" ? parseNyStatute(source) : parseNyBill(source)
}

export const ny: FrontEnd = {
  profile: {
    jurisdiction: "NY",
    name: "New York",
    dialects: ["ny-statute", "ny-bill", "ny-resolution"],
    units: [
      { name: "law, article, title, part", uslm: "title role=law, article, title, subtitle, part, subpart", signal: "the Senate API's tree: doc_type and depth on the Laws row" },
      { name: "section", uslm: "section", signal: "\"§ 1262-u. Heading. Body\" in a statute; \"Section 1.\" then \"§ 2.\" in a bill" },
      { name: "subdivision", uslm: "subsection role=subdivision", signal: "\"1.\", \"A.\" or \"(1)\" opening an indented block; the USLM element is by rank, the state's word in role" },
      { name: "paragraph", uslm: "paragraph", signal: "\"(a)\"" },
      { name: "subparagraph", uslm: "subparagraph", signal: "\"(i)\", read as roman when the paragraph sequence does not expect the letter" },
      { name: "clause", uslm: "clause", signal: "\"(A)\"" },
      { name: "subclause", uslm: "subclause", signal: "\"(I)\"" },
      { name: "quoted law", uslm: "quotedContent", signal: "the blocks after a section that ends \"as follows:\"" },
      { name: "new matter", uslm: "ins", signal: "CAPITALS in a bill's text (underlined in print)" },
      { name: "omitted matter", uslm: "del", signal: "[brackets] in a bill's text" },
    ],
  },
  parse: parseNy,
}
