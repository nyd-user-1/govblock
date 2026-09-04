"use client"

import * as React from "react"

import { lineDiff, type Block, type LineDiff, type Mark } from "@/lib/policy/line-diff"
import { OCTICON } from "@/lib/policy/octicons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { cn } from "@govblock/ui/lib/utils"

import "./diff-view.css"

// GitHub's diff, measured from github.com on 2026-09-03 with headless
// Chromium and rebuilt to the numbers (Brendan: "use playwright … go to
// github, inspect it and give me a match"). A fixed-layout table: number
// columns 40px wide, rows 24px, the text 12px monospace on a 24px line with
// `pre-wrap`, a 15px marker column for +/−, 24px of padding at the right of
// the text. A hunk row is one cell across the table, `--gh-diff-hunk-line`
// behind it, with the 80px expander cell in `--gh-diff-hunk-num` and the
// `@@ -a,b +c,d @@` line beside it. Added lines sit on
// `--gh-diff-add-line` with their numbers on `--gh-diff-add-num` and the
// changed words on `--gh-diff-add-word` at a 3px radius; deletions the same
// in red. Split view is four columns, a 1px `--gh-diff-border` between the
// sides, and the empty side in `--gh-diff-empty`. The palette is Primer's,
// light and dark, in globals.css.
//
// What GitHub does around the table is here too: three lines of context with
// the rest folded, the fold arrows that reveal twenty lines above or below,
// a blue + on hover that opens a comment on the line, the ▾ menu with
// Add comment · Copy · Select all · Copy link · Expand above · Expand
// below · Go to next hunk, and the comments themselves as rows under the
// line they are on.

export type Layout = "unified" | "split"

export type LineRef = { side: "L" | "R"; line: number }

export type DiffComment = { id: string; side: "L" | "R"; line: number; body: string; author: string; at: string }

const CONTEXT = 3
const STEP = 20

function Octicon({ name, className }: { name: keyof typeof OCTICON | string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="16" height="16" fill="currentColor" className={className}>
      <path d={OCTICON[name]} />
    </svg>
  )
}

/** A line's text with its changed words marked and the query's matches lit. */
function Text({ text, marks, tone, query }: { text: string; marks?: Mark[]; tone?: "add" | "del"; query?: string }) {
  const pieces: React.ReactNode[] = []
  let at = 0
  const push = (s: string, marked: boolean, key: string) => {
    if (!s) return
    const inner = query ? highlight(s, query, key) : s
    pieces.push(marked ? <span key={key} className={cn("gh-x", tone === "add" ? "bg-[var(--gh-diff-add-word)]" : "bg-[var(--gh-diff-del-word)]")}>{inner}</span> : <React.Fragment key={key}>{inner}</React.Fragment>)
  }
  for (const [i, m] of (marks ?? []).entries()) {
    push(text.slice(at, m.from), false, `p${i}`)
    push(text.slice(m.from, m.to), true, `m${i}`)
    at = m.to
  }
  push(text.slice(at), false, "tail")
  return <>{pieces}</>
}

function highlight(s: string, query: string, key: string) {
  const q = query.toLowerCase()
  const out: React.ReactNode[] = []
  let i = 0
  let n = 0
  const lower = s.toLowerCase()
  while (i < s.length) {
    const j = lower.indexOf(q, i)
    if (j < 0) break
    out.push(s.slice(i, j), <mark key={`${key}-${n++}`} className="rounded-[2px] bg-yellow-300/70 text-inherit">{s.slice(j, j + q.length)}</mark>)
    i = j + q.length
  }
  out.push(s.slice(i))
  return out
}

// ── rows ────────────────────────────────────────────────────────────────────

type Row =
  | { kind: "line"; a: number | null; b: number | null; tone: "add" | "del" | "ctx"; text: string; marks?: Mark[] }
  | { kind: "pair"; a: number | null; b: number | null; left: { text: string; marks?: Mark[] } | null; right: { text: string; marks?: Mark[] } | null; tone: "change" | "ctx" }
  | { kind: "hunk"; gap: number; header: string; up: boolean; down: boolean; all: boolean; above: number; below: number }

