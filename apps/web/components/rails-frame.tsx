import { ChangelogSheet } from "@/components/changelog-v2-body"
import { ClipsApp } from "@/components/clips/clips-app"
import { DocsSidebar } from "@/components/docs-sidebar"
import { HomeSheet } from "@/components/home/home-sheet"
import { MapWorkspace } from "@/components/map/map-workspace"
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
// page /clips draws, in the space the sheet gives it. Inside it, a third
// sheet (Brendan, 2026-09-14, later): a rail within the rail, the same
// strip, line and tab at the second screen's right edge, opening across the
// second screen until its line sits on the second screen's, its tab where
// the outer tab sits. Closed, it paints nothing but its line and tab, so no
// sheet edge shows beside the line (Brendan, 2026-09-14). On it: the Map.
// The pattern twice more (Brendan, 2026-09-15): inside the Map's sheet, one
// holding the changelog's center container across every state and Congress,
// and inside that, one holding the account home's center container under
// Congress. A sheet whose parent is closed is hidden with it, and both read
// the API once the page has settled (2026-09-17), so they are drawn before a
// reader opens their way in.
// The sheet's overrides reach its own sidebar only (the direct child), never a shell inside it: the Map's block shell has a sidebar of its own, and a descendant selector once forced it open and full width (2026-09-14).
const SHEET = "absolute inset-y-0 z-40 bg-background transition-[translate,width] duration-500 ease-out [&>[data-slot=sidebar]>[data-slot=sidebar-content]]:flex!"
const LINE = "absolute top-12 bottom-0 left-2 hidden h-full w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--border)_10%,var(--border)_90%,transparent_100%)] lg:flex"

export function RailsFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-wrapper flex flex-1 flex-col overflow-x-clip px-2">
      {/* Closed by default here (Brendan, 2026-09-13), set before the rails below are laid out; a rail the reader opened stays open. */}
      <script dangerouslySetInnerHTML={{ __html: railScript(true) }} />
      <SidebarProvider
        className="relative min-h-min flex-1 items-start px-0 [--top-spacing:0] lg:[--top-spacing:calc(var(--spacing)*4)] 3xl:fixed:container 3xl:fixed:px-3"
        style={{ "--sidebar-width": "calc(var(--spacing) * 72)" } as React.CSSProperties}
      >
        <div className={`${SHEET} left-0 [&>[data-slot=sidebar]]:w-72! [[data-rail-left=closed]_&]:-translate-x-[calc(var(--spacing)*66)]`}>
          <RailStrip side="left" />
          <DocsSidebar />
        </div>
        {/* The strips' 24px kept clear on either side. The column scrolls on
            its own (2026-09-17): the Map in the right sheet is a designer
            surface, and the site layout pins any page holding one to the
            viewport, so /research, /state and the rest could not scroll. */}
        <div className="flex h-[calc(100svh-var(--header-height))] min-w-0 flex-1 flex-col overflow-y-auto px-6">{children}</div>
        {/* The right sheet's left edge is half a rem short of the left line, so its own line (left-2) lands on it; closed, 24px stay in view. */}
        <div className={`${SHEET} right-0 w-[calc(100%-17rem)] [&>[data-slot=sidebar]]:w-full! [[data-rail-left=closed]_&]:w-[calc(100%-0.5rem)] [[data-rail-right=closed]_&]:translate-x-[calc(100%-1.5rem)]`}>
          <RailStrip side="right" />
          <Sidebar
            side="right"
            collapsible="none"
            className="sticky top-[calc(var(--header-height)+0.6rem)] z-30 ml-auto hidden h-[calc(100svh-var(--header-height)-1.2rem)] w-full shrink-0 overflow-visible overscroll-none bg-transparent lg:flex"
          >
            <div className={LINE} />
            <RailToggle side="right" />
            {/* Past the tab's 16px and a little air; the page scrolls inside the sheet. */}
            <SidebarContent className="scrollbar-none ml-8 w-auto flex-1 overflow-x-hidden overflow-y-auto py-1 pr-2.5">
              <ClipsApp frame="sheet" />
            </SidebarContent>
            {/* The rail within the rail: the whole second screen's width, so its line lands on the second screen's when open. */}
            <div className={`${SHEET} right-0 w-full [[data-rail-right-2=closed]_&]:translate-x-[calc(100%-1.5rem)] [[data-rail-right-2=closed]_&]:bg-transparent`}>
              <RailStrip side="right-2" />
              <div className={LINE} />
              <RailToggle side="right-2" />
              <div className="ml-8 flex h-full min-h-0 flex-1 flex-col overflow-hidden py-1 pr-2.5 [[data-rail-right-2=closed]_&]:invisible">
                <MapWorkspace />
              </div>
              <div className={`${SHEET} right-0 w-full [[data-rail-right-2=closed]_&]:invisible [[data-rail-right-3=closed]_&]:translate-x-[calc(100%-1.5rem)] [[data-rail-right-3=closed]_&]:bg-transparent`}>
                <RailStrip side="right-3" />
                <div className={LINE} />
                <RailToggle side="right-3" />
                <div className="scrollbar-none ml-8 h-full min-h-0 overflow-x-hidden overflow-y-auto py-1 pr-2.5 [[data-rail-right-3=closed]_&]:invisible">
                  <ChangelogSheet />
                </div>
                <div className={`${SHEET} right-0 w-full [[data-rail-right-3=closed]_&]:invisible [[data-rail-right-4=closed]_&]:translate-x-[calc(100%-1.5rem)] [[data-rail-right-4=closed]_&]:bg-transparent`}>
                  <RailStrip side="right-4" />
                  <div className={LINE} />
                  <RailToggle side="right-4" />
                  <div className="scrollbar-none ml-8 h-full min-h-0 overflow-x-hidden overflow-y-auto py-1 pr-2.5 [[data-rail-right-4=closed]_&]:invisible">
                    <HomeSheet />
                  </div>
                </div>
              </div>
            </div>
          </Sidebar>
        </div>
      </SidebarProvider>
    </div>
  )
}
