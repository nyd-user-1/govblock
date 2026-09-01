// Ported from livingston-v3 lib/blocks-tabs.ts. Which blocks /blocks shows,
// and what each one has become. A plain module, not the client component
// beside it: a value imported from a "use client" module into a server
// component is a client-reference proxy, not the array.

export type BlocksTab = { value: string; label: string; block: string }

export const BLOCK_TABS: BlocksTab[] = [
  { value: "state", label: "State", block: "sidebar-07" },
  { value: "committee", label: "Committee", block: "sidebar-12" },
  { value: "documents", label: "Documents", block: "sidebar-11" },
  { value: "chamber", label: "Chamber", block: "sidebar-03" },
  { value: "vote", label: "Vote", block: "sidebar-08" },
  { value: "calendar", label: "Calendar", block: "sidebar-05" },
  { value: "dashboard", label: "Dashboard", block: "dashboard-01" },
  { value: "intelligence", label: "Intelligence", block: "sidebar-09" },
]
