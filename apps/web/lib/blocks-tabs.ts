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
