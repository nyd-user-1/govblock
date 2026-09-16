import { LeftRailSheet } from "@/components/rail-sheet"
import { railScript } from "@/lib/rail-script"
import { SidebarProvider } from "@govblock/ui/components/ny4/sidebar"

// The shell every records page wears: the site's left rail, then the page.
//
// The rail is a sheet now (Brendan, 2026-09-16), the root page's pattern: it
// lies over the page from its own edge instead of standing in a grid column
// beside it, and both rails start closed, each remembering its own state. The
// page's own right rail is the same sheet mirrored — components/docs-page.tsx
// draws it, since what goes in it belongs to the page.
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-wrapper flex flex-1 flex-col overflow-x-clip px-2">
      {/* Closed by default, set before the rails are laid out so neither flashes open; a rail the reader opened stays open. */}
      <script dangerouslySetInnerHTML={{ __html: railScript(true) }} />
      <SidebarProvider
        className="relative min-h-min flex-1 items-start px-0 [--top-spacing:0] lg:[--top-spacing:calc(var(--spacing)*4)] 3xl:fixed:container 3xl:fixed:px-3"
        style={{ "--sidebar-width": "calc(var(--spacing) * 72)" } as React.CSSProperties}
      >
        <LeftRailSheet />
        {/* The strips' 24px kept clear on either side. */}
        <div className="flex min-w-0 flex-1 flex-col px-6">{children}</div>
      </SidebarProvider>
    </div>
  )
}
