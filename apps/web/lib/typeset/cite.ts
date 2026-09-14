import type { Node as PmNode } from "@tiptap/pm/model"

import { NY_LAWS, textOf } from "./amend"

// References in a legislative document (window 6, 2026-09-14): where a
// document cites other law, and which Work in the corpus each citation names,
// in the address of docs/xml/schema.md. Two sources:
//
//   ref marks     USLM already marks federal citations: <ref href="/us/usc/t12/s1701x">,
//                 and GPO's relative forms (usc/12/1701x, usc-chapter/38/15, pl/114/113)
//   the words     "12 U.S.C. 1709(r)(4)", "section 1105(a) of title 31", "Public Law 114-113";
//                 New York's "sections three hundred three and three hundred three-a of
//                 this chapter", "section 33-0101 of the environmental conservation law"
//
// Pure, no `@/` imports: the reader decorates with it, the in-context view
// finds the statutes an instruction amends with it, scripts test it.

export type CiteKind = "usc" | "usc-chapter" | "pl" | "stat" | "code" | "const" | "bill" | "other"

export type Cite = {
  /** Positions in the document. */
  from: number
  to: number
  text: string
  kind: CiteKind
  /** The Work the citation names: "/us/usc/t12/s1709". Null for a container ("chapter 15 of title 38") or a law not yet named in the corpus. */
  work: string | null
  /** The citation's full address, portion and all: "/us/usc/t12/s1709/r/4". */
  address: string | null
  via: "ref" | "text"
}

export type CiteContext = {
  /** The citing document's jurisdiction: "us", "us-ny". */
  jurisdiction: string
  /** The citing Work, for "this chapter": "/us-ny/code/agm/s16". */
  work?: string | null
  /** A state's law names to their codes, lower case ("economic development law" → "edl"), beyond the engine's own table. */
  laws?: Record<string, string>
}

type Target = Pick<Cite, "kind" | "work" | "address">

const portionPath = (parens: string | undefined) => (parens ?? "").match(/[A-Za-z0-9]+/g)?.map((p) => `/${p}`).join("") ?? ""

/** A href as the reader's `ref` mark carries it, read as an address. */
export function addressOfHref(href: string): Target | null {
  const h = href.trim().replace(/^https?:\/\/[^/]+/, "")
  let m = /^\/us\/usc\/t([0-9A-Za-z]+)\/s([^/]+)((?:\/[^/]+)*)$/.exec(h)
  if (m) return { kind: "usc", work: `/us/usc/t${m[1]}/s${m[2]}`, address: h }
  m = /^\/us\/usc\/t[0-9A-Za-z]+(?:\/[^/]+)*$/.exec(h)
  if (m) return { kind: "usc-chapter", work: null, address: h }
  m = /^usc\/([0-9]+[A-Za-z]?)\/([^/]+)((?:\/[^/]+)*)$/.exec(h)
  if (m) return { kind: "usc", work: `/us/usc/t${m[1]}/s${m[2]}`, address: `/us/usc/t${m[1]}/s${m[2]}${m[3] ?? ""}` }
  m = /^usc-chapter\/([0-9]+[A-Za-z]?)\/([^/]+)$/.exec(h)
  if (m) return { kind: "usc-chapter", work: null, address: `/us/usc/t${m[1]}/ch${m[2]}` }
  m = /^(?:\/us\/pl|pl|public-law)\/(\d+)\/(\d+)((?:\/[^/]+)*)$/.exec(h)
  if (m) return { kind: "pl", work: `/us/pl/${m[1]}/${m[2]}`, address: `/us/pl/${m[1]}/${m[2]}${m[3] ?? ""}` }
  m = /^(?:\/us\/stat|stat)\/(\d+)\/(\d+)$/.exec(h)
  if (m) return { kind: "stat", work: `/us/stat/${m[1]}/${m[2]}`, address: `/us/stat/${m[1]}/${m[2]}` }
  m = /^\/(us(?:-[a-z]{2})?)\/bill\/([^/]+)\/([a-z]+)\/([^/@]+)/.exec(h)
  if (m) return { kind: "bill", work: `/${m[1]}/bill/${m[2]}/${m[3]}/${m[4]}`, address: h }
  m = /^\/(us-[a-z]{2})\/(code|const)\/(.+)$/.exec(h)
  if (m) {
    // A section is the Work; it may sit under a container that restarts its numbering (/us-ma/code/gl/ch93A/s2).
    const segs = m[3].split("/")
    const at = segs.findIndex((s, i) => (m![2] === "const" || i > 0) && /^s\d/.test(s))
    const kind = m[2] as "code" | "const"
    return { kind, work: at < 0 ? null : `/${m[1]}/${m[2]}/${segs.slice(0, at + 1).join("/")}`, address: h }
  }
  return null
}

