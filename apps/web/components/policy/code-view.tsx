"use client"

import * as React from "react"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { foldGutter, foldKeymap, foldService } from "@codemirror/language"
import { MergeView, unifiedMergeView } from "@codemirror/merge"
import { highlightSelectionMatches, search, searchKeymap, SearchCursor, SearchQuery, setSearchQuery } from "@codemirror/search"
import { Compartment, EditorState, RangeSetBuilder, StateEffect } from "@codemirror/state"
import { Decoration, EditorView, gutter, GutterMarker, keymap, lineNumbers, type DecorationSet } from "@codemirror/view"

import { CHANGE_MARK, layoutBillText, type BillLayout } from "@/lib/policy/bill-text-layout"
import { cn } from "@govblock/ui/lib/utils"

// Bill text as code: CodeMirror 6, read-only. Brendan, 2026-09-03 — the
// editor mode earns its place with three things a `<pre>` cannot do:
//
// 1. Diffs between versions. An amended text against the one before it, the
//    way a code review shows a change — unified, or side by side with the
//    earlier version on the left.
// 2. Search and jump. Find in a million characters, an outline of sections to
//    jump to, sections that fold.
// 3. Virtualised rendering. Only the lines on screen are drawn, so Indiana's
//    enrolled act of a million characters opens at once instead of truncated.
//
// The document is the standard layout (`bill-text-layout`): the legislature's
// own line numbers sit in a second gutter beside the file's, furniture lines
// are dimmed, and LegiScan's {+added+} / [-deleted-] marks are coloured. The
// module is loaded only when the reader chooses Code, so the reading view
// stays as light as it was.

export type Match = { line: number; from: number; to: number; text: string }

export type CodeViewHandle = {
  /** Search the document; the panel opens with the query and matches are reported. */
  find: (query: string) => void
  /** Scroll a zero-based line into view and put the cursor on it. */
  goto: (line: number) => void
}

class NumberMarker extends GutterMarker {
  constructor(readonly n: string) {
    super()
  }
  eq(other: NumberMarker) {
    return other.n === this.n
  }
  toDOM() {
    return document.createTextNode(this.n)
  }
}

const furnitureLine = Decoration.line({ class: "cm-furniture" })
const targetLine = Decoration.line({ class: "cm-target" })
const headingLine = Decoration.line({ class: "cm-heading" })
const insMark = Decoration.mark({ class: "cm-ins" })
const delMark = Decoration.mark({ class: "cm-del" })

function lineDecorations(layout: BillLayout, state: EditorState) {
  const builder = new RangeSetBuilder<Decoration>()
  const count = Math.min(layout.lines.length, state.doc.lines)
  for (let i = 0; i < count; i++) {
    const kind = layout.lines[i].kind
    if (kind !== "furniture" && kind !== "heading") continue
    const line = state.doc.line(i + 1)
    builder.add(line.from, line.from, kind === "furniture" ? furnitureLine : headingLine)
  }
  return builder.finish()
}

function changeDecorations(state: EditorState) {
  const builder = new RangeSetBuilder<Decoration>()
  const text = state.doc.toString()
  for (const m of text.matchAll(CHANGE_MARK)) {
    const from = m.index ?? 0
    builder.add(from, from + m[0].length, m[1] !== undefined ? insMark : delMark)
  }
  return builder.finish()
}

