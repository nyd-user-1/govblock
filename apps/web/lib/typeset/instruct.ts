import type { Node as PmNode } from "@tiptap/pm/model"
import { Transform } from "@tiptap/pm/transform"

import { isLevel, SMALL_LEVELS } from "../xml/schema"
import { elementOf, numOf, similarity, textOf } from "./amend"
import { citationsOf, type Cite, type CiteContext } from "./cite"

// A bill's amendment instructions, read and carried out (window 6,
// 2026-09-14). The engine (amend.ts) writes instructions from an edited copy;
// this reads them back from a bill and carries them out on the statute they
// cite, so the in-context view can draw each affected statute with the
// bill's redline in place (diffDocs over the statute before and after).
//
//   H.R. 6644 § 101: "Section 106 of the Housing and Urban Development Act of
//   1968 (12 U.S.C. 1701x) is amended— (1) in subsection (a)(4)(C), by
//   striking “adequate distribution” and all that follows through
//   “foreclosure rates” and inserting “…”; (2) in subsection (e), by adding at
//   the end the following: [quoted paragraph (6)] …"
//
// The forms read are the ones the engine writes, plus "and all that follows
// through" and a unit replaced by quoted matter. Anything else is kept as
// "unread" with its words, never guessed. Pure; no `@/` imports.

export type Unit = { element: string; value: string }

export type Action =
  | { kind: "strike-insert"; strike: string; through: string | null; insert: string }
  | { kind: "strike"; strike: string; through: string | null }
  | { kind: "insert-after" | "insert-before"; insert: string; anchor: string }
  | { kind: "add-end"; matter: PmNode[] }
  | { kind: "insert-unit-after" | "insert-unit-before"; unit: Unit; matter: PmNode[] }
  | { kind: "replace-unit"; unit: Unit; matter: PmNode[] }
  | { kind: "strike-unit"; unit: Unit }
  | { kind: "redesignate"; from: Unit[]; to: Unit[] }
  | { kind: "read-as-follows"; matter: PmNode[] }
  | { kind: "unread"; text: string }

export type BillInstruction = {
  /** Where the instruction's words stand in the bill. */
  from: number
  to: number
  text: string
  /** The Work amended, from the citation that introduces the instructions. */
  work: string | null
  cite: Cite | null
  /** The portion within the Work, below the section: ["a", "4", "C"]. Empty for the section itself. */
  portion: string[]
  /** The part of the unit the words name: "in the heading", "in the matter preceding paragraph (1)". */
  part: string | null
  action: Action
}

// ----------------------------------------------------------------- words ---

const RANK_WORD = "(?:subsections?|paragraphs?|subparagraphs?|clauses?|subclauses?|items?|subitems?|sections?)"
const QUOTE = `[“"]([^”"]*)[”"]`
const singular = (word: string) => word.toLowerCase().replace(/s$/, "")
const SMALL = new Set<string>(SMALL_LEVELS)
const valuesOf = (s: string) => [...s.matchAll(/\(([A-Za-z0-9-]+)\)|\b(\d+[A-Za-z]?(?:-\d+)?)\b/g)].map((m) => m[1] ?? m[2])

/** "in subsection (a)(4)(C)," → the portion; "in the heading," → the part. The rest of the words are the action. */
function prefixOf(words: string): { portion: string[] | null; absolute: boolean; part: string | null; rest: string } {
  let rest = words
  let portion: string[] | null = null
  let absolute = false
  let part: string | null = null
  const unit = new RegExp(`^in (${RANK_WORD}) ((?:\\([A-Za-z0-9-]+\\))+|[0-9A-Za-z-]+)\\s*,?\\s*`, "i").exec(rest)
  if (unit) {
    portion = unit[2].includes("(") ? valuesOf(unit[2]) : [unit[2]]
    absolute = /^subsection/i.test(unit[1])
    rest = rest.slice(unit[0].length)
  }
  const named = new RegExp(`^in (the heading|the subheading|the matter (?:preceding|following) ${RANK_WORD} \\([A-Za-z0-9-]+\\)|the (?:first|second|third|last) sentence)\\s*,?\\s*`, "i").exec(rest)
  if (named) {
    part = `in ${named[1]}`
    rest = rest.slice(named[0].length)
  }
  return { portion, absolute, part, rest }
}

