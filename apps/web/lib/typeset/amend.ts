import type { Node as PmNode } from "@tiptap/pm/model"

import { BIG_LEVELS, isLevel, SMALL_LEVELS } from "../xml/schema"
import { numValue } from "../xml/uslm-to-doc"

// The amendment engine (window 5, 2026-09-14). A reader edits a fork of a
// published unit as a document; the engine derives the amendment from the
// edited copy against the dated base it was forked from, the way the fork
// edit page always worked, now over the legislative structure instead of
// lines. Four pure functions over trees of the reader's schema
// (lib/xml/schema.ts):
//
//   diffDocs(base, fork)     node-level, children matched by identifier, then
//                            word-level within each changed text block
//   instructions(diff, cite) the amendment in the jurisdiction's convention
//   marked(diff)             the redline in place: decoration specs over the
//                            base, never marks written into a document
//   clean(diff)              the text as the law would read
//
// and conflicts(a, b), which refuses two amendments to the same text of one
// base and says which legislative rule decides between them.
//
// Nodes are compared by type name, not NodeType, so a base built on the
// server's schema and a fork from the browser's Tiptap editor diff alike.
// Marks are not compared: formatting is not an amendment. No React, no `@/`
// imports; scripts bundle it (scripts/typeset/amend.test.mjs).

// ================================================================== diff ===

export type Op = "equal" | "insert" | "delete"
export type Segment = { op: Op; text: string }
export type Status = "same" | "changed" | "inserted" | "deleted"

export type DiffNode = {
  status: Status
  type: string
  base: PmNode | null
  fork: PmNode | null
  /** Where the node starts in the base; for an inserted node, where it would stand. The document is -1. */
  basePos: number
  /** Where the node starts in the fork; for a deleted node, where it stood. */
  forkPos: number
  children: DiffNode[]
  /** A changed text block's words, base against fork. */
  segments: Segment[] | null
}

const LEAF = (leaf: PmNode) => (leaf.type.name === "br" ? "\n" : "￼")

/** A text block's characters, one per position: an inline atom is one character, so offsets map straight to positions. */
export const textOf = (block: PmNode) => block.textBetween(0, block.content.size, "", LEAF)

export const elementOf = (n: PmNode) => (n.type.name === "level" ? String(n.attrs.element ?? "level") : n.type.name)
const SMALL = new Set<string>(SMALL_LEVELS)
const BIG = new Set<string>(BIG_LEVELS)

/** A level's bare number as its text now reads ("2-b"), falling back to the value the source gave it. */
export function numOf(level: PmNode): string | null {
  const num = level.firstChild?.type.name === "num" ? level.firstChild : null
  if (!num) return null
  return numValue(num.textContent) || (num.attrs.value as string | null) || null
}

// ----------------------------------------------------------------- words ---

const TOKEN = /\s+|[\p{L}\p{N}]+(?:['’.][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu
const tokens = (s: string) => s.match(TOKEN) ?? []
const words = (s: string) => tokens(s).filter((t) => /\S/.test(t))

function push(out: Segment[], op: Op, text: string) {
  if (!text) return
  const last = out[out.length - 1]
  if (last?.op === op) last.text += text
  else out.push({ op, text })
}

/** The longest common subsequence of two token runs, as segments. */
function lcsSegments(a: string[], b: string[]): Segment[] {
  const n = a.length
  const m = b.length
  const L = new Uint32Array((n + 1) * (m + 1))
  const at = (i: number, j: number) => i * (m + 1) + j
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[at(i, j)] = a[i] === b[j] ? L[at(i + 1, j + 1)] + 1 : Math.max(L[at(i + 1, j)], L[at(i, j + 1)])
  const out: Segment[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(out, "equal", a[i++])
      j++
    } else if (L[at(i + 1, j)] >= L[at(i, j + 1)]) push(out, "delete", a[i++])
    else push(out, "insert", b[j++])
  }
  while (i < n) push(out, "delete", a[i++])
  while (j < m) push(out, "insert", b[j++])
  return out
}

/**
 * Hunks as a drafter reads them: each run of changes is one deletion then one
 * insertion, and a stretch of bare whitespace or punctuation between two
 * changes is taken into the change rather than left standing alone.
 */
function tidy(segments: Segment[]): Segment[] {
  const out: Segment[] = []
  let del = ""
  let ins = ""
  const flush = () => {
    push(out, "delete", del)
    push(out, "insert", ins)
    del = ""
    ins = ""
  }
  segments.forEach((s, i) => {
    if (s.op === "delete") del += s.text
    else if (s.op === "insert") ins += s.text
    else if ((del || ins) && i < segments.length - 1 && !/[\p{L}\p{N}]/u.test(s.text)) {
      del += s.text
      ins += s.text
    } else {
      flush()
      push(out, "equal", s.text)
    }
  })
  flush()
  return out
}

/** Two runs of text, word by word. */
export function diffText(a: string, b: string): Segment[] {
  if (a === b) return a ? [{ op: "equal", text: a }] : []
  const A = tokens(a)
  const B = tokens(b)
  let pre = 0
  while (pre < A.length && pre < B.length && A[pre] === B[pre]) pre++
  let suf = 0
  while (suf < A.length - pre && suf < B.length - pre && A[A.length - 1 - suf] === B[B.length - 1 - suf]) suf++
  const midA = A.slice(pre, A.length - suf)
  const midB = B.slice(pre, B.length - suf)
  const out: Segment[] = []
  push(out, "equal", A.slice(0, pre).join(""))
  if (midA.length * midB.length > 4_000_000) {
    push(out, "delete", midA.join(""))
    push(out, "insert", midB.join(""))
  } else for (const s of lcsSegments(midA, midB)) push(out, s.op, s.text)
  push(out, "equal", A.slice(A.length - suf).join(""))
  return tidy(out)
}

// ------------------------------------------------------------- children ---

type Entry = { node: PmNode; offset: number }
type Pair = { base: Entry | null; fork: Entry | null }

const entries = (n: PmNode): Entry[] => {
  const out: Entry[] = []
  n.forEach((node, offset) => out.push({ node, offset }))
  return out
}

const PARTS = new Set(["num", "heading", "subheading", "preface", "longTitle", "enactingFormula", "resolvingClause", "preamble"])

/** What makes a child the same unit on both sides: its identifier, else its element and number; a level part by its name. */
function strongKey(n: PmNode): string | null {
  const name = n.type.name
  if (isLevel(name)) {
    if (n.attrs.identifier) return `id:${n.attrs.identifier}`
    const v = numOf(n)
    return v ? `num:${elementOf(n)}:${v}` : null
  }
  return PARTS.has(name) ? `part:${name}` : null
}

/** Keys that repeat on one side name nothing: only the first keeps its key. */
function uniqueKeys(list: Entry[]): (string | null)[] {
  const seen = new Set<string>()
  return list.map((e) => {
    const k = strongKey(e.node)
    if (k == null || seen.has(k)) return null
    seen.add(k)
    return k
  })
}

/** The longest run of pairs whose base indexes increase, in fork order. */
function increasing(pairs: [number, number][]): [number, number][] {
  const tails: number[] = []
  const prev = new Array<number>(pairs.length).fill(-1)
  for (let i = 0; i < pairs.length; i++) {
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (pairs[tails[mid]][0] < pairs[i][0]) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) prev[i] = tails[lo - 1]
    tails[lo] = i
  }
  const out: [number, number][] = []
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) out.push(pairs[i])
  return out.reverse()
}

