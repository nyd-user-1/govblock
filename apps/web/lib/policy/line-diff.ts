import { diff, presentableDiff } from "@codemirror/merge"

import { layoutBillText } from "@/lib/policy/bill-text-layout"

// A diff between two texts as lines, the shape GitHub draws: equal runs,
// change blocks of deleted and added lines, and for each pair of lines that
// replaced one another, the characters that differ. CodeMirror's own diff
// finds the character ranges (it copes with a million-character act); this
// module only decides which lines those ranges touch.
//
// Nothing here draws. `diff-view.tsx` turns blocks into hunks with context
// and the expanders between them.

export type Mark = { from: number; to: number }

// CodeMirror's diff is Myers's: its cost grows with the square of the change.
// A gut-and-amend (California's SB492: 28,000 words replaced) would hold the
// tab for minutes, so every diff gets a budget and past it CodeMirror falls
// back to a coarse answer — a big block changed — rather than a frozen page
// (Brendan, 2026-09-04: "the commit page is still crashing").
const BUDGET = { timeout: 1500 }

export type Block =
  /** `bCount` is set when the sides have the same words on a different number of lines (reflow mode). */
  | { kind: "equal"; a: number; b: number; count: number; bCount?: number }
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
  const changes = presentableDiff(a, b, BUDGET)
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

/** Each line with its runs of spaces and tabs collapsed — the shape of the text with whitespace hidden. */
const squeeze = (text: string) => text.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).join("\n")

