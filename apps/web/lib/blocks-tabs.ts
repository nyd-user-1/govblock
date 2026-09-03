// Ported from livingston-v3 lib/blocks-tabs.ts. Which blocks /blocks shows,
// and what each one has become. The stock "State" tab (sidebar-07) was
// dropped on 2026-09-01: it was the template, not one of ours. A plain module, not the client component
// beside it: a value imported from a "use client" module into a server
// component is a client-reference proxy, not the array.

export type BlocksTab = { value: string; label: string; block: string }

export const BLOCK_TABS: BlocksTab[] = [
  { value: "committee", label: "Committee", block: "sidebar-12" },
  { value: "documents", label: "Documents", block: "sidebar-11" },
  { value: "chamber", label: "Chamber", block: "sidebar-03" },
  { value: "vote", label: "Vote", block: "sidebar-08" },
  { value: "calendar", label: "Calendar", block: "sidebar-05" },
  { value: "dashboard", label: "Dashboard", block: "dashboard-01" },
  { value: "intelligence", label: "Intelligence", block: "sidebar-09" },
]

// What /create's block switch offers, in the order of its pill: 01 is the
// cards (the designer's own stage), then the blocks. Calendar is not one of
// them — Brendan, 2026-09-03: "skip calendar, it's the wrong one" — it opens
// from a committee card instead.
export type CreateSlot = { value: string; label: string; block: string | null }

export const CREATE_SLOTS: CreateSlot[] = [
  { value: "cards", label: "Cards", block: null },
  ...BLOCK_TABS.filter((tab) => tab.value !== "calendar").map((tab) => ({ value: tab.value, label: tab.label, block: tab.block })),
]
