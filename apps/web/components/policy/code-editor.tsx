"use client"

import * as React from "react"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { indentUnit } from "@codemirror/language"
import { Compartment, EditorState } from "@codemirror/state"
import { EditorView, keymap, lineNumbers } from "@codemirror/view"

import { codeTheme } from "@/components/policy/code-view"
import { cn } from "@govblock/ui/lib/utils"

// The editable twin of CodeView: GitHub's editor for a file, put to a bill.
// One document per mount (`initial`); every keystroke reports the whole text
// through onChange, and the indent and wrap settings from GitHub's three
// selects reconfigure the editor in place.

export function CodeEditor({
  initial,
  onChange,
  indent = "spaces",
  size = 2,
  wrap = false,
  className,
}: {
  initial: string
  onChange: (text: string) => void
  indent?: "spaces" | "tabs"
  size?: 2 | 4 | 8
  wrap?: boolean
  className?: string
}) {
  const host = React.useRef<HTMLDivElement>(null)
  const view = React.useRef<EditorView | null>(null)
  const indentConf = React.useRef(new Compartment())
  const wrapConf = React.useRef(new Compartment())
  const report = React.useRef(onChange)
  React.useEffect(() => {
    report.current = onChange
  }, [onChange])

  const indentExt = (kind: "spaces" | "tabs", n: number) => [indentUnit.of(kind === "tabs" ? "\t" : " ".repeat(n)), EditorState.tabSize.of(n)]

  React.useEffect(() => {
    if (!host.current) return
    const state = EditorState.create({
      doc: initial,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        indentConf.current.of(indentExt(indent, size)),
        wrapConf.current.of(wrap ? EditorView.lineWrapping : []),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) report.current(u.state.doc.toString())
        }),
        codeTheme,
      ],
    })
    const editor = new EditorView({ state, parent: host.current })
    view.current = editor
    editor.focus()
    return () => {
      editor.destroy()
      view.current = null
    }
    // One editor per document: the settings below reconfigure it in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])

  React.useEffect(() => {
    view.current?.dispatch({ effects: indentConf.current.reconfigure(indentExt(indent, size)) })
  }, [indent, size])
  React.useEffect(() => {
    view.current?.dispatch({ effects: wrapConf.current.reconfigure(wrap ? EditorView.lineWrapping : []) })
  }, [wrap])

  return <div ref={host} className={cn("h-full min-h-0 overflow-hidden", className)} />
}