export function lineDiff(before: string, after: string, options: { ignoreWhitespace?: boolean; reflow?: boolean } = {}): LineDiff {
  if (options.reflow) return reflowDiff(before, after)
  if (options.ignoreWhitespace) {
    // Diff the squeezed texts (same line count), then show the real lines.
    const d = lineDiff(squeeze(before), squeeze(after))
    const aLines = before ? before.split("\n") : []
    const bLines = after ? after.split("\n") : []
    return {
      ...d,
      aLines,
      bLines,
      blocks: d.blocks.map((b) => (b.kind === "equal" ? b : { ...b, del: aLines.slice(b.a, b.a + b.del.length), add: bLines.slice(b.b, b.b + b.add.length), delMarks: b.del.map(() => []), addMarks: b.add.map(() => []) })),
    }
  }
  // An empty text has no lines, not one empty line.
  const A: Side = { text: before, starts: lineStarts(before), lines: before ? before.split("\n") : [] }
  const B: Side = { text: after, starts: lineStarts(after), lines: after ? after.split("\n") : [] }

  type Touch = { a0: number; a1: number; b0: number; b1: number }
  const merged: Touch[] = []
  for (const c of diff(before, after, BUDGET)) {
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

// ── reflow mode ─────────────────────────────────────────────────────────────
//
// Bill texts are re-set between versions: a comm sub is a fresh PDF, its
// lines break in new places, its page furniture and its own line numbers
// move. Measured on 2026-09-04 across ten states: Florida's H5003 showed
// 1,463 changed lines for 825 changed words, Colorado's HB1429 4,833 lines
// for 1,113 words. So in reflow mode the diff is computed on words — the
// document's own line numbers and page furniture left out — and a line is
// changed only when a word on it changed. Lines that merely re-wrapped are
// context, and the two sides may show the same words on different numbers
// of lines (`bCount`).

type Token = { line: number; from: number; to: number }

function tokenize(text: string): { lines: string[]; tokens: Token[]; words: string[] } {
  const lines = text ? text.split("\n") : []
  const layout = layoutBillText(text)
  const tokens: Token[] = []
  const words: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const meta = layout.lines[i]
    if (meta?.kind === "furniture") continue
    const raw = lines[i]
    const re = /\S+/g
    let m: RegExpExecArray | null
    let first = true
    while ((m = re.exec(raw))) {
      // The document's own line number, lifted into the gutter, is not a word.
      if (first && meta?.n && m[0] === String(meta.n)) {
        first = false
        continue
      }
      first = false
      tokens.push({ line: i, from: m.index, to: m.index + m[0].length })
      words.push(m[0])
    }
  }
  return { lines, tokens, words }
}

function reflowDiff(before: string, after: string): LineDiff {
  const A = tokenize(before)
  const B = tokenize(after)
  // The diff over words: each word a line of its own.
  const byWord = lineDiff(A.words.join("\n"), B.words.join("\n"))

  // Which token block each token belongs to, and whether it changed.
  const aBlock = new Array<number>(A.tokens.length)
  const bBlock = new Array<number>(B.tokens.length)
  const aChanged = new Array<boolean>(A.tokens.length).fill(false)
  const bChanged = new Array<boolean>(B.tokens.length).fill(false)
  byWord.blocks.forEach((blk, k) => {
    if (blk.kind === "equal") {
      for (let i = 0; i < blk.count; i++) {
        aBlock[blk.a + i] = k
        bBlock[blk.b + i] = k
      }
    } else {
      for (let i = 0; i < blk.del.length; i++) {
        aBlock[blk.a + i] = k
        aChanged[blk.a + i] = true
      }
      for (let i = 0; i < blk.add.length; i++) {
        bBlock[blk.b + i] = k
        bChanged[blk.b + i] = true
      }
    }
  })

  // Each line: changed if any of its words changed; assigned to the block of
  // its first changed word, else of its first word; a line without words
  // rides with the line before it.
  type LineInfo = { changed: boolean; block: number; marks: Mark[] }
  const assign = (side: typeof A, blocks: number[], changed: boolean[]): LineInfo[] => {
    const info: LineInfo[] = side.lines.map(() => ({ changed: false, block: -1, marks: [] }))
    side.tokens.forEach((t, i) => {
      const li = info[t.line]
      if (changed[i]) {
        if (!li.changed) {
          li.changed = true
          li.block = blocks[i]
          li.marks = []
        }
        li.marks.push({ from: t.from, to: t.to })
      } else if (li.block < 0) li.block = blocks[i]
    })
    let last = 0
    for (let i = 0; i < info.length; i++) {
      if (info[i].block < 0) info[i].block = last
      else last = info[i].block
    }
    return info
  }
  const ai = assign(A, aBlock, aChanged)
  const bi = assign(B, bBlock, bChanged)

  // Walk the word blocks in order, taking each side's lines in turn.
  const blocks: Block[] = []
  let a = 0
  let b = 0
  let added = 0
  let deleted = 0
  const take = (info: LineInfo[], from: number, k: number, changed: boolean) => {
    let i = from
    while (i < info.length && info[i].block <= k && info[i].changed === changed) i++
    // Lines ahead of the block that already belong to it, unchanged, come along too.
    return i
  }
  const flush = (aTo: number, bTo: number, changed: boolean) => {
    if (aTo === a && bTo === b) return
    if (!changed) {
      blocks.push({ kind: "equal", a, b, count: aTo - a, bCount: bTo - b })
    } else {
      const del = A.lines.slice(a, aTo)
      const add = B.lines.slice(b, bTo)
      blocks.push({ kind: "change", a, b, del, add, delMarks: ai.slice(a, aTo).map((l) => l.marks), addMarks: bi.slice(b, bTo).map((l) => l.marks) })
      added += add.length
      deleted += del.length
    }
    a = aTo
    b = bTo
  }
  for (let k = 0; k < byWord.blocks.length; k++) {
    const changed = byWord.blocks[k].kind === "change"
    // First the lines of this block that are of its kind, then any of the
    // other kind that the assignment put here (a partly changed line in an
    // equal block, a blank line in a change block).
    flush(take(ai, a, k, changed), take(bi, b, k, changed), changed)
    flush(take(ai, a, k, !changed), take(bi, b, k, !changed), !changed)
  }
  flush(A.lines.length, B.lines.length, false)
  // Merge neighbouring blocks of the same kind.
  const merged: Block[] = []
  for (const blk of blocks) {
    const last = merged[merged.length - 1]
    if (last && last.kind === blk.kind) {
      if (last.kind === "equal" && blk.kind === "equal") {
        last.count += blk.count
        last.bCount = (last.bCount ?? last.count) + (blk.bCount ?? blk.count)
        continue
      }
      if (last.kind === "change" && blk.kind === "change") {
        last.del.push(...blk.del)
        last.add.push(...blk.add)
        last.delMarks.push(...blk.delMarks)
        last.addMarks.push(...blk.addMarks)
        continue
      }
    }
    merged.push(blk)
  }
  return { blocks: merged, added, deleted, aLines: A.lines, bLines: B.lines }
}