/** One instruction's action from its words; `matter` is the quoted law that follows it, if any. */
export function parseAction(words: string, matter: PmNode[] = []): Action {
  const w = words.replace(/\s+/g, " ").trim().replace(/^[,\s]+/, "").replace(/[;.]?\s*(?:and|or)?\s*$/i, "").replace(/[;,]$/, "")
  let m: RegExpExecArray | null
  // The words forms must be the whole instruction: "by striking “and” at the end of paragraph (3), by striking the period …"
  // names a place and two more actions, and read as a bare strike it would take the first “and” anywhere.
  if ((m = new RegExp(`^by striking ${QUOTE}(?: and all that follows through ${QUOTE})?,? and inserting ${QUOTE}$`, "i").exec(w))) return { kind: "strike-insert", strike: m[1], through: m[2] ?? null, insert: m[3] }
  if ((m = new RegExp(`^by inserting ${QUOTE} (after|before) ${QUOTE}$`, "i").exec(w))) return { kind: m[2].toLowerCase() === "after" ? "insert-after" : "insert-before", insert: m[1], anchor: m[3] }
  if ((m = new RegExp(`^by striking ${QUOTE}(?: and all that follows through ${QUOTE})?$`, "i").exec(w))) return { kind: "strike", strike: m[1], through: m[2] ?? null }
  const FOLLOWING = "the following(?: new [a-z]+)?:?"
  if (new RegExp(`^by adding at the end(?: thereof)? ${FOLLOWING}$`, "i").test(w)) return { kind: "add-end", matter }
  if ((m = new RegExp(`^by inserting (after|before) (${RANK_WORD}) \\(?([A-Za-z0-9-]+)\\)? ${FOLLOWING}$`, "i").exec(w))) return { kind: m[1].toLowerCase() === "after" ? "insert-unit-after" : "insert-unit-before", unit: { element: singular(m[2]), value: m[3] }, matter }
  if ((m = new RegExp(`^by striking (${RANK_WORD}) \\(?([A-Za-z0-9-]+)\\)? and inserting ${FOLLOWING}$`, "i").exec(w))) return { kind: "replace-unit", unit: { element: singular(m[1]), value: m[2] }, matter }
  if ((m = new RegExp(`^by redesignating (${RANK_WORD}) (.+?) as (?:${RANK_WORD}) (.+?)(?:, respectively)?$`, "i").exec(w))) {
    const element = singular(m[1])
    const from = valuesOf(m[2]).map((value) => ({ element, value }))
    const to = valuesOf(m[3]).map((value) => ({ element, value }))
    if (from.length && from.length === to.length) return { kind: "redesignate", from, to }
  }
  if ((m = new RegExp(`^by striking (${RANK_WORD}) \\(?([A-Za-z0-9-]+)\\)?$`, "i").exec(w))) return { kind: "strike-unit", unit: { element: singular(m[1]), value: m[2] } }
  if (/^(?:is amended )?to read as follows:?$/i.test(w)) return { kind: "read-as-follows", matter }
  return { kind: "unread", text: w }
}

/** An instruction's words, with the portion and part they name, read from its own text. */
export function parseInstruction(words: string, matter: PmNode[] = []): { portion: string[]; part: string | null; action: Action } {
  const prefix = prefixOf(words.trim())
  return { portion: prefix.portion ?? [], part: prefix.part, action: parseAction(prefix.rest, matter) }
}

// ------------------------------------------------------------ in a bill ---

const AMENDED = /\b(?:is|are)\s+(?:hereby\s+)?amended\b/i
const TARGET_KINDS = new Set(["usc", "code", "const", "pl", "bill"])

/**
 * A block's words as an instruction is read: quotation marks put back where
 * the document marks quoted text without printing them. GPO's introduced
 * printings carry “4 hours” as <quotedText>4 hours</quotedText>, so the text
 * alone reads "by striking 4 hours and inserting 3 hours". Positions are not
 * taken from these words.
 */