function lcsPairs(a: string[], b: string[]): [number, number][] {
  const n = a.length
  const m = b.length
  const L = new Uint32Array((n + 1) * (m + 1))
  const at = (i: number, j: number) => i * (m + 1) + j
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[at(i, j)] = a[i] === b[j] ? L[at(i + 1, j + 1)] + 1 : Math.max(L[at(i + 1, j)], L[at(i, j + 1)])
  const out: [number, number][] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) out.push([i++, j++])
    else if (L[at(i + 1, j)] >= L[at(i, j + 1)]) i++
    else j++
  }
  return out
}

function similarity(a: string, b: string): number {
  const A = words(a.toLowerCase())
  const B = words(b.toLowerCase())
  if (!A.length && !B.length) return 1
  const counts = new Map<string, number>()
  for (const w of A) counts.set(w, (counts.get(w) ?? 0) + 1)
  let common = 0
  for (const w of B) {
    const c = counts.get(w) ?? 0
    if (c > 0) {
      common++
      counts.set(w, c - 1)
    }
  }
  return (2 * common) / (A.length + B.length)
}

/** Whether an unmatched base child and fork child are one unit edited. Different keys are different units, unless neither has an identifier and the text is mostly the same. */
function compatible(a: Entry, b: Entry, ka: string | null, kb: string | null): boolean {
  if (a.node.type.name !== b.node.type.name || elementOf(a.node) !== elementOf(b.node)) return false
  if (!isLevel(a.node.type.name)) return true
  if (ka === kb) return true
  if (a.node.attrs.identifier || b.node.attrs.identifier) return false
  return similarity(a.node.textContent, b.node.textContent) >= 0.5
}

function pairLoose(A: Entry[], B: Entry[], ka: (string | null)[], kb: (string | null)[]): Pair[] {
  const out: Pair[] = []
  let j = 0
  for (let i = 0; i < A.length; i++) {
    let f = -1
    for (let t = j; t < B.length; t++) {
      if (compatible(A[i], B[t], ka[i], kb[t])) {
        f = t
        break
      }
    }
    if (f < 0) {
      out.push({ base: A[i], fork: null })
      continue
    }
    for (let t = j; t < f; t++) out.push({ base: null, fork: B[t] })
    out.push({ base: A[i], fork: B[f] })
    j = f + 1
  }
  for (let t = j; t < B.length; t++) out.push({ base: null, fork: B[t] })
  return out
}

function alignGap(A: Entry[], B: Entry[], ka: (string | null)[], kb: (string | null)[]): Pair[] {
  if (!A.length) return B.map((fork) => ({ base: null, fork }))
  if (!B.length) return A.map((base) => ({ base, fork: null }))
  const sig = (e: Entry, k: string | null) => `${e.node.type.name} ${elementOf(e.node)} ${k ?? ""} ${e.node.textContent}`
  const exact = A.length * B.length <= 250_000 ? lcsPairs(A.map((e, i) => sig(e, ka[i])), B.map((e, i) => sig(e, kb[i]))) : []
  const out: Pair[] = []
  let i = 0
  let j = 0
  for (const [x, y] of [...exact, [A.length, B.length] as [number, number]]) {
    out.push(...pairLoose(A.slice(i, x), B.slice(j, y), ka.slice(i, x), kb.slice(j, y)))
    if (x < A.length) out.push({ base: A[x], fork: B[y] })
    i = x + 1
    j = y + 1
  }
  return out
}

/** A parent's children on both sides, in order: keyed units anchor, and the rest pair by position and likeness between the anchors. */
function align(A: Entry[], B: Entry[]): Pair[] {
  const ka = uniqueKeys(A)
  const kb = uniqueKeys(B)
  const baseIndex = new Map<string, number>()
  ka.forEach((k, i) => k != null && baseIndex.set(k, i))
  const candidates: [number, number][] = []
  kb.forEach((k, bi) => {
    const ai = k == null ? undefined : baseIndex.get(k)
    if (ai !== undefined && A[ai].node.type.name === B[bi].node.type.name) candidates.push([ai, bi])
  })
  const out: Pair[] = []
  let ai = 0
  let bi = 0
  for (const [x, y] of [...increasing(candidates), [A.length, B.length] as [number, number]]) {
    out.push(...alignGap(A.slice(ai, x), B.slice(bi, y), ka.slice(ai, x), kb.slice(bi, y)))
    if (x < A.length) out.push({ base: A[x], fork: B[y] })
    ai = x + 1
    bi = y + 1
  }
  return out
}

