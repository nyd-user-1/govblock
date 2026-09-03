import { FecExplorer } from "@/components/policy/fec-explorer"

// The dashboard block, put to work: it is the FEC explorer.
//
// Brendan: "the dashboard page is a perfect page to wire in the FEC data so I
// can explore what we actually have." The shell — sidebar, header, the
// section-cards / chart / table rhythm — is `BlockShell` now, the one every
// block wears, and the sidebar carries the FEC's own filters: cycle, office,
// party, incumbency. Brendan, 2026-09-03: "Let the dashboard block become the
// corresponding FEC items." The figures are read from Parquet on S3; no
// Postgres is in this page's path.
//
// The block's own `AppSidebar`, `SiteHeader`, `SectionCards`,
// `ChartAreaInteractive` and `DataTable` stay in the registry untouched — this
// page no longer imports them, but anyone running `npx shadcn add dashboard-01`
// still gets them.

export default function Page() {
  return <FecExplorer />
}