// A section folds from its heading to the line before the next heading.
function sectionFolds(layout: BillLayout) {
  const starts = layout.headings.map((h) => h.line)
  return foldService.of((state, from) => {
    const line = state.doc.lineAt(from)
    const index = starts.indexOf(line.number - 1)
    if (index < 0) return null
    const end = index + 1 < starts.length ? starts[index + 1] : state.doc.lines
    if (end - 1 <= line.number - 1) return null
    const last = state.doc.line(Math.min(end, state.doc.lines))
    return { from: line.to, to: last.number === end ? last.to : state.doc.line(end).to }
  })
}

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "transparent", color: "var(--foreground)" },
  ".cm-scroller": { fontFamily: "var(--font-mono, ui-monospace, monospace)", lineHeight: "1.5" },
  ".cm-content": { padding: "12px 0" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--muted-foreground)", border: "none" },
  ".cm-docnum": { minWidth: "3ch", textAlign: "right", paddingRight: "12px", opacity: "0.9" },
  ".cm-lineNumbers .cm-gutterElement": { paddingLeft: "12px", opacity: "0.55" },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--foreground) 5%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-furniture": { opacity: "0.4" },
  ".cm-heading": { fontWeight: "600" },
  // The highlighter: the line the outline points at.
  ".cm-target": { backgroundColor: "color-mix(in oklab, #facc15 45%, transparent)" },
  ".cm-ins": { backgroundColor: "color-mix(in oklab, #16a34a 22%, transparent)", borderRadius: "2px" },
  ".cm-del": { backgroundColor: "color-mix(in oklab, #dc2626 22%, transparent)", textDecoration: "line-through", borderRadius: "2px" },
  ".cm-searchMatch": { backgroundColor: "color-mix(in oklab, var(--primary) 30%, transparent)", outline: "1px solid color-mix(in oklab, var(--primary) 60%, transparent)" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "color-mix(in oklab, var(--primary) 55%, transparent)" },
  ".cm-panels": { backgroundColor: "var(--card)", color: "var(--foreground)", borderColor: "var(--border)" },
  ".cm-panel input, .cm-panel button": { fontSize: "12px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", padding: "2px 6px" },
  ".cm-panel label": { fontSize: "12px" },
  ".cm-mergeView, .cm-changedLine": { backgroundColor: "color-mix(in oklab, #16a34a 12%, transparent)" },
  ".cm-deletedChunk": { backgroundColor: "color-mix(in oklab, #dc2626 10%, transparent)" },
  ".cm-deletedChunk .cm-deletedText": { textDecoration: "line-through", opacity: "0.8" },
  ".cm-changedText": { backgroundColor: "color-mix(in oklab, #16a34a 30%, transparent)" },
  ".cm-mergeView": { height: "100%", backgroundColor: "transparent" },
  ".cm-mergeViewEditors": { height: "100%" },
  ".cm-mergeViewEditor": { height: "100%", overflow: "auto" },
  ".cm-mergeViewEditor + .cm-mergeViewEditor": { borderLeft: "1px solid var(--border)" },
  ".cm-merge-a .cm-changedLine, .cm-deletedLine": { backgroundColor: "color-mix(in oklab, #dc2626 10%, transparent)" },
  ".cm-merge-a .cm-changedText": { backgroundColor: "color-mix(in oklab, #dc2626 30%, transparent)" },
  ".cm-merge-b .cm-changedLine": { backgroundColor: "color-mix(in oklab, #16a34a 12%, transparent)" },
  ".cm-merge-b .cm-changedText": { backgroundColor: "color-mix(in oklab, #16a34a 30%, transparent)" },
  ".cm-collapsedLines": { color: "var(--muted-foreground)", backgroundColor: "color-mix(in oklab, var(--foreground) 4%, transparent)", padding: "4px 12px", cursor: "pointer" },
  ".cm-foldGutter .cm-gutterElement": { cursor: "pointer", opacity: "0.6" },
})

export function collectMatches(doc: string, query: string, limit = 500): Match[] {
  if (!query.trim()) return []
  const state = EditorState.create({ doc })
  const cursor = new SearchCursor(state.doc, query, 0, state.doc.length, (s) => s.toLowerCase())
  const out: Match[] = []
  while (!cursor.next().done && out.length < limit) {
    const { from, to } = cursor.value
    const line = state.doc.lineAt(from)
    out.push({ line: line.number - 1, from, to, text: line.text })
  }
  return out
}

export const CodeView = React.forwardRef<
  CodeViewHandle,
  {
    text: string
    /** The version before this one, when Diff is on. */
    original?: string | null
    diff?: boolean
    /** Side by side (the previous version on the left) rather than unified. */
    split?: boolean
    wrap?: boolean
    /** Fold buttons in the gutter; on by default, a view option. */
    fold?: boolean
    /** A measure of about 100 characters, centred, rather than the full width. */
    center?: boolean
    /** The reader's query, kept in step with the panel; matches come back through onMatches. */
    query?: string
    /** A zero-based line to highlight — the outline's hover or pick. */
    highlight?: number | null
    onMatches?: (matches: Match[], layout: BillLayout) => void
    onLayout?: (layout: BillLayout) => void
    className?: string
  }
