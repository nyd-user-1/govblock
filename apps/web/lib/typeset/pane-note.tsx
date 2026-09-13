"use client"

import * as React from "react"

// A line a pane hands to the workspace footer (Brendan, 2026-09-13): the Git
// view's "9,571 lines (4,797 loc) · 299 KB" leaves its row and sits after
// Getting started. The pane sets it while mounted; outside a provider (the
// same pane on /workspace/data) the pane keeps drawing it in place.

type PaneNote = { note: React.ReactNode; set: (note: React.ReactNode) => void }

const SetContext = React.createContext<PaneNote["set"] | null>(null)
const NoteContext = React.createContext<React.ReactNode>(null)

export function PaneNoteProvider({ children }: { children: React.ReactNode }) {
  const [note, set] = React.useState<React.ReactNode>(null)
  return (
    <SetContext.Provider value={set}>
      <NoteContext.Provider value={note}>{children}</NoteContext.Provider>
    </SetContext.Provider>
  )
}

/** The pane's side: null where no footer takes the line. */
export function usePaneNoteSetter() {
  return React.useContext(SetContext)
}

/** The footer's side. */
export function usePaneNote() {
  return React.useContext(NoteContext)
}