function diffPair(base: PmNode, fork: PmNode, basePos: number, forkPos: number): DiffNode {
  const type = fork.type.name
  if (base.isTextblock) {
    const a = textOf(base)
    const b = textOf(fork)
    return { status: a === b ? "same" : "changed", type, base, fork, basePos, forkPos, children: [], segments: a === b ? null : diffText(a, b) }
  }
  if (base.isLeaf) return { status: "same", type, base, fork, basePos, forkPos, children: [], segments: null }
  const children: DiffNode[] = []
  let baseEnd = basePos + 1
  let forkEnd = forkPos + 1
  for (const p of align(entries(base), entries(fork))) {
    if (p.base && p.fork) {
      const d = diffPair(p.base.node, p.fork.node, basePos + 1 + p.base.offset, forkPos + 1 + p.fork.offset)
      children.push(d)
      baseEnd = d.basePos + p.base.node.nodeSize
      forkEnd = d.forkPos + p.fork.node.nodeSize
    } else if (p.base) {
      const at = basePos + 1 + p.base.offset
      children.push({ status: "deleted", type: p.base.node.type.name, base: p.base.node, fork: null, basePos: at, forkPos: forkEnd, children: [], segments: null })
      baseEnd = at + p.base.node.nodeSize
    } else if (p.fork) {
      const at = forkPos + 1 + p.fork.offset
      children.push({ status: "inserted", type: p.fork.node.type.name, base: null, fork: p.fork.node, basePos: baseEnd, forkPos: at, children: [], segments: null })
      forkEnd = at + p.fork.node.nodeSize
    }
  }
  const status: Status = children.every((c) => c.status === "same") ? "same" : "changed"
  return { status, type, base, fork, basePos, forkPos, children, segments: null }
}

/** The fork against its dated base, node by node, then word by word inside each changed text block. */
export function diffDocs(base: PmNode, fork: PmNode): DiffNode {
  return diffPair(base, fork, -1, -1)
}

/** Every changed, inserted or deleted node, for a count or a test. */
export function changes(d: DiffNode, out: DiffNode[] = []): DiffNode[] {
  if (d.status === "inserted" || d.status === "deleted" || (d.status === "changed" && d.segments)) out.push(d)
  else for (const c of d.children) changes(c, out)
  return out
}

// ========================================================= conventions ===

/**
 * How a jurisdiction writes an amendment. Small at first: the federal
 * "strike … and insert …" form, New York's section amended to read as
 * follows with new matter underscored and omitted matter in brackets, and
 * every other state on New York's shape until it has a row of its own.
 * Page-and-line instructions need the printing's page and line markers,
 * which the reader's document does not keep yet, so no row uses them.
 */
export type Convention = {
  key: string
  form: "strike-insert" | "read-as-follows"
  /** How new matter is set in the marked text. */
  newMatter: "underscored" | "italic" | "plain"
  /** How omitted matter is set in the marked text. */
  omittedMatter: "brackets" | "struck"
  /** The bill section that carries the first instruction, and the rest ("{n}" is the number). */
  lead: { first: string; rest: string } | null
}

export const CONVENTIONS: Record<string, Convention> = {
  us: { key: "us", form: "strike-insert", newMatter: "plain", omittedMatter: "struck", lead: null },
  "us-ny": { key: "us-ny", form: "read-as-follows", newMatter: "underscored", omittedMatter: "brackets", lead: { first: "Section 1.", rest: "§ {n}." } },
}

const STATE_CONVENTION: Convention = { key: "state", form: "read-as-follows", newMatter: "underscored", omittedMatter: "struck", lead: { first: "Section 1.", rest: "Sec. {n}." } }

export const conventionFor = (jurisdiction: string): Convention => CONVENTIONS[jurisdiction] ?? STATE_CONVENTION

/** What the amended law is and how an instruction names it. */
export type Citation = {
  /** "us", "us-ny" */
  jurisdiction: string
  /** The address's kind: "bill", "usc", "code", "const", "pl". */
  kind: string
  /** The stored Work the base was read from: "/us-ny/code/agm/s16". */
  work: string
  /** The law's name as a sentence carries it: "agriculture and markets law", "Government Code". */
  name?: string | null
}

/** New York's consolidated laws as a bill names them, by the address's code. */
export const NY_LAWS: Record<string, string> = {
  agm: "agriculture and markets law", abc: "alcoholic beverage control law", bnk: "banking law", bsc: "business corporation law",
  cvp: "civil practice law and rules", cvr: "civil rights law", cvs: "civil service law", cpl: "criminal procedure law",
  dom: "domestic relations law", edn: "education law", eln: "election law", env: "environmental conservation law", exc: "executive law",
  fis: "state finance law", gbs: "general business law", gmu: "general municipal law", ins: "insurance law", lab: "labor law",
  mhy: "mental hygiene law", pbh: "public health law", pen: "penal law", ppd: "public officers law", rpp: "real property law",
  rpt: "real property tax law", sos: "social services law", tax: "tax law", vat: "vehicle and traffic law", veh: "vehicle and traffic law",
}

// ========================================================= designation ===

type Unit = { element: string; role: string | null; value: string }
type Designation = { title: string | null; section: string | null; bigs: Unit[]; smalls: Unit[]; below?: string[] }

const BIG_PREFIX: [RegExp, string][] = [
  [/^sart(.+)$/, "subarticle"], [/^sch(.+)$/, "subchapter"], [/^spt(.+)$/, "subpart"], [/^sd(.+)$/, "subdivision"], [/^st(.+)$/, "subtitle"],
  [/^art(.+)$/, "article"], [/^ch(.+)$/, "chapter"], [/^pt(.+)$/, "part"], [/^d(.+)$/, "division"], [/^t(.+)$/, "title"],
]

/** What an address says above the section: the US Code's title, a bill's big levels, the section itself. */
function fromAddress(address: string): Designation {
  const m = /^\/[a-z-]+\/([a-z]+)\/(.+?)(?:@.*)?$/.exec(address)
  const out: Designation = { title: null, section: null, bigs: [], smalls: [], below: [] }
  if (!m) return out
  const [, kind, rest] = m
  const segs = rest.split("/")
  const skip = kind === "bill" ? 3 : kind === "pl" ? 2 : kind === "code" ? 1 : 0
  for (const seg of segs.slice(skip)) {
    if (out.section) {
      out.below!.push(seg)
      continue
    }
    const s = /^s(\d.*)$/.exec(seg)
    if (s) {
      out.section = s[1]
      continue
    }
    const big = BIG_PREFIX.find(([re]) => re.test(seg))
    if (!big) continue
    const value = big[0].exec(seg)![1]
    if (kind === "usc" && big[1] === "title") out.title = value
    else out.bigs.push({ element: big[1], role: null, value })
  }
  return out
}

