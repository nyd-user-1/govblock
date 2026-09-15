import type { Node as PmNode } from "@tiptap/pm/model"

import type { DiffNode } from "./amend"

// The redline read from the fork's side (2026-09-14), for the Fork view's
// editable text: the diff of lib/typeset/amend.ts as positions in the fork
// rather than the base. Pure, so scripts/typeset/fork-marked.test.mjs runs it
// on stored law. Drawn by ForkRedline in components/workspace/typeset-redline.ts.

export type ForkSpec =
  | { kind: "ins"; from: number; to: number }
  | { kind: "del"; at: number; text: string }
  | { kind: "ins-block"; from: number; to: number }
  | { kind: "del-block"; at: number; node: PmNode }

/** The diff as positions in the fork. */
export function forkMarked(d: DiffNode, out: ForkSpec[] = []): ForkSpec[] {
  if (d.status === "same") return out
  if (d.status === "inserted") {
    out.push({ kind: "ins-block", from: d.forkPos, to: d.forkPos + d.fork!.nodeSize })
    return out
  }
  if (d.status === "deleted") {
    out.push({ kind: "del-block", at: d.forkPos, node: d.base! })
    return out
  }
  if (d.segments) {
    let k = d.forkPos + 1
    for (const s of d.segments) {
      if (s.op === "equal") k += s.text.length
      else if (s.op === "delete") out.push({ kind: "del", at: k, text: s.text })
      else {
        out.push({ kind: "ins", from: k, to: k + s.text.length })
        k += s.text.length
      }
    }
    return out
  }
  for (const c of d.children) forkMarked(c, out)
  return out
}
