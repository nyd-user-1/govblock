import { ClipsApp } from "@/components/clips/clips-app"
import { DocsSidebar } from "@/components/docs-sidebar"
import { RailStrip, RailToggle } from "@/components/rail-toggle"
import { railScript } from "@/lib/rail-script"
import { Sidebar, SidebarContent, SidebarProvider } from "@govblock/ui/components/ny4/sidebar"

// Both site rails around a page (Brendan, 2026-09-13): the left one from the
// records layout, the right one from the docs page shell, mirrored on the
// inner edge. /welcome and /auth wear it.
//
// Here the rails are sheets, not columns (Brendan, 2026-09-13, later): the
// page keeps its full width and each rail slides in over it from its edge
// rather than pushing the content aside. Closed, a rail is translated off the
// page all but its 24px strip — the hairline and the tab stay where they
// were — so the look is the columns' look, only the motion differs. The
// rails' own closed-state classes (the strip's width, the hidden content)
// are overridden here so the whole sheet moves as one piece.
//
// The right rail is a second screen (Brendan, 2026-09-14): open, it reaches
// all the way across until its hairline sits on the left rail's, wherever
// that is — 1rem in when the left rail is closed, 17.5rem when it is open —
// and it lies over the page like the left one does. On it: Clips, the same
// page /clips draws, in the space the sheet gives it.
const SHEET = "absolute inset-y-0 z-40 bg-background transition-[translate,width] duration-500 ease-out [&_[data-slot=sidebar-content]]:flex!"

export function RailsFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-wrapper flex flex-1 flex-col overflow-x-clip px-2">
      {/* Closed by default here (Brendan, 2026-09-13), set before the rails below are laid out; a rail the reader opened stays open. */}
      <script dangerouslySetInnerHTML={{ __html: railScript(true) }} />
      <SidebarProvider
        className="relative min-h-min flex-1 items-start px-0 [--top-spacing:0] lg:[--top-spacing:calc(var(--spacing)*4)] 3xl:fixed:container 3xl:fixed:px-3"
        style={{ "--sidebar-width": "calc(var(--spacing) * 72)" } as React.CSSProperties}
      >
        <div className={`${SHEET} left-0 [&_[data-slot=sidebar]]:w-72! [[data-rail-left=closed]_&]:-translate-x-[calc(var(--spacing)*66)]`}>
          <RailStrip side="left" />
          <DocsSidebar />
        </div>
        {/* The strips' 24px kept clear on either side. */}
        <div className="flex min-w-0 flex-1 flex-col px-6">{children}</div>
        {/* The right sheet's left edge is half a rem short of the left line, so its own line (left-2) lands on it; closed, 24px stay in view. */}
        <div className={`${SHEET} right-0 w-[calc(100%-17rem)] [&_[data-slot=sidebar]]:w-full! [[data-rail-left=closed]_&]:w-[calc(100%-0.5rem)] [[data-rail-right=closed]_&]:translate-x-[calc(100%-1.5rem)]`}>
          <RailStrip side="right" />
          <Sidebar
            side="right"
            collapsible="none"
            className="sticky top-[calc(var(--header-height)+0.6rem)] z-30 ml-auto hidden h-[calc(100svh-10rem)] w-full shrink-0 overflow-visible overscroll-none bg-transparent lg:flex"
          >
            <div className="absolute top-12 bottom-0 left-2 hidden h-full w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--border)_10%,var(--border)_90%,transparent_100%)] lg:flex" />
            <RailToggle side="right" />
            {/* Past the tab's 16px and a little air; the page scrolls inside the sheet. */}
            <SidebarContent className="scrollbar-none ml-8 w-auto flex-1 overflow-x-hidden overflow-y-auto py-1 pr-2.5">
              <ClipsApp />
            </SidebarContent>
          </Sidebar>
        </div>
      </SidebarProvider>
    </div>
  )
}