const unitOf = (n: PmNode): Unit => ({ element: elementOf(n), role: (n.attrs.role as string | null) ?? null, value: numOf(n) ?? "" })

/** A unit's place in the law, from the levels above it in the document and, where the document starts below the section, from the address. */
function designate(levels: PmNode[], cite: Citation): Designation {
  const units = levels.map(unitOf)
  const s = units.findIndex((u) => u.element === "section")
  const address = fromAddress(String(levels[0]?.attrs.identifier ?? cite.work))
  const above = s >= 0 ? units.slice(0, s) : units.filter((u) => BIG.has(u.element))
  let smalls = (s >= 0 ? units.slice(s + 1) : units).filter((u) => SMALL.has(u.element) || u.element === "level")
  // A document that starts below the section (a fork of 130i(b)(1)) takes the levels between from its address,
  // named by rank above its own top level: "b" over a paragraph is a subsection.
  if (s < 0 && smalls.length && address.section) {
    const between = (address.below ?? []).slice(0, -1)
    const rank = SMALL_LEVELS.indexOf(smalls[0].element as (typeof SMALL_LEVELS)[number])
    smalls = [...between.map((value, j): Unit => ({ element: SMALL_LEVELS[rank - between.length + j] ?? "level", role: null, value })), ...smalls]
  }
  return {
    title: address.title,
    section: s >= 0 ? units[s].value : address.section,
    bigs: above.filter((u) => BIG.has(u.element)).length ? above.filter((u) => BIG.has(u.element)) : address.bigs,
    smalls,
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** A unit as a sentence's subject: "Section 130i of title 10, United States Code," closes its citation with a comma. */
const subject = (unit: string) => `${cap(unit)}${/United States Code$/.test(unit) ? "," : ""}`
const listOf = (items: string[]) => (items.length <= 1 ? (items[0] ?? "") : items.length === 2 ? `${items[0]} and ${items[1]}` : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`)
const COUNT = ["", "a", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
const ORDINAL = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]

// Federal: "section 130i(a)(1) of title 10, United States Code"; "paragraph (3)".
const fedWord = (u: Unit) => (u.element === "level" ? (u.role ?? "level") : u.element)
const fedOne = (u: Unit) => (SMALL.has(u.element) || u.element === "level" ? `${fedWord(u)} (${u.value})` : `${fedWord(u)} ${u.value}`)

function federalUnit(d: Designation, cite: Citation): string {
  if (d.section) {
    const base = `section ${d.section}${d.smalls.map((u) => `(${u.value})`).join("")}`
    if (cite.kind === "usc") return `${base} of title ${d.title ?? "?"}, United States Code`
    if (cite.kind === "bill") return base
    return cite.name ? `${base} of ${cite.name}` : base
  }
  const chain = [...d.smalls].reverse().map(fedOne).concat([...d.bigs].reverse().map(fedOne))
  return chain.join(" of ") || (cite.kind === "bill" ? "the bill" : (cite.name ?? cite.work))
}

// New York: "paragraph (a) of subdivision 1 of section 16 of the agriculture and markets law".
const nyWord = (u: Unit) => u.role ?? (u.element === "subsection" ? "subdivision" : u.element)
const nyValue = (u: Unit) => (nyWord(u) === "subdivision" || !(SMALL.has(u.element) || u.element === "level") ? u.value : `(${u.value})`)
const nyOne = (u: Unit) => `${nyWord(u)} ${nyValue(u)}`

function lawName(cite: Citation): string {
  if (cite.name) return cite.name
  if (cite.kind === "const") return "constitution"
  const code = /^\/[a-z-]+\/code\/([^/]+)/.exec(cite.work)?.[1] ?? ""
  return (cite.jurisdiction === "us-ny" && NY_LAWS[code]) || `${code.toUpperCase()} law`
}

function stateUnit(d: Designation, cite: Citation): string {
  const parts = [...d.smalls].reverse().map(nyOne)
  if (d.section) parts.push(`section ${d.section}`)
  parts.push(...[...d.bigs].reverse().map((u) => `${u.element} ${u.value}`))
  parts.push(`the ${lawName(cite)}`)
  return parts.join(" of ")
}

// ============================================================ the text ===

export type Run = { op: Op; text: string }
export type Line = { depth: number; runs: Run[] }

/** A node's children as diff nodes: a changed node's own, or its children carrying its status. */
function kidsOf(d: DiffNode): DiffNode[] {
  if (d.status === "changed") return d.children
  const node = (d.fork ?? d.base)!
  const out: DiffNode[] = []
  node.forEach((child) => out.push({ status: d.status, type: child.type.name, base: d.base ? child : null, fork: d.fork ? child : null, basePos: -1, forkPos: -1, children: [], segments: null }))
  return out
}

function runsOf(d: DiffNode): Run[] {
  if (d.segments) return d.segments.map((s) => ({ ...s }))
  const node = (d.fork ?? d.base)!
  const text = textOf(node)
  return text ? [{ op: d.status === "inserted" ? "insert" : d.status === "deleted" ? "delete" : "equal", text }] : []
}

/** How a number is printed: New York's "1." and "(a)", the source's own elsewhere. */
function printedNum(level: PmNode, runs: Run[], convention: Convention): Run[] {
  if (convention.key !== "us-ny" || runs.length !== 1) return runs
  const text = runs[0].text.trim()
  const element = elementOf(level)
  if (element === "section") return [{ ...runs[0], text: /\.$/.test(text) ? text : `${text}.` }]
  if (!/^[\p{L}\p{N}-]+$/u.test(text)) return runs
  const role = (level.attrs.role as string | null) ?? (element === "subsection" ? "subdivision" : element)
  return [{ ...runs[0], text: role === "subdivision" ? `${text}.` : `(${text})` }]
}

const joinRuns = (a: Run[], b: Run[]): Run[] => (a.length && b.length ? [...a, { op: "equal", text: " " }, ...b] : [...a, ...b])

/** A unit's text as lines, a level's number and heading leading its first line, deeper levels indented, each run marked as the diff has it. */
export function linesOf(d: DiffNode, convention: Convention, depth = 0, out: Line[] = []): Line[] {
  const node = (d.fork ?? d.base)!
  if (node.isTextblock) {
    const runs = runsOf(d)
    if (runs.length) out.push({ depth, runs })
    return out
  }
  if (!isLevel(d.type)) {
    for (const k of kidsOf(d)) linesOf(k, convention, d.type === "quotedContent" ? depth + 1 : depth, out)
    return out
  }
  let lead: Run[] = []
  let led = false
  const flushLead = () => {
    if (!led && lead.length) out.push({ depth, runs: lead })
    led = true
  }
  for (const k of kidsOf(d)) {
    if (!led && (k.type === "num" || k.type === "heading")) {
      lead = joinRuns(lead, k.type === "num" ? printedNum(node, runsOf(k), convention) : runsOf(k))
      continue
    }
    if (isLevel(k.type)) {
      flushLead()
      linesOf(k, convention, depth + 1, out)
      continue
    }
    if (!led) {
      const first: Line[] = []
      linesOf(k, convention, depth, first)
      if (first.length) {
        out.push({ depth, runs: joinRuns(lead, first[0].runs) }, ...first.slice(1))
        led = true
        continue
      }
    }
    linesOf(k, convention, depth, out)
  }
  flushLead()
  return out
}

/** Lines as plain text: omitted matter in brackets, new matter as it reads. */
export function linesText(lines: Line[]): string {
  return lines.map((l) => `${"  ".repeat(l.depth)}${l.runs.map((r) => (r.op === "delete" ? `[${r.text}]` : r.text)).join("")}`).join("\n")
}

// ======================================================== instructions ===

export type Instruction = {
  /** The unit amended, as its identifier where it has one. */
  unit: string | null
  /** The instruction as printed. */
  text: string
  /** The matter it quotes: the new text, or (New York) the unit marked. */
  body: Line[] | null
}

export type Amendment = { convention: Convention; instructions: Instruction[] }

const clip = (s: string) => s.replace(/￼/g, "").replace(/\s+/g, " ").trim()
const quote = (s: string) => `“${clip(s)}”`

function occurrences(text: string, phrase: string): number[] {
  const out: number[] = []
  if (!phrase) return out
  for (let i = text.indexOf(phrase); i >= 0; i = text.indexOf(phrase, i + 1)) out.push(i)
  return out
}

/** The start of the word before `i` (skipping the space before it). */
const wordBefore = (text: string, i: number) => {
  let k = i
  while (k > 0 && /\s/.test(text[k - 1])) k--
  while (k > 0 && /\S/.test(text[k - 1])) k--
  return k
}
const wordAfter = (text: string, i: number) => {
  let k = i
  while (k < text.length && /\s/.test(text[k])) k++
  while (k < text.length && /\S/.test(text[k])) k++
  return k
}

/** The span [s, e) grown a word at a time, up to three each way, until the words in it appear once in the text. */
function uniqueSpan(text: string, s: number, e: number): { s: number; e: number; ordinal: number } {
  let a = s
  let b = e
  for (let grow = 0; grow < 6; grow++) {
    const found = occurrences(text, text.slice(a, b).trim())
    if (found.length <= 1) return { s: a, e: b, ordinal: 0 }
    if (grow % 2 === 0 && a > 0) a = wordBefore(text, a)
    else if (b < text.length) b = wordAfter(text, b)
    else if (a > 0) a = wordBefore(text, a)
    else break
  }
  const phrase = text.slice(s, e).trim()
  const found = occurrences(text, phrase)
  const at = s + (text.slice(s, e).length - text.slice(s, e).trimStart().length)
  return { s, e, ordinal: found.length > 1 ? found.indexOf(at) + 1 : 0 }
}

type Action =
  | { kind: "strike"; prefix: string | null; strike: string; ordinal: number }
  | { kind: "strike-insert"; prefix: string | null; strike: string; insert: string; ordinal: number }
  | { kind: "insert-after" | "insert-before"; prefix: string | null; insert: string; anchor: string; ordinal: number }
  | { kind: "add-end"; prefix: string | null; insert: string }
  | { kind: "strike-unit"; prefix: null; unit: Unit }
  | { kind: "redesignate"; prefix: null; from: Unit[]; to: Unit[] }

/** A changed text block's hunks as strikes and insertions, each phrase made unique in its part or placed by ordinal. */
function textActions(d: DiffNode, prefix: string | null): Action[] {
  if (d.status === "inserted") return [{ kind: "add-end", prefix, insert: textOf(d.fork!) }]
  if (d.status === "deleted") return [{ kind: "strike", prefix, strike: textOf(d.base!), ordinal: 0 }]
  const base = textOf(d.base!)
  const out: Action[] = []
  const segs = d.segments ?? []
  let k = 0
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (s.op === "equal") {
      k += s.text.length
      continue
    }
    let del = ""
    let ins = ""
    while (i < segs.length && segs[i].op !== "equal") {
      if (segs[i].op === "delete") del += segs[i].text
      else ins += segs[i].text
      i++
    }
    i--
    const start = k
    const end = k + del.length
    k = end
    if (clip(del)) {
      const span = uniqueSpan(base, start, end)
      const strike = base.slice(span.s, span.e)
      const insert = base.slice(span.s, start) + ins + base.slice(end, span.e)
      out.push(clip(insert) ? { kind: "strike-insert", prefix, strike, insert, ordinal: span.ordinal } : { kind: "strike", prefix, strike, ordinal: span.ordinal })
    } else if (clip(ins)) {
      if (clip(base.slice(0, start))) {
        const span = uniqueSpan(base, wordBefore(base, start), start)
        out.push({ kind: "insert-after", prefix, insert: ins, anchor: base.slice(span.s, span.e), ordinal: span.ordinal })
      } else {
        const span = uniqueSpan(base, start, wordAfter(base, start))
        out.push({ kind: "insert-before", prefix, insert: ins, anchor: base.slice(span.s, span.e), ordinal: span.ordinal })
      }
    }
  }
  return out
}

/** Consecutive redesignations of one kind of unit read as one: "paragraphs (3) and (4) as paragraphs (4) and (5), respectively". */
function mergeRedesignations(actions: Action[]): Action[] {
  const out: Action[] = []
  for (const a of actions) {
    const last = out[out.length - 1]
    if (a.kind === "redesignate" && last?.kind === "redesignate" && fedWord(last.from[0]) === fedWord(a.from[0])) {
      last.from.push(...a.from)
      last.to.push(...a.to)
    } else out.push(a.kind === "redesignate" ? { ...a, from: [...a.from], to: [...a.to] } : a)
  }
  return out
}

function unitsPhrase(units: Unit[], word: (u: Unit) => string, value: (u: Unit) => string): string {
  const w = word(units[0])
  return units.length === 1 ? `${w} ${value(units[0])}` : `${w}s ${listOf(units.map(value))}`
}

function actionText(a: Action, codified: boolean): string {
  const by = codified ? "by " : ""
  const v = (participle: string, imperative: string) => (codified ? participle : imperative)
  const place = (n: number) => (n ? ` the ${ORDINAL[n] ?? `${n}th`} place it appears` : "")
  const fedValue = (u: Unit) => (SMALL.has(u.element) || u.element === "level" ? `(${u.value})` : u.value)
  switch (a.kind) {
    case "strike":
      return `${by}${v("striking", "strike")} ${quote(a.strike)}${place(a.ordinal)}`
    case "strike-insert":
      return `${by}${v("striking", "strike")} ${quote(a.strike)}${place(a.ordinal)} and ${v("inserting", "insert")} ${quote(a.insert)}`
    case "insert-after":
    case "insert-before":
      return `${by}${v("inserting", "insert")} ${quote(a.insert)} ${a.kind === "insert-after" ? "after" : "before"} ${quote(a.anchor)}${place(a.ordinal)}`
    case "add-end":
      return `${by}${v("adding", "add")} at the end the following: ${quote(a.insert)}`
    case "strike-unit":
      return `${by}${v("striking", "strike")} ${fedOne(a.unit)}`
    case "redesignate":
      return `${by}${v("redesignating", "redesignate")} ${unitsPhrase(a.from, fedWord, fedValue)} as ${unitsPhrase(a.to, fedWord, fedValue)}${a.from.length > 1 ? ", respectively" : ""}`
  }
}

function grouped(unit: string, actions: Action[], codified: boolean): string {
  const merged = mergeRedesignations(actions)
  if (merged.length === 1) {
    const [a] = merged
    return codified ? `${subject(unit)} is amended${a.prefix ? `, ${a.prefix},` : ""} ${actionText(a, true)}.` : `In ${unit}${a.prefix ? `, ${a.prefix}` : ""}, ${actionText(a, false)}.`
  }
  const items = merged.map((a, i) => `(${i + 1}) ${a.prefix ? `${a.prefix}, ` : ""}${actionText(a, codified)}${i === merged.length - 1 ? "." : i === merged.length - 2 ? "; and" : ";"}`)
  return `${codified ? `${subject(unit)} is amended—` : `In ${unit}—`}\n${items.join("\n")}`
}

/** Quotation marks around a quoted body, as federal drafting closes it: “ … ”. */
function quoted(lines: Line[]): Line[] {
  if (!lines.length) return lines
  const out = lines.map((l) => ({ ...l, runs: [...l.runs] }))
  out[0].runs.unshift({ op: "equal", text: "“" })
  out[out.length - 1].runs.push({ op: "equal", text: "”." })
  return out
}

const plainLines = (node: PmNode, convention: Convention) => linesOf({ status: "same", type: node.type.name, base: node, fork: node, basePos: -1, forkPos: -1, children: [], segments: null }, convention)

/** The share of a unit's words a fork changed. */
function changedShare(d: DiffNode): number {
  let changed = 0
  let total = 0
  const visit = (x: DiffNode) => {
    const node = (x.fork ?? x.base)!
    if (node.isTextblock) {
      if (x.status !== "inserted") total += words(textOf(x.base!)).length
      if (x.segments) for (const s of x.segments) if (s.op !== "equal") changed += words(s.text).length
      if (x.status === "inserted" || x.status === "deleted") changed += words(textOf(node)).length
      return
    }
    if (x.status === "inserted" || x.status === "deleted") {
      node.descendants((n) => {
        if (n.isTextblock) {
          const w = words(textOf(n)).length
          changed += w
          if (x.status === "deleted") total += w
          return false
        }
        return true
      })
      return
    }
    if (x.status === "same") {
      total += words(node.textContent).length
      return
    }
    x.children.forEach(visit)
  }
  visit(d)
  return total ? changed / total : 1
}

/** Only the number changed: a redesignation, not an amendment of the text. */
function onlyNumChanged(d: DiffNode): boolean {
  return d.status === "changed" && d.children.every((c) => c.status === "same" || (c.type === "num" && c.status === "changed"))
}

const baseUnit = (d: DiffNode) => unitOf(d.base ?? d.fork!)
const forkUnit = (d: DiffNode) => unitOf(d.fork ?? d.base!)

/** The words a part of a level sits in, for "in the heading" and "in the matter preceding paragraph (1)". */
function partPrefix(kids: DiffNode[], i: number): string | null {
  const k = kids[i]
  if (k.type === "heading") return "in the heading"
  if (k.type === "subheading") return "in the subheading"
  const prev = [...kids.slice(0, i)].reverse().find((x) => isLevel(x.type) && x.base)
  const next = kids.slice(i + 1).find((x) => isLevel(x.type) && x.base)
  if (k.type === "continuation" && prev) return `in the matter following ${fedOne(baseUnit(prev))}`
  if (k.type === "chapeau" && next) return `in the matter preceding ${fedOne(baseUnit(next))}`
  if (prev) return `in the matter following ${fedOne(baseUnit(prev))}`
  if (next) return `in the matter preceding ${fedOne(baseUnit(next))}`
  return null
}

/** The changed text blocks under a node, not crossing into a level. */
function ownBlocks(d: DiffNode, out: DiffNode[] = []): DiffNode[] {
  if (d.status === "same" || d.type === "num") return out
  const node = (d.fork ?? d.base)!
  if (node.isTextblock) out.push(d)
  else if (d.status === "changed") {
    for (const c of d.children) if (!isLevel(c.type)) ownBlocks(c, out)
  } else out.push(...linesToBlocks(d))
  return out
}

/** An inserted or deleted container (a whole `content`) as its text blocks, each carrying its status. */
function linesToBlocks(d: DiffNode): DiffNode[] {
  const out: DiffNode[] = []
  ;(d.fork ?? d.base)!.descendants((n) => {
    if (!n.isTextblock) return true
    out.push({ status: d.status, type: n.type.name, base: d.base ? n : null, fork: d.fork ? n : null, basePos: -1, forkPos: -1, children: [], segments: null })
    return false
  })
  return out
}

function federal(root: DiffNode, cite: Citation, convention: Convention): Instruction[] {
  const codified = cite.kind !== "bill"
  const out: Instruction[] = []
  const workUnit = cite.kind === "usc" ? `title ${fromAddress(cite.work).title ?? "?"}, United States Code` : codified ? (cite.name ?? cite.work) : null

  const visit = (d: DiffNode, levels: PmNode[]) => {
    if (d.status !== "changed") return
    const node = d.fork!
    const here = isLevel(d.type) ? [...levels, node] : levels
    const unit = here.length ? federalUnit(designate(here, cite), cite) : workUnit
    const identifier = (node.attrs?.identifier as string | null) ?? null

    if (isLevel(d.type) && d.type !== "doc" && (SMALL.has(elementOf(node)) || elementOf(node) === "section") && changedShare(d) > 0.5 && unit) {
      out.push({ unit: identifier, text: codified ? `${subject(unit)} is amended to read as follows:` : `Strike ${unit} and insert the following:`, body: quoted(plainLines(node, convention)) })
      return
    }

    const kids = d.children
    const actions: Action[] = []
    const structural: Instruction[] = []
    const deeper: DiffNode[] = []
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i]
      if (k.status === "same") continue
      if (isLevel(k.type)) {
        if (k.status === "deleted") actions.push({ kind: "strike-unit", prefix: null, unit: baseUnit(k) })
        else if (k.status === "inserted") {
          const run: DiffNode[] = []
          while (i < kids.length && kids[i].status === "inserted" && isLevel(kids[i].type)) run.push(kids[i++])
          i--
          const prev = [...kids.slice(0, i - run.length + 1)].reverse().find((x) => isLevel(x.type) && x.base && x.fork)
          const next = kids.slice(i + 1).find((x) => isLevel(x.type) && x.base && x.fork)
          const body = quoted(run.flatMap((r) => plainLines(r.fork!, convention)))
          const where = next ? (prev ? `after ${fedOne(baseUnit(prev))}` : `before ${fedOne(baseUnit(next))}`) : null
          const text = codified
            ? `${subject(unit ?? "the law")} is amended by ${where ? `inserting ${where}` : "adding at the end"} the following:`
            : unit
              ? `In ${unit}, ${where ? `${where}, insert` : "add at the end"} the following:`
              : `${where ? `${cap(where)}, insert` : "At the end, add"} the following:`
          structural.push({ unit: identifier, text, body })
        } else {
          if (k.children.some((c) => c.type === "num" && c.status === "changed")) actions.push({ kind: "redesignate", prefix: null, from: [baseUnit(k)], to: [forkUnit(k)] })
          if (!onlyNumChanged(k)) deeper.push(k)
        }
        continue
      }
      if (k.type === "num") continue
      const prefix = partPrefix(kids, i)
      for (const block of ownBlocks(k)) actions.push(...textActions(block, block.type === "heading" ? "in the heading" : prefix))
    }
    if (actions.length && unit) out.push({ unit: identifier, text: grouped(unit, actions, codified), body: null })
    out.push(...structural)
    for (const k of deeper) visit(k, here)
  }
  visit(root, [])
  return out
}

function readAsFollows(root: DiffNode, cite: Citation, convention: Convention): Instruction[] {
  const out: Instruction[] = []
  const workUnit = `the ${lawName(cite)}`
  const nyUnitOf = (levels: PmNode[]) => stateUnit(designate(levels, cite), cite)

  const visit = (d: DiffNode, levels: PmNode[]) => {
    if (d.status !== "changed") return
    const node = d.fork!
    const here = isLevel(d.type) ? [...levels, node] : levels
    const unit = here.length ? nyUnitOf(here) : workUnit
    const identifier = (node.attrs?.identifier as string | null) ?? null
    const own = d.children.some((c) => !isLevel(c.type) && c.type !== "num" && c.status !== "same")
    if (own && here.length) {
      out.push({ unit: identifier, text: `${cap(unit)} is amended to read as follows:`, body: linesOf(d, convention) })
      return
    }
    const kids = d.children
    const repealed: Unit[] = []
    const from: Unit[] = []
    const to: Unit[] = []
    // Each instruction in document order; the repeal and renumbering sentence stands where its first unit does.
    const steps: (() => void)[] = []
    let sentence = false
    const sentenceStep = () => {
      if (sentence) return
      sentence = true
      steps.push(() => {
        const renumbered = from.length ? `${unitsPhrase(from, nyWord, nyValue)} ${from.length > 1 ? "are" : "is"} renumbered ${unitsPhrase(to, nyWord, nyValue)}` : ""
        if (repealed.length) out.push({ unit: identifier, text: `${cap(unitsPhrase(repealed, nyWord, nyValue))} of ${unit} ${repealed.length > 1 ? "are" : "is"} REPEALED${renumbered ? ` and ${renumbered}` : ""}.`, body: null })
        else out.push({ unit: identifier, text: `${cap(unitsPhrase(from, nyWord, nyValue))} of ${unit} ${from.length > 1 ? "are" : "is"} renumbered ${unitsPhrase(to, nyWord, nyValue)}.`, body: null })
      })
    }
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i]
      if (k.status === "same" || !isLevel(k.type)) continue
      if (k.status === "deleted") {
        repealed.push(baseUnit(k))
        sentenceStep()
      } else if (k.status === "inserted") {
        const run: DiffNode[] = []
        while (i < kids.length && kids[i].status === "inserted" && isLevel(kids[i].type)) run.push(kids[i++])
        i--
        const units = run.map(forkUnit)
        const what = run.length === 1 ? `a new ${nyOne(units[0])}` : `${COUNT[run.length] ?? run.length} new ${nyWord(units[0])}s ${listOf(units.map(nyValue))}`
        steps.push(() => out.push({ unit: identifier, text: `${cap(unit)} is amended by adding ${what} to read as follows:`, body: run.flatMap((r) => linesOf(r, convention)) }))
      } else if (onlyNumChanged(k)) {
        from.push(baseUnit(k))
        to.push(forkUnit(k))
        sentenceStep()
      } else steps.push(() => visit(k, here))
    }
    steps.forEach((f) => f())
  }
  visit(root, [])
  return out
}

/** The amendment a fork makes to its base, in the jurisdiction's convention. */
export function instructions(diff: DiffNode, cite: Citation): Amendment {
  const convention = conventionFor(cite.jurisdiction)
  const list = convention.form === "strike-insert" ? federal(diff, cite, convention) : readAsFollows(diff, cite, convention)
  if (convention.lead) list.forEach((ins, i) => (ins.text = `${i === 0 ? convention.lead!.first : convention.lead!.rest.replace("{n}", String(i + 1))} ${ins.text}`))
  return { convention, instructions: list }
}

/** The amendment as plain text, bodies indented under their instructions. */
export function amendmentText(amendment: Amendment): string {
  return amendment.instructions.map((i) => (i.body ? `${i.text}\n${linesText(i.body.map((l) => ({ ...l, depth: l.depth + 1 })))}` : i.text)).join("\n\n")
}

// ============================================================== marked ===

export type MarkedSpec =
  | { kind: "strike"; from: number; to: number }
  | { kind: "insert"; at: number; text: string }
  | { kind: "strike-block"; from: number; to: number }
  | { kind: "insert-block"; at: number; node: PmNode }

/** The redline in place: what to strike and insert over the base, as positions in the base. */
export function marked(d: DiffNode, out: MarkedSpec[] = []): MarkedSpec[] {
  if (d.status === "same") return out
  if (d.status === "inserted") {
    out.push({ kind: "insert-block", at: d.basePos, node: d.fork! })
    return out
  }
  if (d.status === "deleted") {
    out.push({ kind: "strike-block", from: d.basePos, to: d.basePos + d.base!.nodeSize })
    return out
  }
  if (d.segments) {
    let k = d.basePos + 1
    for (const s of d.segments) {
      if (s.op === "equal") k += s.text.length
      else if (s.op === "delete") {
        out.push({ kind: "strike", from: k, to: k + s.text.length })
        k += s.text.length
      } else out.push({ kind: "insert", at: k, text: s.text })
    }
    return out
  }
  for (const c of d.children) marked(c, out)
  return out
}

/** The text as the law would read with the amendment made. */
export const clean = (d: DiffNode): PmNode => d.fork!

// =========================================================== conflicts ===

export type Conflict = { unit: string | null; from: number; to: number; reason: string }

type Touch = { from: number; to: number; unit: string | null; unitFrom: number; unitTo: number }

function touches(d: DiffNode, unit: { id: string | null; from: number; to: number }, out: Touch[] = []): Touch[] {
  if (d.status === "same") return out
  const node = (d.base ?? d.fork)!
  const here = d.base && isLevel(d.type) && d.status === "changed" ? { id: (d.base.attrs.identifier as string | null) ?? null, from: d.basePos, to: d.basePos + d.base.nodeSize } : unit
  const add = (from: number, to: number) => out.push({ from, to, unit: here.id, unitFrom: here.from, unitTo: here.to })
  if (d.status === "inserted") add(d.basePos, d.basePos)
  else if (d.status === "deleted") add(d.basePos, d.basePos + node.nodeSize)
  else if (d.segments) {
    // One touch per hunk: a strike and the insertion that replaces it are one change.
    let k = d.basePos + 1
    let start = -1
    for (const s of d.segments) {
      if (s.op === "equal") {
        if (start >= 0) add(start, k)
        start = -1
        k += s.text.length
        continue
      }
      if (start < 0) start = k
      if (s.op === "delete") k += s.text.length
    }
    if (start >= 0) add(start, k)
  } else for (const c of d.children) touches(c, here, out)
  return out
}

const overlaps = (a: { from: number; to: number }, b: { from: number; to: number }) => (a.from === a.to || b.from === b.to ? a.from <= b.to && b.from <= a.to : a.from < b.to && b.from < a.to)

/**
 * Two amendments to one base, checked by legislative rule rather than merged.
 * Under the strike-and-insert form they conflict where they change the same
 * words (or insert at the same place); under the read-as-follows form, where
 * they restate the same unit, since each prints the whole unit. The first
 * version refuses and says why.
 */
export function conflicts(a: DiffNode, b: DiffNode, form: Convention["form"] = "strike-insert"): Conflict[] {
  const doc = { id: null, from: 0, to: (a.base ?? a.fork)!.content.size }
  const ta = touches(a, doc)
  const tb = touches(b, doc)
  const out: Conflict[] = []
  const seen = new Set<string>()
  for (const x of ta) {
    for (const y of tb) {
      const clash = form === "read-as-follows" ? overlaps({ from: x.unitFrom, to: x.unitTo }, { from: y.unitFrom, to: y.unitTo }) : overlaps(x, y)
      if (!clash) continue
      const key = form === "read-as-follows" ? `${x.unitFrom}:${y.unitFrom}` : `${x.from}:${y.from}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        unit: x.unit ?? y.unit,
        from: Math.min(x.from, y.from),
        to: Math.max(x.to, y.to),
        reason:
          form === "read-as-follows"
            ? `Both amendments restate ${x.unit ?? y.unit ?? "the same unit"}. A unit amended to read as follows is printed whole, so the second restatement replaces the first; they cannot both stand as drafted. Once both are enacted, the later in time prevails.`
            : `Both amendments change the same text${x.unit ?? y.unit ? ` in ${x.unit ?? y.unit}` : ""}. Text already amended is not open to a second amendment except by an amendment in the nature of a substitute; once both are enacted, the later in time prevails.`,
      })
    }
  }
  return out
}