// ---------------------------------------------------------------- numbers ---

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}

/** A number as New York's laws spell it: "three hundred three-a" → "303-a", "two thousand eight hundred one" → "2801". Numerals pass through. */
export function wordsToNumber(words: string): string | null {
  const w = words.trim().toLowerCase()
  if (/^\d/.test(w)) return w
  const parts = w.split(/[\s-]+/)
  const suffix = parts.length > 1 && /^[a-z]$/.test(parts[parts.length - 1]) ? `-${parts.pop()}` : ""
  let total = 0
  let current = 0
  for (const p of parts) {
    if (p in NUMBER_WORDS) current += NUMBER_WORDS[p]
    else if (p === "hundred") current = (current || 1) * 100
    else if (p === "thousand") {
      total += (current || 1) * 1000
      current = 0
    } else return null
  }
  return `${total + current}${suffix}`
}

// Longest first and whole words only, so "seventy" is never read as "seven".
const WORD = `(?:${[...Object.keys(NUMBER_WORDS), "hundred", "thousand"].sort((a, b) => b.length - a.length).join("|")})(?![a-z])`
const SPELLED = `${WORD}(?:[\\s-]+${WORD})*(?:-[a-z](?![a-z]))?`
const NUMERAL = `\\d+[A-Za-z]?(?:[-.][0-9A-Za-z]+)*`
const NUM = `(?:${NUMERAL}|${SPELLED})`
const LIST_SEP = `(?:\\s*,\\s*(?:and\\s+|or\\s+)?|\\s+(?:and|or|through)\\s+)`

// ---------------------------------------------------------- recognizers ---

type Found = Omit<Cite, "via">

const USC_TEXT = /\b(\d+)\s+U\.\s?S\.\s?C\.\s+(?:§+\s*)?(\d+[A-Za-z0-9-]*)((?:\([A-Za-z0-9]+\))*)/g
const SECTION_OF_TITLE = /\bsection\s+(\d+[A-Za-z0-9-]*)((?:\([A-Za-z0-9]+\))*)\s+of\s+title\s+(\d+)(?:,\s+United\s+States\s+Code)?/gi
const PUBLIC_LAW = /\bPublic\s+Law\s+(\d+)[–-](\d+)/g
const STATUTES = /\b(\d+)\s+Stat\.\s+(\d+)/g

const NY_REFERENCE = new RegExp(
  `\\b(?:(paragraph|subparagraph|clause)\\s+\\(([a-z0-9]+)\\)\\s+of\\s+)?(?:subdivision\\s+(${NUM})\\s+of\\s+)?(sections?)\\s+(${NUM}(?:${LIST_SEP}${NUM})*)\\s+of\\s+(this\\s+(?:chapter|article|title|law)|the\\s+([a-z][a-z ,&'-]*?\\s+law(?:\\s+and\\s+rules)?))\\b`,
  "gi"
)
const NUM_IN_LIST = new RegExp(NUM, "gi")

function federal(text: string): Found[] {
  const out: Found[] = []
  for (const m of text.matchAll(USC_TEXT)) {
    const work = `/us/usc/t${m[1]}/s${m[2]}`
    out.push({ from: m.index!, to: m.index! + m[0].length, text: m[0], kind: "usc", work, address: `${work}${portionPath(m[3])}` })
  }
  for (const m of text.matchAll(SECTION_OF_TITLE)) {
    const work = `/us/usc/t${m[3]}/s${m[1]}`
    out.push({ from: m.index!, to: m.index! + m[0].length, text: m[0], kind: "usc", work, address: `${work}${portionPath(m[2])}` })
  }
  for (const m of text.matchAll(PUBLIC_LAW)) {
    const work = `/us/pl/${m[1]}/${m[2]}`
    out.push({ from: m.index!, to: m.index! + m[0].length, text: m[0], kind: "pl", work, address: work })
  }
  for (const m of text.matchAll(STATUTES)) {
    const work = `/us/stat/${m[1]}/${m[2]}`
    out.push({ from: m.index!, to: m.index! + m[0].length, text: m[0], kind: "stat", work, address: work })
  }
  return out
}

