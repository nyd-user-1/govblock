import { diff, presentableDiff } from "@codemirror/merge"

// A diff between two texts as lines, the shape GitHub draws: equal runs,
// change blocks of deleted and added lines, and for each pair of lines that
// replaced one another, the characters that differ. CodeMirror's own diff
// finds the character ranges (it copes with a million-character act); this
// module only decides which lines those ranges touch.
//
// Nothing here draws. `diff-view.tsx` turns blocks into hunks with context
// and the expanders between them.

export type Mark = { from: number; to: number }

export type Block =
  | { kind: "equal"; a: number; b: number; count: number }
  | { kind: "change"; a: number; b: number; del: string[]; add: string[]; delMarks: Mark[][]; addMarks: Mark[][] }

export type LineDiff = { blocks: Block[]; added: number; deleted: number; aLines: string[]; bLines: string[] }

function lineStarts(text: string) {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1)
  return starts
}

/** The zero-based line holding offset `pos`. */
function lineAt(starts: number[], pos: number) {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= pos) lo = mid
    else hi = mid - 1
  }
  return lo
}

type Side = { text: string; starts: number[]; lines: string[] }
type Range = [number, number]

/**
 * The lines a character range [from, to) touches on one side, inclusive;
 * `[x, x - 1]` when it touches none. `other` is the text the other side has
 * in the same change. A range that sits between lines touches nothing on
 * this side — an insertion at a line start whose text ends in a newline, or
 * "\n…" appended after a line — so whole-line changes read as whole lines
 * rather than as edits to their neighbours. Text put at a line's start that
 * does not end in a newline joins that line, and touches it.
 */
function touched(side: Side, from: number, to: number, other: string): Range {
  const { text, starts } = side
  if (to > from) {
    let f = from
    let t = to
    // A leading newline belongs to the unchanged line before it; a trailing
    // one to the unchanged line after.
    if (text.charCodeAt(f) === 10) f += 1
    if (t > f && text.charCodeAt(t - 1) === 10) t -= 1
    if (t > f) return [lineAt(starts, f), lineAt(starts, t - 1)]
    // Only newlines changed: lines joined or split. Both lines around it changed.
    return [lineAt(starts, from), lineAt(starts, Math.min(to, Math.max(0, text.length - 1)))]
  }
  // Empty on this side: an insertion point.
  if (/^\n+$/.test(other)) {
    const line = lineAt(starts, Math.min(from, Math.max(0, text.length - 1)))
    return [line, line]
  }
  if (from >= text.length && !text.endsWith("\n")) {
    // At the end of the last line: "\n…" goes after it, anything else joins it.
    return other.startsWith("\n") ? [side.lines.length, side.lines.length - 1] : [side.lines.length - 1, side.lines.length - 1]
  }
  const line = lineAt(starts, from)
  if (starts[line] !== from) return [line, line]
  // At a line start: a whole line (or lines) goes before it; a fragment joins it.
  return other.endsWith("\n") ? [line, line - 1] : [line, line]
}

/** Character marks between a deleted line and the line that replaced it — none when they barely resemble each other, as GitHub leaves such pairs plain. */
function marksFor(a: string, b: string): [Mark[], Mark[]] {
  if (!a.trim() || !b.trim()) return [[], []]
  const changes = presentableDiff(a, b)
  const delMarks: Mark[] = []
  const addMarks: Mark[] = []
  let changed = 0
  for (const c of changes) {
    if (c.toA > c.fromA) delMarks.push({ from: c.fromA, to: c.toA })
    if (c.toB > c.fromB) addMarks.push({ from: c.fromB, to: c.toB })
    changed += Math.max(c.toA - c.fromA, c.toB - c.fromB)
  }
  if (changed > 0.7 * Math.max(a.length, b.length)) return [[], []]
  return [delMarks, addMarks]
}

export function lineDiff(before: string, after: string): LineDiff {
  // An empty text has no lines, not one empty line.
  const A: Side = { text: before, starts: lineStarts(before), lines: before ? before.split("\n") : [] }
  const B: Side = { text: after, starts: lineStarts(after), lines: after ? after.split("\n") : [] }

  type Touch = { a0: number; a1: number; b0: number; b1: number }
  const merged: Touch[] = []
  for (const c of diff(before, after)) {
    const [a0, a1] = touched(A, c.fromA, c.toA, after.slice(c.fromB, c.toB))
    const [b0, b1] = touched(B, c.fromB, c.toB, before.slice(c.fromA, c.toA))
    if (a1 < a0 && b1 < b0) continue
    const last = merged[merged.length - 1]
    // Two changes on the same or adjacent lines are one block.
    if (last && (a0 <= last.a1 + 1 || b0 <= last.b1 + 1)) {
      last.a0 = Math.min(last.a0, a0)
      last.b0 = Math.min(last.b0, b0)
      last.a1 = Math.max(last.a1, a1)
      last.b1 = Math.max(last.b1, b1)
    } else merged.push({ a0, a1, b0, b1 })
  }

  const blocks: Block[] = []
  let a = 0
  let b = 0
  let added = 0
  let deleted = 0
  const change = (del: string[], add: string[]) => {
    const delMarks: Mark[][] = del.map(() => [])
    const addMarks: Mark[][] = add.map(() => [])
    if (del.length === add.length) {
      for (let i = 0; i < del.length; i++) {
        const [dm, am] = marksFor(del[i], add[i])
        delMarks[i] = dm
        addMarks[i] = am
      }
    }
    blocks.push({ kind: "change", a, b, del, add, delMarks, addMarks })
    added += add.length
    deleted += del.length
    a += del.length
    b += add.length
  }
  for (const t of merged) {
    // The untouched lines before this block are the same on both sides.
    const lead = Math.min(Math.max(0, t.a0 - a), Math.max(0, t.b0 - b))
    if (lead > 0) blocks.push({ kind: "equal", a, b, count: lead })
    a += lead
    b += lead
    change(A.lines.slice(a, Math.max(a, t.a1 + 1)), B.lines.slice(b, Math.max(b, t.b1 + 1)))
  }
  const tail = Math.min(A.lines.length - a, B.lines.length - b)
  if (tail > 0) blocks.push({ kind: "equal", a, b, count: tail })
  a += tail
  b += tail
  // Whatever the line accounting could not pair is still shown, as a change.
  if (a < A.lines.length || b < B.lines.length) change(A.lines.slice(a), B.lines.slice(b))
  return { blocks, added, deleted, aLines: A.lines, bLines: B.lines }
}