/** The hunk header GitHub prints: the ranges of the hunk that follows. */
function header(aStart: number, aCount: number, bStart: number, bCount: number) {
  return `@@ -${aStart + 1},${aCount} +${bStart + 1},${bCount} @@`
}

/**
 * The blocks as rows, with each equal run cut to three lines of context and
 * an expander for the rest. `reveal[gapIndex]` is how many lines the reader
 * has opened from the top and bottom of that gap.
 */
function rows(d: LineDiff, layout: Layout, reveal: Record<number, { top: number; bottom: number }>): Row[] {
  const out: Row[] = []
  const blocks = d.blocks
  const lineRow = (a: number | null, b: number | null, tone: "add" | "del" | "ctx", text: string, marks?: Mark[]): Row => ({ kind: "line", a, b, tone, text, marks })
  const ctx = (a: number, b: number, count: number) => {
    for (let i = 0; i < count; i++) {
      if (layout === "split") out.push({ kind: "pair", a: a + i, b: b + i, left: { text: d.aLines[a + i] }, right: { text: d.bLines[b + i] }, tone: "ctx" })
      else out.push(lineRow(a + i, b + i, "ctx", d.aLines[a + i]))
    }
  }
  // A change block's hunk header counts its context; computed per hunk below.
  const changeAt = (i: number) => blocks[i]?.kind === "change"
  let hunkOpen = false
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.kind === "equal") {
      const prev = i > 0 && changeAt(i - 1)
      const next = changeAt(i + 1)
      const r = reveal[i] ?? { top: 0, bottom: 0 }
      // Context that stays open beside the changes.
      const keepTop = prev ? CONTEXT : 0
      const keepBottom = next ? CONTEXT : 0
      const top = Math.min(block.count, keepTop + r.top)
      const bottom = Math.min(block.count - top, keepBottom + r.bottom)
      const hidden = block.count - top - bottom
      ctx(block.a, block.b, top)
      if (hidden > 0) {
        // The header names the hunk that follows: from the first shown line
        // after the fold to the end of the next change and its context.
        const aFrom = block.a + top + hidden
        const bFrom = block.b + top + hidden
        let aCount = bottom
        let bCount = bottom
        for (let j = i + 1; j < blocks.length; j++) {
          const nb = blocks[j]
          if (nb.kind === "change") {
            aCount += nb.del.length
            bCount += nb.add.length
          } else {
            const nr = reveal[j] ?? { top: 0, bottom: 0 }
            const keep = Math.min(nb.count, (changeAt(j - 1) ? CONTEXT : 0) + nr.top)
            aCount += keep
            bCount += keep
            if (nb.count > keep) break
          }
        }
        out.push({ kind: "hunk", gap: i, header: next || bottom ? header(aFrom, aCount, bFrom, bCount) : "", up: hidden > STEP, down: hidden > STEP, all: hidden <= STEP, above: top, below: bottom })
        hunkOpen = true
      }
      ctx(block.a + top + hidden, block.b + top + hidden, bottom)
      continue
    }
    if (!hunkOpen && i === 0) {
      // A file that changes from its first line still gets a header.
      let aCount = block.del.length
      let bCount = block.add.length
      const nb = blocks[1]
      if (nb?.kind === "equal") {
        const keep = Math.min(nb.count, CONTEXT + (reveal[1]?.top ?? 0))
        aCount += keep
        bCount += keep
      }
      out.push({ kind: "hunk", gap: -1, header: header(block.a, aCount, block.b, bCount), up: false, down: false, all: false, above: 0, below: 0 })
      hunkOpen = true
    }
    if (layout === "split") {
      const n = Math.max(block.del.length, block.add.length)
      for (let k = 0; k < n; k++) {
        const left = k < block.del.length ? { text: block.del[k], marks: block.delMarks[k] } : null
        const right = k < block.add.length ? { text: block.add[k], marks: block.addMarks[k] } : null
        out.push({ kind: "pair", a: left ? block.a + k : null, b: right ? block.b + k : null, left, right, tone: "change" })
      }
    } else {
      block.del.forEach((text, k) => out.push(lineRow(block.a + k, null, "del", text, block.delMarks[k])))
      block.add.forEach((text, k) => out.push(lineRow(null, block.b + k, "add", text, block.addMarks[k])))
    }
  }
  return out
}

