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
}

const RANK_TAG = ["subsection", "paragraph", "subparagraph", "clause", "subclause", "item", "subitem"] as const

// ---------------------------------------------------------------- blocks ---

const ENUM_OPEN = /^(?:\(\s*[0-9A-Za-z]{1,4}(?:\.\d+)?\s*\)|[0-9]{1,3}(?:\.\d+)?\.|[A-Za-z]\.)\s+/
const isOpener = (line: string, p: StateProfile) => p.section.test(line) || (p.quotedSection?.test(line) ?? false) || ENUM_OPEN.test(line) || /^\*\s*\*\s*\*/.test(line)

/** Line numbers down the left margin, as Pennsylvania prints them: stripped when most lines carry one. */
function stripLineNumbers(text: string): string {
  const lines = text.split("\n")
  const numbered = lines.filter((l) => /^\s{0,3}\d{1,2}\s{2,}\S/.test(l)).length
  if (numbered < lines.length * 0.3) return text
  return lines.map((l) => l.replace(/^\s{0,3}\d{1,2}\s{2,}/, "   ")).join("\n")
}

const clean = (text: string) => text.replace(/�| /g, " ").replace(/\r/g, "")

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
  let current = ""
  let prevEnded = true
  const close = () => {
    const t = tidy(current)
    if (t) out.push(t)
    current = ""
  }
  for (const raw of dropBlankPerLine(stripLineNumbers(clean(text))).split("\n")) {
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
    if (isOpener(stripped, p) && (prevEnded || indent >= 3)) close()
    if (current.endsWith("-") && /^[a-z]/.test(stripped)) current = current.slice(0, -1) + stripped
    else current += (current ? " " : "") + stripped
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
        const caps = /^[^a-z]*[A-Z][^a-z]*$/.test(t)
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
type Enumerator = { style: Style; label: string; ordinal: number; rest: string }

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

function enumerator(block: string, expectRoman: boolean): Enumerator | null {
  let m = /^(\d{1,3})\.\s+(.*)$/s.exec(block)
  if (m) return { style: "1.", label: m[1], ordinal: Number(m[1]), rest: m[2] }
  m = /^\((\d{1,3})\)\s+(.*)$/s.exec(block)
  if (m) return { style: "(1)", label: m[1], ordinal: Number(m[1]), rest: m[2] }
  m = /^\(([a-z])\.(\d{1,2})\)\s+(.*)$/s.exec(block)
  if (m) return { style: "(a.1)", label: `${m[1]}.${m[2]}`, ordinal: alphaToInt(m[1]) * 100 + Number(m[2]), rest: m[3] }
  m = /^\(([a-z]{1,2})\)\s+(.*)$/s.exec(block)
  if (m) {
    const roman = /^[ivxl]+$/.test(m[1]) && (expectRoman || !/^[a-h]$/.test(m[1]))
    return roman ? { style: "(i)", label: m[1], ordinal: romanToInt(m[1]), rest: m[2] } : { style: "(a)", label: m[1], ordinal: alphaToInt(m[1]), rest: m[2] }
  }
  m = /^\(([A-Z]{1,2})\)\s+(.*)$/s.exec(block)
  if (m) {
    const roman = /^[IVXL]+$/.test(m[1]) && (expectRoman || !/^[A-H]$/.test(m[1]))
    return roman ? { style: "(I)", label: m[1], ordinal: romanToInt(m[1]), rest: m[2] } : { style: "(A)", label: m[1], ordinal: alphaToInt(m[1]), rest: m[2] }
  }
  m = /^([a-z])\.\s+(?=\S)(.*)$/s.exec(block)
  if (m) return { style: "a.", label: m[1], ordinal: alphaToInt(m[1]), rest: m[2] }
  m = /^([A-Z])\.\s+(?=[A-Z(])(.*)$/s.exec(block)
  if (m) return { style: "A.", label: m[1], ordinal: alphaToInt(m[1]), rest: m[2] }
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
  const queue = [...blocks]
  while (queue.length) {
    const block = queue.shift()!
    if (/^\*\s*\*\s*\*$/.test(block)) {
      container().children.push(node("p", { role: "ellipsis" }, ["* * *"]))
      continue
    }
    const top = stack[stack.length - 1]
    const expectRoman = !!top && (top.style === "(a)" || top.style === "(A)") && top.last !== 8
    const e = enumerator(block, expectRoman)
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
      const ok = e.ordinal === same.last + 1
      if (!ok && !quoted) problems.push(`${RANK_TAG[rank]} ${e.label} after ${same.last}`)
    } else {
      rank = Math.min(top ? top.rank + 1 : 0, RANK_TAG.length - 1)
      if (e.ordinal !== 1 && !quoted && e.style !== "(a.1)") problems.push(`${RANK_TAG[rank]} opens at ${e.label}`)
    }
    const level = node(RANK_TAG[rank], {}, [node("num", {}, [e.label])])
    const inner = enumerator(e.rest, false)
    if (inner && inner.style !== e.style) queue.unshift(e.rest)
    else level.children.push(node("content", {}, inline(e.rest)))
    container().children.push(level)
    stack.push({ style: e.style, rank, node: level, last: e.ordinal })
  }
  return out
}

// ------------------------------------------------------------------ bills ---

export function parseStateBill(source: Source, p: StateProfile): FrontEndResult {
  const problems: string[] = []
  const inline = marksFor(p)
  const blocks = stateBlocks(source.body, p)
  const doc = node("bill")
  const preface = node("preface")
  const main = node("main")
  doc.children.push(preface, main)
  let start = blocks.findIndex((b, i) => i < blocks.length * 0.7 && p.enacting.test(b))
  if (start < 0) {
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
    problems.push("no enacting formula")
    start = 0
  } else {
    for (const b of blocks.slice(0, start)) {
      if (/^AN? ACT\b/i.test(b)) preface.children.push(node("longTitle", {}, [b]))
      else if (/^(Introduced|Sponsored|By:|PRESENTED BY)/i.test(b)) preface.children.push(node("sponsor", {}, [b]))
      else preface.children.push(node("p", {}, [b]))
    }
    preface.children.push(node("enactingFormula", {}, [blocks[start]]))
    start += 1
  }
  let expected = 1
  let section: IrNode | null = null
  let pending: string[] = []
  const closeSection = () => {
    if (!section) return
    if (pending.length) {
      const instruction = tidy(section.children.filter((c) => typeof c !== "string" && c.tag === "content").map((c) => (typeof c === "string" ? "" : c.children.map((x) => (typeof x === "string" ? x : "")).join(""))).join(" "))
      const quoted = p.quotesAfter.test(instruction)
      // Inside quoted law, a quoted section opener starts a section of its own.
      const groups: { section: IrNode | null; blocks: string[] }[] = [{ section: null, blocks: [] }]
      for (const b of pending) {
        const qs = quoted && p.quotedSection ? p.quotedSection.exec(b) : null
        if (qs) groups.push({ section: node("section", {}, [node("num", {}, [qs[1]]), node("heading", {}, inline(qs[2] ?? ""))]), blocks: [] })
        else groups[groups.length - 1].blocks.push(b)
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

export function stateFrontEnd(p: StateProfile): FrontEnd {
  return {
    profile: {
      jurisdiction: p.jurisdiction,
      name: p.name,
      dialects: [`${p.jurisdiction.toLowerCase()}-bill`, "text"],
      units: [
        { name: "section", uslm: "section", signal: p.section.source },
        { name: "quoted law", uslm: "quotedContent", signal: `after ${p.quotesAfter.source}` + (p.quotedSection ? `; sections open with ${p.quotedSection.source}` : "") },
        { name: "levels below the section", uslm: "subsection, paragraph, subparagraph, clause, subclause by rank of appearance", signal: "1. (1) (a) a. (i) (A) A. (I) (a.1)" },
        ...(p.del ? [{ name: "omitted matter", uslm: "del", signal: p.del.source }] : []),
        ...(p.capsAreNew ? [{ name: "new matter", uslm: "ins", signal: "CAPITALS" }] : []),
      ],
    },
    parse: (source) => parseStateBill(source, p),
  }
}
