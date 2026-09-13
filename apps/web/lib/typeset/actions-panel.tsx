"use client"

import * as React from "react"

import type { Bill } from "@/lib/policy/types"

// The actions aside beside the Typeset editor (Brendan, 2026-09-13): opened
// and closed by the toolbar's Actions button, which lives inside Plate's
// tree, and drawn by the workspace beside the editor, which does not. This
// context is the one thing they share: the bill whose actions are listed and
// whether the aside is open. Outside a provider — the template's own
// playground, the disabled toolbar on Git and Diff — the hook answers null
// and the button has nothing to open.

type ActionsPanel = { bill: Bill | null; open: boolean; toggle: () => void; close: () => void }

const ActionsPanelContext = React.createContext<ActionsPanel | null>(null)

export function ActionsPanelProvider({ bill, children }: { bill: Bill | null; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const value = React.useMemo<ActionsPanel>(
    () => ({ bill, open, toggle: () => setOpen((o) => !o), close: () => setOpen(false) }),
    [bill, open]
  )
  return <ActionsPanelContext.Provider value={value}>{children}</ActionsPanelContext.Provider>
}

export function useActionsPanel() {
  return React.useContext(ActionsPanelContext)
}
