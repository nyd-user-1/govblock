import type { Node as PmNode } from "@tiptap/pm/model"
import { Transform } from "@tiptap/pm/transform"

import { isLevel } from "../xml/schema"
import { diffDocs, instructions as amendmentOf, marked, type Citation, type Instruction, type MarkedSpec } from "./amend"
import type { CiteContext } from "./cite"
import { carryOut, instructionsOf, type BillInstruction, type Outcome } from "./instruct"

// The in-context view (window 6b, 2026-09-14): a fork on the left with an `@`
// marker on each amendment instruction, the statutes it affects on the right,
// one tab each with the redline in place. Two shapes of fork:
//
//   a bill      the markers sit on the bill's own instructions (instructionsOf);
//               each cited Work is carried out (carryOut), diffed against itself
//               before (diffDocs) and marked (marked)
//   a statute   the markers sit on the units the fork changed, each holding the
//               engine's instruction for that unit; the one tab is the whole
//               section with the fork grafted in place of the portion it copies
//
// Pure; no `@/` imports. The view (components/workspace/typeset-context.tsx)
// turns markers and specs into decorations.

export type Marker = {
  /** Where the marker stands in the fork's document: the end of the instruction's words, or of the changed unit's first line. */
  at: number
  /** The Work whose tab it opens. */
  work: string
  /** The unit to bring into view there. */
  unit: string
  title: string
}

export type Found = { pos: number; node: PmNode }

/** The node carrying an identifier, the document itself excluded. */
export function byIdentifier(doc: PmNode, identifier: string): Found | null {
  let found: Found | null = null
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.attrs?.identifier === identifier) found = { node, pos }
    return !found
  })
  return found
}

/** A unit by identifier, or the nearest unit above it that is there: a subsection the text lacks falls back to its section. */
export function unitPos(doc: PmNode, identifier: string): (Found & { identifier: string }) | null {
  for (let id = identifier; id.lastIndexOf("/") > 0; id = id.slice(0, id.lastIndexOf("/"))) {
    const hit = byIdentifier(doc, id)
    if (hit) return { ...hit, identifier: id }
  }
  return null
}

/** The end of a unit's first line of words, past its number: where a marker reads as belonging to the unit. */
function lineEnd(unit: Found): number {
  let end = -1
  unit.node.descendants((node, offset) => {
    if (end >= 0) return false
    if (!node.isTextblock) return true
    if (node.type.name !== "num") end = unit.pos + 1 + offset + 1 + node.content.size
    return false
  })
  return end >= 0 ? end : unit.pos + unit.node.nodeSize - 1
}

/** One marker per place: instructions ending in the same words share it. */
function place(markers: Marker[], next: Marker) {
  const same = markers.find((m) => m.at === next.at)
  if (!same) markers.push(next)
  else if (!same.title.includes(next.title)) same.title = `${same.title}\n${next.title}`
}

// ------------------------------------------------------------------ bill ---

export type BillContext = { instructions: BillInstruction[]; works: string[]; markers: Marker[] }

/** A bill's instructions, the Works they amend in the order the bill first names them, and a marker on each. */
export function billContext(doc: PmNode, ctx: CiteContext): BillContext {
  const list = instructionsOf(doc, ctx)
  const works: string[] = []
  const markers: Marker[] = []
  for (const ins of list) {
    if (!ins.work) continue
    if (!works.includes(ins.work)) works.push(ins.work)
    const portion = ins.portion.length && ins.cite?.kind === "usc" ? ins.portion.map((p) => `(${p})`).join("") : ins.portion.length ? ` (${ins.portion.join(")(")})` : ""
    place(markers, { at: ins.to, work: ins.work, unit: [ins.work, ...ins.portion].join("/"), title: `${ins.cite?.text ?? ins.work}${portion}` })
  }
  return { instructions: list, works, markers }
}

export type TabRedline = {
  /** What to strike and insert over the statute, in its own positions. */
  specs: MarkedSpec[]
  /** Each instruction to this Work and what became of it. Empty for a statute fork. */
  outcomes: Outcome[]
}

/** A bill's instructions to one Work carried out on that Work's text, and the difference drawn over the text. */
export function billRedline(statute: PmNode, work: string, instructions: BillInstruction[]): TabRedline {
  // carryOut reads the Work from the document; a text served without its identifier is given it, positions unchanged.
  const base = statute.attrs.identifier === work ? statute : statute.type.create({ ...statute.attrs, identifier: work }, statute.content, statute.marks)
  const { doc, outcomes } = carryOut(
    base,
    instructions.filter((i) => i.work === work)
  )
  return { specs: marked(diffDocs(base, doc)), outcomes }
}

// --------------------------------------------------------------- statute ---

export type ForkContext = { instructions: Instruction[]; markers: Marker[] }

/** A statute fork's instructions, from the engine, each marked on the unit it amends. `work` is the section the tab shows. */
export function forkContext(base: PmNode, fork: PmNode, cite: Citation, forkWork: string): ForkContext {
  const { instructions } = amendmentOf(diffDocs(base, fork), cite)
  const markers: Marker[] = []
  for (const ins of instructions) {
    const unit = unitPos(fork, ins.unit ?? forkWork)
    const title = ins.text.split("\n")[0]
    if (unit) place(markers, { at: lineEnd(unit), work: cite.work, unit: unit.identifier, title })
    else {
      let first = -1
      fork.descendants((node, pos) => {
        if (first >= 0) return false
        if (node.isTextblock && node.type.name !== "num") first = pos + 1 + node.content.size
        return first < 0
      })
      if (first >= 0) place(markers, { at: first, work: cite.work, unit: forkWork, title })
    }
  }
  return { instructions, markers }
}

/** The section with the fork's text in place of the portion it copies; null when the section no longer holds that portion. */
export function graft(section: PmNode, fork: PmNode, forkWork: string): PmNode | null {
  const schema = section.type.schema
  const target = byIdentifier(section, forkWork)
  if (!target) return null
  let replacement = byIdentifier(fork, forkWork)?.node ?? null
  if (!replacement) fork.forEach((child) => void (!replacement && isLevel(child.type.name) && (replacement = child)))
  if (!replacement) return null
  const copy = schema.nodeFromJSON(replacement.toJSON())
  const doc = new Transform(section).replaceWith(target.pos, target.pos + target.node.nodeSize, copy).doc
  doc.check()
  return doc
}

/** A statute fork's redline over the whole section. */
export function forkRedline(section: PmNode, fork: PmNode, forkWork: string): TabRedline | null {
  const grafted = graft(section, fork, forkWork)
  return grafted ? { specs: marked(diffDocs(section, grafted)), outcomes: [] } : null
}

// ----------------------------------------------------------------- words ---

export const OUTCOME_WORDS: Record<Outcome["status"], string> = {
  applied: "Applied",
  "already-made": "Already made",
  "not-found": "Not found",
  refused: "Refused",
  unread: "Not yet read",
  "other-work": "Another law",
}