>(function CodeView({ text, original, diff = false, split = false, wrap = false, fold = true, center = false, query = "", highlight = null, onMatches, onLayout, className }, ref) {
  const host = React.useRef<HTMLDivElement>(null)
  const view = React.useRef<EditorView | null>(null)
  const merge = React.useRef<MergeView | null>(null)
  const sideBySide = diff && split && !!original
  const wrapConf = React.useRef(new Compartment())
  const foldConf = React.useRef(new Compartment())
  const mergeConf = React.useRef(new Compartment())
  const targetConf = React.useRef(new Compartment())
  const layout = React.useMemo(() => layoutBillText(text), [text])
  const originalLayout = React.useMemo(() => (original ? layoutBillText(original) : null), [original])

  React.useEffect(() => onLayout?.(layout), [layout, onLayout])

  // One editor per document. Everything else is a reconfiguration.
  React.useEffect(() => {
    if (!host.current) return
    const numbers = layout.lines.map((l) => l.n)
    const docNumbers = gutter({
      class: "cm-docnum",
      lineMarker: (_view, line) => {
        const n = numbers[_view.state.doc.lineAt(line.from).number - 1]
        return n ? new NumberMarker(n) : null
      },
    })
    const extensions = [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      lineNumbers(),
      layout.gutter ? docNumbers : [],
      foldConf.current.of(fold ? foldGutter() : []),
      sectionFolds(layout),
      history(),
      search({ top: true }),
      highlightSelectionMatches(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap]),
      EditorView.decorations.of((v) => lineDecorations(layout, v.state)),
      EditorView.decorations.of((v) => changeDecorations(v.state)),
      wrapConf.current.of(wrap ? EditorView.lineWrapping : []),
      targetConf.current.of([]),
      theme,
    ]

    // Side by side: two editors, the earlier version on the left, aligned by
    // chunk. The right one is the document every other control addresses.
    if (sideBySide && originalLayout) {
      const left = originalLayout
      const leftNumbers = left.lines.map((l) => l.n)
      const leftDocNumbers = gutter({
        class: "cm-docnum",
        lineMarker: (_view, line) => {
          const n = leftNumbers[_view.state.doc.lineAt(line.from).number - 1]
          return n ? new NumberMarker(n) : null
        },
      })
      const mv = new MergeView({
        parent: host.current,
        orientation: "a-b",
        highlightChanges: true,
        gutter: true,
        collapseUnchanged: { margin: 3, minSize: 4 },
        a: {
          doc: left.text,
          extensions: [
            EditorState.readOnly.of(true),
            EditorView.editable.of(false),
            lineNumbers(),
            left.gutter ? leftDocNumbers : [],
            EditorView.decorations.of((v) => lineDecorations(left, v.state)),
            EditorView.decorations.of((v) => changeDecorations(v.state)),
            wrap ? EditorView.lineWrapping : [],
            theme,
          ],
        },
        b: { doc: layout.text, extensions },
      })
      merge.current = mv
      view.current = mv.b
      return () => {
        mv.destroy()
        merge.current = null
        view.current = null
      }
    }

    const state = EditorState.create({ doc: layout.text, extensions: [...extensions, mergeConf.current.of([])] })
    const editor = new EditorView({ state, parent: host.current })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
  }, [layout, wrap, fold, sideBySide, originalLayout])

  React.useEffect(() => {
    view.current?.dispatch({ effects: wrapConf.current.reconfigure(wrap ? EditorView.lineWrapping : []) })
  }, [wrap])
  React.useEffect(() => {
    view.current?.dispatch({ effects: foldConf.current.reconfigure(fold ? foldGutter() : []) })
  }, [fold])

  React.useEffect(() => {
    const editor = view.current
    if (!editor) return
    const ext =
      highlight == null || highlight < 0 || highlight >= editor.state.doc.lines
        ? []
        : EditorView.decorations.of((v) => {
            const line = v.state.doc.line(highlight + 1)
            const b = new RangeSetBuilder<Decoration>()
            b.add(line.from, line.from, targetLine)
            return b.finish()
          })
    editor.dispatch({ effects: targetConf.current.reconfigure(ext) })
  }, [highlight])

  React.useEffect(() => {
    if (merge.current) return
    const on = diff && originalLayout
    view.current?.dispatch({
      effects: mergeConf.current.reconfigure(on ? unifiedMergeView({ original: originalLayout.text, mergeControls: false, highlightChanges: true, gutter: true, collapseUnchanged: { margin: 3, minSize: 4 } }) : []),
    })
  }, [diff, originalLayout, sideBySide])

  React.useEffect(() => {
    const editor = view.current
    if (!editor) return
    editor.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: query, caseSensitive: false })) })
    onMatches?.(collectMatches(layout.text, query), layout)
  }, [query, layout, onMatches])

  React.useImperativeHandle(
    ref,
    () => ({
      find: (q) => {
        const editor = view.current
        if (!editor) return
        editor.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: q, caseSensitive: false })) })
      },
      goto: (line) => {
        const editor = view.current
        if (!editor) return
        const target = editor.state.doc.line(Math.min(editor.state.doc.lines, Math.max(1, line + 1)))
        editor.dispatch({ selection: { anchor: target.from }, effects: [EditorView.scrollIntoView(target.from, { y: "start", yMargin: 24 }), StateEffect.appendConfig.of([])] })
        editor.focus()
      },
    }),
    []
  )

  return <div ref={host} className={cn("h-full min-h-0 overflow-hidden", center && "mx-auto max-w-[120ch]", className)} />
})

/** The document as the code view sees it, for callers that want the outline without mounting an editor. */
export { layoutBillText }
export type { DecorationSet }

export { theme as codeTheme }