/** The code a New York law's name is, from the context's names and the engine's table. */
function nyCode(name: string, ctx: CiteContext): string | null {
  const n = name.toLowerCase().replace(/\s+/g, " ").trim()
  if (ctx.laws?.[n]) return ctx.laws[n]
  return Object.entries(NY_LAWS).find(([, law]) => law === n)?.[0] ?? null
}

function newYork(text: string, ctx: CiteContext): Found[] {
  const out: Found[] = []
  const here = /^\/us-ny\/code\/([^/]+)/.exec(ctx.work ?? "")?.[1] ?? null
  for (const m of text.matchAll(NY_REFERENCE)) {
    const [whole, smallWord, smallValue, subdivision, , list, whose, lawName] = m
    const code = /^this\s/i.test(whose) ? here : lawName ? nyCode(lawName.replace(/^the\s+/i, ""), ctx) : null
    const listAt = m.index! + whole.indexOf(list, (smallWord ? smallWord.length : 0) + (subdivision ? subdivision.length : 0))
    const numbers = [...list.matchAll(NUM_IN_LIST)]
    // One section with its subdivision is one citation over the whole phrase; a list is a citation per number.
    if (numbers.length === 1 || subdivision || smallWord) {
      const section = wordsToNumber(numbers[0][0])
      const work = code && section ? `/us-ny/code/${code}/s${section}` : null
      const below = [subdivision ? wordsToNumber(subdivision) : null, smallValue ?? null].filter(Boolean).map((p) => `/${p}`).join("")
      out.push({ from: m.index!, to: m.index! + whole.length, text: whole, kind: "code", work, address: work ? `${work}${below}` : null })
      continue
    }
    for (const n of numbers) {
      const section = wordsToNumber(n[0])
      const work = code && section ? `/us-ny/code/${code}/s${section}` : null
      const from = listAt + n.index!
      out.push({ from, to: from + n[0].length, text: n[0], kind: "code", work, address: work })
    }
  }
  return out
}

/** Citations in a run of plain text, positions as offsets into it. */
export function recognize(text: string, ctx: CiteContext): Found[] {
  const found = [...federal(text), ...(ctx.jurisdiction === "us-ny" ? newYork(text, ctx) : [])].sort((a, b) => a.from - b.from || b.to - a.to)
  // Where two recognizers read the same words, the longer reading stands.
  const out: Found[] = []
  for (const f of found) if (!out.some((o) => f.from < o.to && o.from < f.to)) out.push(f)
  return out
}

/** Every citation in a document: the ref marks first, then the words no ref covers. */
export function citationsOf(doc: PmNode, ctx: CiteContext): Cite[] {
  const out: Cite[] = []
  doc.descendants((block, pos) => {
    if (!block.isTextblock) return true
    const start = pos + 1
    const text = textOf(block)
    const taken: [number, number][] = []
    let open: { from: number; to: number; href: string } | null = null
    const close = () => {
      if (!open) return
      const target = addressOfHref(open.href)
      taken.push([open.from, open.to])
      out.push({ from: start + open.from, to: start + open.to, text: text.slice(open.from, open.to), via: "ref", kind: target?.kind ?? "other", work: target?.work ?? null, address: target?.address ?? null })
      open = null
    }
    block.forEach((child, offset) => {
      const mark = child.marks.find((m) => m.type.name === "ref" && m.attrs.href)
      const href = mark ? String(mark.attrs.href) : null
      if (open && href === open.href && offset === open.to) {
        open.to = offset + child.nodeSize
        return
      }
      close()
      if (href) open = { from: offset, to: offset + child.nodeSize, href }
    })
    close()
    for (const f of recognize(text, ctx)) {
      if (taken.some(([a, b]) => f.from < b && a < f.to)) continue
      out.push({ ...f, from: start + f.from, to: start + f.to, via: "text" })
    }
    return false
  })
  return out.sort((a, b) => a.from - b.from)
}

/** The distinct Works a list of citations names, in first-cited order. */
export const worksOf = (cites: Cite[]) => [...new Set(cites.map((c) => c.work).filter((w): w is string => Boolean(w)))]
