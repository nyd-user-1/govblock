"use client"

import * as React from "react"

// Lines a pane hands to the workspace footer (Brendan, 2026-09-13): the Git
// view's "9,571 lines (4,797 loc) · 299 KB" leaves its row and sits after
// Getting started. The pane sets it while mounted; outside a provider (the
// same pane on /workspace/data) the pane keeps drawing it in place.
//
// Keyed (2026-09-14): the size line, then the file's own facts — which
// printing, as of when, its address — from the XML reader and the fork.

const ORDER = ["size", "meta"]

type Set = (key: string, note: React.ReactNode) => void

const SetContext = React.createContext<Set | null>(null)
const NoteContext = React.createContext<Record<string, React.ReactNode>>({})

export function PaneNoteProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = React.useState<Record<string, React.ReactNode>>({})
  const set = React.useCallback<Set>((key, note) => {
    setNotes((prev) => {
      if (note === null || note === undefined) {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: note }
    })
  }, [])
  return (
    <SetContext.Provider value={set}>
      <NoteContext.Provider value={notes}>{children}</NoteContext.Provider>
    </SetContext.Provider>
  )
}

/** The pane's side: null where no footer takes the line. */
export function usePaneNoteSetter(key = "size") {
  const set = React.useContext(SetContext)
  return React.useMemo(() => (set ? (note: React.ReactNode) => set(key, note) : null), [set, key])
}

/** The footer's side: the lines in their order. */
export function usePaneNotes(): { key: string; note: React.ReactNode }[] {
  const notes = React.useContext(NoteContext)
  return Object.keys(notes)
    .sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))
    .map((key) => ({ key, note: notes[key] }))
}
