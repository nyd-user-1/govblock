import { node, type FrontEnd, type FrontEndResult, type IrChild, type IrNode, type Source } from "../ir"

// The plain-text front end: the lowest tier, for any document that reaches
// the corpus as text with its tags thrown away (LegiScan's captures, most
// state bills, everything federal before 2013). A port of the heuristics in
// lib/policy/bill-uslm.ts's plainTextHtml, into the IR instead of HTML: a
// line that is only an enumeration opens a level; a short unpunctuated line
// after it is the level's heading; everything else is a paragraph. What
// this cannot tell, the section from the subsection, it does not guess: each
// enumerated unit is a generic `level` with its `num`, and the coverage line
// says so.

const ENUM_ONLY = /^\(?(?:\d{1,3}|[A-Za-z]{1,3}|[ivxlcdmIVXLCDM]{1,6})\)?\.?$/
const isEnum = (line: string) => ENUM_ONLY.test(line) && line.length <= 8
const looksLikeHeading = (line: string) => line.length <= 90 && !/[.,;:—–]$/.test(line) && !/\b(and|or|of|the|to)$/i.test(line)
const dehyphenate = (text: string) => text.replace(/([A-Za-z])-\n\s*([A-Za-z])/g, "$1$2")
const LEVEL_BREAK = /(?<=[.;])\s+(?=(?:§\s*\d|\([0-9A-Za-z]{1,4}\)\s+[A-Z(]))/g
const LEADING_ENUM = /^(§\s*[\d.-]+[a-z]?|\([0-9A-Za-z]{1,4}\))\s+(.*)$/s

export function textToIr(text: string): IrNode {
  const blocks = dehyphenate(text)
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .flatMap((b) => b.split(LEVEL_BREAK))
    .map((b) => b.trim())
    .filter(Boolean)
  const main = node("main")
  let pending: string | null = null
  const level = (num: string, rest: IrChild[]) => node("level", {}, [node("num", {}, [num]), ...rest])
  for (const block of blocks) {
    if (isEnum(block)) {
      if (pending) main.children.push(level(pending, []))
      pending = block
      continue
    }
    if (pending) {
      main.children.push(looksLikeHeading(block) ? level(pending, [node("heading", {}, [block])]) : level(pending, [node("content", {}, [block])]))
      pending = null
      continue
    }
    const lead = LEADING_ENUM.exec(block)
    if (lead) {
      main.children.push(level(lead[1], [node("content", {}, [lead[2]])]))
      continue
    }
    main.children.push(node("p", {}, [block]))
  }
  if (pending) main.children.push(level(pending, []))
  return main
}

export function parseText(source: Source): FrontEndResult {
  const doc = textToIr(source.body)
  let elements = 0
  const count = (n: IrNode) => {
    elements++
    for (const c of n.children) if (typeof c !== "string") count(c)
  }
  count(doc)
  return {
    doc,
    report: {
      dialect: "text",
      elements,
      known: elements,
      unknown: {},
      renamed: {},
      // Plain text parses "cleanly" by construction; the tier, not the coverage, says how little it knows.
      coverage: 1,
      notes: ["plain text: levels are generic, the hierarchy is not recovered"],
    },
  }
}

export const textFrontEnd: FrontEnd = {
  profile: {
    jurisdiction: "*",
    name: "Plain text",
    dialects: ["text"],
    units: [
      { name: "level", uslm: "level", signal: "a line that is only an enumeration, or a paragraph opening with one" },
      { name: "heading", uslm: "heading", signal: "a short unpunctuated line after an enumeration" },
      { name: "paragraph", uslm: "p", signal: "any other block of text" },
    ],
  },
  parse: parseText,
}