// ── the view ────────────────────────────────────────────────────────────────

export function DiffView({
  before,
  after,
  layout = "unified",
  query = "",
  anchor = "diff",
  comments = [],
  onComment,
  compact = false,
  hideComments = false,
  ignoreWhitespace = false,
  className,
}: {
  before: string
  after: string
  layout?: Layout
  /** Lights matches in the shown lines. */
  query?: string
  /** Prefix for line anchors and permalinks: `#<anchor>R77`. */
  anchor?: string
  comments?: DiffComment[]
  /** Absent, the + and the comment items do not appear. */
  onComment?: (ref: LineRef, body: string) => void
  /** GitHub's gear: compact line height, comments minimised, whitespace hidden. */
  compact?: boolean
  hideComments?: boolean
  ignoreWhitespace?: boolean
  className?: string
}) {
  const d = React.useMemo(() => lineDiff(before, after, { ignoreWhitespace }), [before, after, ignoreWhitespace])
  const [reveal, setReveal] = React.useState<Record<number, { top: number; bottom: number }>>({})
  const [composing, setComposing] = React.useState<LineRef | null>(null)
  // The row the reader clicked: GitHub's blue ring, and its + stays up.
  const [selected, setSelected] = React.useState<string | null>(null)
  const table = React.useRef<HTMLTableElement>(null)
  const list = React.useMemo(() => rows(d, layout, reveal), [d, layout, reveal])

  const expand = (gap: number, where: "top" | "bottom" | "all") =>
    setReveal((r) => {
      const cur = r[gap] ?? { top: 0, bottom: 0 }
      if (where === "all") return { ...r, [gap]: { top: cur.top + 1_000_000, bottom: cur.bottom } }
      return { ...r, [gap]: { ...cur, [where]: cur[where] + STEP } }
    })

  const nextHunk = (from: HTMLElement | null) => {
    const hunks = [...(table.current?.querySelectorAll<HTMLElement>("tr[data-hunk]") ?? [])]
    const y = from?.getBoundingClientRect().top ?? -1
    const next = hunks.find((h) => h.getBoundingClientRect().top > y + 1) ?? hunks[0]
    next?.scrollIntoView({ block: "center", behavior: "smooth" })
  }

  const copyLink = (ref: LineRef) => {
    const url = new URL(window.location.href)
    url.hash = `${anchor}${ref.side}${ref.line + 1}`
    void navigator.clipboard?.writeText(url.toString())
  }

  const byLine = React.useMemo(() => {
    const m = new Map<string, DiffComment[]>()
    for (const c of comments) {
      const k = `${c.side}${c.line}`
      m.set(k, [...(m.get(k) ?? []), c])
    }
    return m
  }, [comments])

  const cols = layout === "split" ? 4 : 3

  // The number cells and the text cell for one side of a line.
  const num = (n: number | null, tone: "add" | "del" | "ctx" | "empty", side: "L" | "R") => (
    <td
      className={cn("gh-num", tone === "add" && "bg-[var(--gh-diff-add-num)]", tone === "del" && "bg-[var(--gh-diff-del-num)]", tone === "empty" && "bg-[var(--gh-diff-empty)]", tone === "ctx" && "text-[var(--gh-diff-muted)]")}
      data-side={side}
    >
      <code>{n === null ? "" : n + 1}</code>
    </td>
  )
  const cell = (row: { text: string; marks?: Mark[] } | null, tone: "add" | "del" | "ctx" | "empty", at: LineRef | null, side: "left" | "right", key: string) => {
    const gapKey = at ? `${at.side}${at.line}` : ""
    return (
      <td
        key={key}
        className={cn("gh-text group/line", tone === "add" && "bg-[var(--gh-diff-add-line)]", tone === "del" && "bg-[var(--gh-diff-del-line)]", tone === "empty" && "bg-[var(--gh-diff-empty)]", layout === "split" && side === "left" && "border-r border-[var(--gh-diff-border)]")}
        data-line-anchor={at ? `${anchor}${at.side}${at.line + 1}` : undefined}
        id={at ? `${anchor}${at.side}${at.line + 1}` : undefined}
        onClick={(e) => {
          if (!at || (e.target as HTMLElement).closest("button")) return
          setSelected((s) => (s === gapKey ? null : gapKey))
        }}
      >
        {row && (
          <code className={cn("gh-line", tone === "add" && "addition", tone === "del" && "deletion")}>
            <span className="gh-marker">{tone === "add" ? "+" : tone === "del" ? "-" : " "}</span>
            <div className="gh-inner">
              <Text text={row.text} marks={row.marks} tone={tone === "add" ? "add" : "del"} query={query.trim() || undefined} />
            </div>
          </code>
        )}
        {at && onComment && (
          <button type="button" aria-label={`Add a comment on line ${at.side}${at.line + 1}`} onClick={() => setComposing(at)} className="gh-plus">
            <Octicon name="plus" />
          </button>
        )}
        {at && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Line options" className="gh-caret">
                <Octicon name="triangleDown" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="min-w-60 rounded-lg">
              {onComment && (
                <>
                  <DropdownMenuItem onClick={() => setComposing(at)}>
                    <Octicon name="plus" /> Add comment on line {at.side}
                    {at.line + 1}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => void navigator.clipboard?.writeText(row?.text ?? "")}>
                <Octicon name="copy" /> Copy <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const sel = window.getSelection()
                  if (!table.current || !sel) return
                  const range = document.createRange()
                  range.selectNodeContents(table.current)
                  sel.removeAllRanges()
                  sel.addRange(range)
                }}
              >
                <Octicon name="list-unordered" /> Select all <DropdownMenuShortcut>⌘A</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyLink(at)}>
                <Octicon name="link" /> Copy link <DropdownMenuShortcut>⌥⌘Y</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => expandNear(e.currentTarget, "above")}>
                <Octicon name="foldUp" /> Expand above
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => expandNear(e.currentTarget, "below")}>
                <Octicon name="foldDown" /> Expand below
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => nextHunk(e.currentTarget.closest("tr"))}>
                <Octicon name="arrow-down" /> Go to next hunk <DropdownMenuShortcut>Page down</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="sr-only">{gapKey}</span>
      </td>
    )
  }

  // "Expand above/below" from a line's menu: the nearest fold in that direction.
  const expandNear = (el: HTMLElement, dir: "above" | "below") => {
    const tr = el.closest("tr") ?? document.activeElement?.closest("tr")
    const all = [...(table.current?.querySelectorAll<HTMLElement>("tr") ?? [])]
    const idx = tr ? all.indexOf(tr as HTMLElement) : -1
    const range = dir === "above" ? all.slice(0, Math.max(0, idx)).reverse() : all.slice(idx + 1)
    const h = range.find((r) => r.dataset.hunk !== undefined)
    if (!h) return
    const gap = Number(h.dataset.gap)
    if (Number.isNaN(gap) || gap < 0) return
    expand(gap, dir === "above" ? "bottom" : "top")
  }

  const composer = (at: LineRef) => (
    <tr key={`c-${at.side}${at.line}`} className="gh-comment-row" data-tone={at.side === "L" ? "del" : "add"}>
      <td colSpan={cols} className={cn("p-0", at.side === "L" ? "bg-[var(--gh-diff-del-line)]" : "bg-[var(--gh-diff-add-line)]")}>
        <CommentBox
          width={layout === "split" ? 582 : 730}
          at={at}
          onCancel={() => setComposing(null)}
          onSubmit={(body) => {
            onComment?.(at, body)
            setComposing(null)
          }}
        />
      </td>
    </tr>
  )
  const shown = (at: LineRef) => {
    const list = byLine.get(`${at.side}${at.line}`)
    if (!list?.length) return null
    if (hideComments) {
      return (
        <tr key={`s-${at.side}${at.line}`} className="gh-comment-row">
          <td colSpan={cols} className="px-4 py-1 text-xs text-[var(--gh-diff-muted)]">
            {list.length} comment{list.length === 1 ? "" : "s"} on line {at.side}
            {at.line + 1}, minimised
          </td>
        </tr>
      )
    }
    return (
      <tr key={`s-${at.side}${at.line}`} className="gh-comment-row">
        <td colSpan={cols} className="p-0">
          <div className="mx-4 my-2 flex flex-col gap-2" style={{ maxWidth: layout === "split" ? 582 : 730 }}>
            {list.map((c) => (
              <div key={c.id} className="rounded-md border border-[var(--gh-diff-border)] bg-[var(--gh-diff-bg)] text-sm">
                <div className="flex items-center gap-2 rounded-t-md border-b border-[var(--gh-diff-border)] bg-[var(--gh-diff-empty)] px-3 py-2 text-xs text-[var(--gh-diff-muted)]">
                  <span className="size-5 rounded-full bg-[var(--gh-diff-accent)]" aria-hidden />
                  <span className="font-medium text-[var(--gh-diff-fg)]">{c.author}</span> commented on line {c.side}
                  {c.line + 1}
                </div>
                <div className="px-3 py-2 whitespace-pre-wrap">{c.body}</div>
              </div>
            ))}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className={cn("gh-diff overflow-x-auto bg-[var(--gh-diff-bg)] text-[var(--gh-diff-fg)]", compact && "gh-compact", className)}>
      <table ref={table} className="gh-table" role="grid" aria-label="Changes">
        {layout === "split" ? (
          <colgroup>
            <col width="40" />
            <col />
            <col width="40" />
            <col />
          </colgroup>
        ) : (
          <colgroup>
            <col width="40" />
            <col width="40" />
            <col width="100%" />
          </colgroup>
        )}
        <tbody>
          {list.map((row, i) => {
            if (row.kind === "hunk") {
              return (
                <tr key={`h-${i}`} data-hunk data-gap={row.gap} className="gh-hunk-row">
                  <td colSpan={cols} className="gh-hunk bg-[var(--gh-diff-hunk-line)]">
                    <div className="flex">
                      {row.gap >= 0 && (
                        <div className={cn("gh-expander bg-[var(--gh-diff-hunk-num)]", layout === "split" ? "w-10" : "w-20")}>
                          {row.all ? (
                            <button type="button" aria-label="Expand all" onClick={() => expand(row.gap, "all")}>
                              <Octicon name="unfold" />
                            </button>
                          ) : (
                            <>
                              <button type="button" aria-label="Expand up" onClick={() => expand(row.gap, "bottom")}>
                                <Octicon name="foldUp" />
                              </button>
                              <button type="button" aria-label="Expand down" onClick={() => expand(row.gap, "top")}>
                                <Octicon name="foldDown" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      <code className="gh-hunk-text text-[var(--gh-diff-muted)]">{row.header}</code>
                    </div>
                  </td>
                </tr>
              )
            }
            if (row.kind === "pair") {
              const l: LineRef | null = row.a !== null ? { side: "L", line: row.a } : null
              const r: LineRef | null = row.b !== null ? { side: "R", line: row.b } : null
              const lt = row.tone === "ctx" ? "ctx" : row.left ? "del" : "empty"
              const rt = row.tone === "ctx" ? "ctx" : row.right ? "add" : "empty"
              return (
                <React.Fragment key={`p-${i}`}>
                  <tr className="gh-row" data-selected={(l && selected === `L${l.line}`) || (r && selected === `R${r.line}`) || undefined}>
                    {num(row.a, lt, "L")}
                    {cell(row.left, lt, l, "left", "l")}
                    {num(row.b, rt, "R")}
                    {cell(row.right, rt, r, "right", "r")}
                  </tr>
                  {l && shown(l)}
                  {r && shown(r)}
                  {composing && ((l && composing.side === "L" && composing.line === l.line) || (r && composing.side === "R" && composing.line === r.line)) && composer(composing)}
                </React.Fragment>
              )
            }
            const at: LineRef = row.tone === "del" ? { side: "L", line: row.a! } : { side: "R", line: row.b! }
            return (
              <React.Fragment key={`l-${i}`}>
                <tr className="gh-row" data-selected={selected === `${at.side}${at.line}` || undefined}>
                  {num(row.a, row.tone, "L")}
                  {num(row.b, row.tone, "R")}
                  {cell({ text: row.text, marks: row.marks }, row.tone, at, "right", "t")}
                </tr>
                {shown(at)}
                {composing && composing.side === at.side && composing.line === at.line && composer(composing)}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
      {d.blocks.length === 1 && d.blocks[0].kind === "equal" && <p className="px-6 py-8 text-center text-sm text-[var(--gh-diff-muted)]">No changes between these versions.</p>}
    </div>
  )
}

// ── the comment box ─────────────────────────────────────────────────────────

function CommentBox({ at, width, onCancel, onSubmit }: { at: LineRef; width: number; onCancel: () => void; onSubmit: (body: string) => void }) {
  const [tab, setTab] = React.useState<"write" | "preview">("write")
  const [body, setBody] = React.useState("")
  const area = React.useRef<HTMLTextAreaElement>(null)
  React.useEffect(() => {
    area.current?.focus()
  }, [])
  return (
    <div className="mx-4 my-2 rounded-md border border-[var(--gh-diff-border)] bg-[var(--gh-diff-bg)] text-sm" style={{ maxWidth: width }}>
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 font-semibold">
        <span className="size-5 rounded-full bg-[var(--gh-diff-accent)]" aria-hidden />
        Add a comment on line {at.side}
        {at.line + 1}
      </div>
      <div className="mx-3 rounded-md border border-[var(--gh-diff-border)]">
        <div className="flex items-center gap-1 border-b border-[var(--gh-diff-border)] bg-[var(--gh-diff-empty)] px-1 pt-1">
          {(["write", "preview"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-t-md px-3 py-1.5 text-sm", tab === t ? "-mb-px border border-b-0 border-[var(--gh-diff-border)] bg-[var(--gh-diff-bg)] font-medium" : "text-[var(--gh-diff-muted)]")}>
              {t === "write" ? "Write" : "Preview"}
            </button>
          ))}
        </div>
        {tab === "write" ? (
          <textarea
            ref={area}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && body.trim()) onSubmit(body.trim())
              if (e.key === "Escape") onCancel()
            }}
            placeholder="Leave a comment"
            className="block min-h-28 w-full resize-y bg-transparent p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--gh-diff-accent)]"
          />
        ) : (
          <div className="min-h-28 p-3 whitespace-pre-wrap">{body.trim() || <span className="text-[var(--gh-diff-muted)]">Nothing to preview</span>}</div>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="text-xs text-[var(--gh-diff-muted)]">Markdown is supported</span>
        <button type="button" onClick={onCancel} className="ml-auto rounded-md border border-[var(--gh-diff-border)] bg-[var(--gh-diff-empty)] px-3 py-1.5 text-sm font-medium">
          Cancel
        </button>
        <button type="button" disabled={!body.trim()} onClick={() => onSubmit(body.trim())} className="rounded-md bg-[#1f883d] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          Comment
        </button>
      </div>
    </div>
  )
}

export { lineDiff }
export type { Block, LineDiff }
