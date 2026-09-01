import { FecExplorer } from "@/components/policy/fec-explorer"
import { AppSidebar } from "@/registry/blocks/dashboard-01/components/app-sidebar"
import { SiteHeader } from "@/registry/blocks/dashboard-01/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@govblock/ui/components/ny4/sidebar"

// The dashboard block, put to work: it is the FEC explorer.
//
// Brendan: "the dashboard page is a perfect page to wire in the FEC data so I
// can explore what we actually have." Same shell — sidebar, header, the
// section-cards / chart / table rhythm — with the demo numbers replaced by
// federal campaign finance read from Parquet on S3. No Postgres is in this
// page's path; the "What we hold" panel at the bottom is the loader's own
// manifest, so the page can also answer "what do we actually have".
//
// The block's own `SectionCards`, `ChartAreaInteractive` and `DataTable` stay
// in the registry untouched — this page no longer imports them, but anyone
// running `npx shadcn add dashboard-01` still gets them.

export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <FecExplorer />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