function wordsOf(block: PmNode): string {
  let out = ""
  let open = false
  const close = () => {
    if (open && !/[”"]$/.test(out)) out += "”"
    open = false
  }
  block.forEach((child) => {
    const quoted = child.isText && child.marks.some((m) => m.type.name === "quotedText")
    const text = child.isText ? child.text! : child.type.name === "br" ? "\n" : "￼"
    if (quoted && !open) {
      if (!/[“"]$/.test(out) && !/^[“"]/.test(text)) out += "“"
      open = true
    } else if (!quoted && open) {
      if (/^[”"]/.test(text)) open = false
      else close()
    }
    out += text
  })
  close()
  return out
}

/** A level's own words (its chapeau, or its content's first paragraph) and the quoted law that follows them, not crossing into child levels. */
function ownParts(level: PmNode, levelPos: number): { block: PmNode | null; blockPos: number; matter: PmNode[] } {
  let block: PmNode | null = null
  let blockPos = -1
  const matter: PmNode[] = []
  const take = (node: PmNode, pos: number) => {
    if (node.type.name === "quotedContent") {
      node.forEach((q) => isLevel(q.type.name) && matter.push(q))
      return
    }
    if (!block && node.isTextblock && node.type.name !== "num" && node.type.name !== "heading" && node.type.name !== "subheading") {
      block = node
      blockPos = pos
    }
  }
  level.forEach((child, offset) => {
    const pos = levelPos + 1 + offset
    if (isLevel(child.type.name)) return
    if (child.type.name === "content") child.forEach((grand, o) => take(grand, pos + 1 + o))
    else take(child, pos)
  })
  return { block, blockPos, matter }
}

/**
 * Every amendment instruction in a bill, in order. A block that says a law
 * "is amended" names the Work by its citation (the last one in the block,
 * which is the Code's parenthetical when the act is named by title); the
 * instruction is the rest of the block, or, where the block ends in a dash,
 * each level under it, nested lists narrowing the portion as they go.
 */
export function instructionsOf(doc: PmNode, ctx: CiteContext): BillInstruction[] {
  const cites = citationsOf(doc, ctx)
  const out: BillInstruction[] = []
  /** The portion a citation names below its Work: "Section 63(b) of the Internal Revenue Code" → ["b"]. */
  const citedPortion = (c: Cite | null) => (c?.work && c.address?.startsWith(`${c.work}/`) ? c.address.slice(c.work.length + 1).split("/").filter(Boolean) : [])

  const items = (parent: PmNode, parentPos: number, afterIndex: number, work: string | null, cite: Cite | null, portion: string[]) => {
    parent.forEach((child, offset, index) => {
      if (index <= afterIndex || !isLevel(child.type.name)) return
      const pos = parentPos + 1 + offset
      const { block, blockPos, matter } = ownParts(child, pos)
      if (!block) return
      const words = wordsOf(block)
      const prefix = prefixOf(words.trim())
      const here = prefix.portion ? (prefix.absolute ? prefix.portion : [...portion, ...prefix.portion]) : portion
      if (/[—–-]\s*$/.test(words)) {
        // "in subsection (i)—": the levels under it are the instructions, within (i).
        items(child, pos, -1, work, cite, here)
        return
      }
      out.push({ from: blockPos + 1, to: blockPos + 1 + block.content.size, text: words, work, cite, portion: here, part: prefix.part, action: parseAction(prefix.rest, matter) })
    })
  }

  const visit = (node: PmNode, pos: number) => {
    node.forEach((child, offset, index) => {
      const childPos = pos + 1 + offset
      if (child.type.name === "quotedContent") return
      if (isLevel(child.type.name)) {
        const { block, blockPos } = ownParts(child, childPos)
        if (block && AMENDED.test(textOf(block))) {
          const words = wordsOf(block)
          const target = cites.filter((c) => c.from >= blockPos && c.to <= blockPos + block.nodeSize && c.work && TARGET_KINDS.has(c.kind)).pop() ?? null
          const after = words.slice(words.search(AMENDED)).replace(AMENDED, "").trim()
          if (/^[—–-]?\s*$/.test(after)) {
            // The block's own index among the level's children: the items are the levels after it.
            let blockIndex = -1
            child.forEach((grand, o, i) => {
              if (childPos + 1 + o <= blockPos) blockIndex = i
            })
            items(child, childPos, blockIndex, target?.work ?? null, target, citedPortion(target))
          } else {
            const { matter } = ownParts(child, childPos)
            const prefix = prefixOf(after.replace(/^[,\s]+/, ""))
            const cited = citedPortion(target)
            const portion = prefix.portion ? (prefix.absolute ? prefix.portion : [...cited, ...prefix.portion]) : cited
            out.push({ from: blockPos + 1, to: blockPos + 1 + block.content.size, text: words, work: target?.work ?? null, cite: target, portion, part: prefix.part, action: parseAction(prefix.rest, matter) })
          }
          return
        }
        visit(child, childPos)
        return
      }
      if (!child.isTextblock) visit(child, childPos)
      void index
    })
  }
  visit(doc, -1)
  return out
}

// ---------------------------------------------------------- carried out ---

export type Outcome = {
  instruction: BillInstruction
  status: "applied" | "already-made" | "not-found" | "refused" | "unread" | "other-work"
  detail: string | null
}

type Found = { node: PmNode; pos: number }

function byIdentifier(doc: PmNode, identifier: string): Found | null {
  let found: Found | null = null
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.attrs?.identifier === identifier) found = { node, pos }
    return !found
  })
  return found
}

function childUnit(parent: Found, unit: Unit): Found | null {
  let found: Found | null = null
  parent.node.forEach((child, offset) => {
    if (found || !isLevel(child.type.name)) return
    if (elementOf(child) === unit.element && numOf(child) === unit.value) found = { node: child, pos: parent.pos + 1 + offset }
  })
  return found
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const WORDISH = /[\p{L}\p{N}]/u
/** A phrase as a pattern that forgives spacing, quotation marks and dashes, and never matches inside a word: “and” is not in “standard”. */
const loose = (phrase: string) => {
  const p = phrase.trim()
  const body = escape(p).replace(/\s+/g, "\\s+").replace(/[“”"]/g, "[“”\"]").replace(/[–—-]/g, "[–—-]")
  return new RegExp(`${WORDISH.test(p.charAt(0)) ? "(?<![\\p{L}\\p{N}])" : ""}${body}${WORDISH.test(p.charAt(p.length - 1)) ? "(?![\\p{L}\\p{N}])" : ""}`, "u")
}

const parentOf = (identifier: string) => identifier.slice(0, identifier.lastIndexOf("/"))

/** Quoted matter as it will stand in the statute: the level and every level under it addressed there, so the diff pairs it with the unit it replaces. */
function readdress(node: PmNode, identifier: string): PmNode {
  const children: PmNode[] = []
  const under = (parent: PmNode, id: string, out: PmNode[]) =>
    parent.forEach((child) => {
      const n = isLevel(child.type.name) ? numOf(child) : null
      if (n) out.push(readdress(child, `${id}/${n}`))
      else if (!child.isTextblock && !child.isLeaf && !isLevel(child.type.name)) {
        const inner: PmNode[] = []
        under(child, id, inner)
        out.push(child.type.create(child.attrs, inner, child.marks))
      } else out.push(child)
    })
  under(node, identifier, children)
  return node.type.create({ ...node.attrs, identifier }, children, node.marks)
}

/** A quoted unit inserted under a parent: a small level takes the parent's address and its own number; a section or larger keeps its own. */
const addressedUnder = (node: PmNode, parent: string) => {
  const n = isLevel(node.type.name) && SMALL.has(elementOf(node)) ? numOf(node) : null
  return n ? readdress(node, `${parent}/${n}`) : node
}

/** The first text block under a unit holding the words, and where they start and end in the document. */
function locate(unit: Found, strike: string, through: string | null): { from: number; to: number } | null {
  let hit: { from: number; to: number } | null = null
  unit.node.descendants((node, offset) => {
    if (hit) return false
    if (!node.isTextblock) return true
    const text = textOf(node)
    const start = loose(strike).exec(text)
    if (start) {
      let end = start.index + start[0].length
      if (through) {
        const tail = loose(through).exec(text.slice(end))
        if (!tail) return false
        end += tail.index + tail[0].length
      }
      const base = unit.pos + 1 + offset + 1
      hit = { from: base + start.index, to: base + end }
    }
    return false
  })
  return hit
}

const containsWords = (node: PmNode, words: string) => loose(words).test(node.textContent)

/** The instructions carried out, in order, on a statute; each says whether it applied, was already made, or why not. */
export function carryOut(statute: PmNode, instructions: BillInstruction[]): { doc: PmNode; outcomes: Outcome[] } {
  const schema = statute.type.schema
  let doc = statute
  const work = (statute.attrs.identifier as string | null) ?? null
  const outcomes: Outcome[] = []
  const copy = (nodes: PmNode[]) => nodes.map((n) => schema.nodeFromJSON(n.toJSON()))

  for (const ins of instructions) {
    const say = (status: Outcome["status"], detail: string | null = null) => outcomes.push({ instruction: ins, status, detail })
    if (ins.action.kind === "unread") {
      say("unread", ins.action.text)
      continue
    }
    if (!work || ins.work !== work) {
      say("other-work", ins.work)
      continue
    }
    const identifier = [work, ...ins.portion].join("/")
    const unit = byIdentifier(doc, identifier)
    if (!unit) {
      say("not-found", `${identifier} is not in this text`)
      continue
    }
    const a = ins.action
    try {
      const tr = new Transform(doc)
      switch (a.kind) {
        case "strike-insert":
        case "strike": {
          const at = locate(unit, a.strike, a.through)
          if (!at) {
            if (a.kind === "strike-insert" && containsWords(unit.node, a.insert)) say("already-made", "the inserted words are already in the text")
            else say("not-found", `“${a.strike}” is not in ${identifier}`)
            continue
          }
          if (a.kind === "strike-insert") tr.replaceWith(at.from, at.to, schema.text(a.insert))
          else tr.delete(at.from, at.to)
          break
        }
        case "insert-after":
        case "insert-before": {
          if (containsWords(unit.node, `${a.kind === "insert-after" ? a.anchor : ""} ${a.insert} ${a.kind === "insert-before" ? a.anchor : ""}`)) {
            say("already-made", "the inserted words already stand there")
            continue
          }
          const at = locate(unit, a.anchor, null)
          if (!at) {
            say("not-found", `“${a.anchor}” is not in ${identifier}`)
            continue
          }
          if (a.kind === "insert-after") tr.insert(at.to, schema.text(` ${a.insert.trim()}`))
          else tr.insert(at.from, schema.text(`${a.insert.trim()} `))
          break
        }
        case "add-end":
        case "insert-unit-after":
        case "insert-unit-before": {
          const matter = copy(a.matter)
          if (!matter.length) {
            say("unread", "no quoted matter follows the instruction")
            continue
          }
          const first = matter[0]
          const existing = isLevel(first.type.name) && numOf(first) ? childUnit(unit, { element: elementOf(first), value: numOf(first)! }) : null
          if (existing) {
            say("already-made", `${elementOf(first)} (${numOf(first)}) is already in ${identifier}`)
            continue
          }
          let pos = unit.pos + unit.node.nodeSize - 1
          if (a.kind !== "add-end") {
            const beside = childUnit(unit, a.unit)
            if (!beside) {
              say("not-found", `${a.unit.element} (${a.unit.value}) is not in ${identifier}`)
              continue
            }
            pos = a.kind === "insert-unit-after" ? beside.pos + beside.node.nodeSize : beside.pos
          }
          tr.insert(pos, matter.map((n) => addressedUnder(n, identifier)))
          break
        }
        case "replace-unit":
        case "read-as-follows": {
          const matter = copy(a.matter)
          const target = a.kind === "replace-unit" ? childUnit(unit, a.unit) : unit
          if (!target || !matter.length) {
            say("not-found", a.kind === "replace-unit" ? `${a.unit.element} (${a.unit.value}) is not in ${identifier}` : "no quoted matter follows the instruction")
            continue
          }
          if (matter.map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim() === target.node.textContent.replace(/\s+/g, " ").trim()) {
            say("already-made", "the text already reads as the instruction sets it")
            continue
          }
          const targetId = (target.node.attrs.identifier as string | null) ?? null
          // Matter that mostly keeps the unit's words takes its address, so the redline shows the words changed;
          // a unit rewritten stays a unit struck and a unit inserted, which reads better than a shredded paragraph.
          const edited = similarity(target.node.textContent, matter.map((n) => n.textContent).join(" ")) >= 0.6
          const placed = !targetId || !edited ? matter : matter.length === 1 && !SMALL.has(elementOf(matter[0])) ? [readdress(matter[0], targetId)] : matter.map((n) => addressedUnder(n, parentOf(targetId)))
          tr.replaceWith(target.pos, target.pos + target.node.nodeSize, placed)
          break
        }
        case "strike-unit": {
          const target = childUnit(unit, a.unit)
          if (!target) {
            say("not-found", `${a.unit.element} (${a.unit.value}) is not in ${identifier}`)
            continue
          }
          tr.delete(target.pos, target.pos + target.node.nodeSize)
          break
        }
        case "redesignate": {
          let changed = 0
          let already = 0
          const moving = new Set(a.from.map((u) => u.value))
          // Last first, so "(3) as (4)" does not meet the (4) it is about to become.
          for (let i = a.from.length - 1; i >= 0; i--) {
            const here = { node: tr.doc.nodeAt(unit.pos)!, pos: unit.pos }
            // A new number that already stands, and is not itself being moved on, means the redesignation was made:
            // after H.R. 6644, subsection (i) holds the redesignated (4) and the (3) the bill inserted in its place.
            if (!moving.has(a.to[i].value) && childUnit(here, a.to[i])) {
              already++
              continue
            }
            const current = childUnit(here, a.from[i])
            if (!current) continue
            const num = current.node.firstChild
            if (num?.type.name !== "num") continue
            const printed = num.textContent.replace(a.from[i].value, a.to[i].value)
            tr.replaceWith(current.pos + 2, current.pos + 2 + num.content.size, schema.text(printed))
            changed++
          }
          if (!changed) {
            say(already ? "already-made" : "not-found", already ? "the units already carry their new numbers" : `none of the units to redesignate is in ${identifier}`)
            continue
          }
          break
        }
      }
      doc = tr.doc
      doc.check()
      say("applied")
    } catch (error) {
      say("refused", String((error as Error)?.message ?? error).slice(0, 160))
    }
  }
  return { doc, outcomes }
}
