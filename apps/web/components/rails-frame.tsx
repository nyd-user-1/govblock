import { BackToTop } from "@/components/back-to-top"
import { DocsSidebar } from "@/components/docs-sidebar"
import { RightRailSheet } from "@/components/rail-sheet"
import { RailStrip } from "@/components/rail-toggle"
import { SearchRailProvider } from "@/components/search-rail"
import { ManualFetchProvider } from "@/lib/policy/manual-fetch"
import { railScript } from "@/lib/rail-script"
import { SidebarProvider } from "@govblock/ui/components/ny4/sidebar"

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
// Clips comes off (Brendan, 2026-09-19): the Map is the second screen, and
// the changelog and the account home each move up one sheet behind it.
// The sheets cost the page nothing until opened (Brendan, 2026-09-20): each
// mounts when a reader first opens their way to it, and the changelog and the
// account home are demonstrations drawn from lib/data/root-sheets.json, not
// the API. Drawn ahead of the reader they held every load of the root for
// some four seconds. The changelog is the second screen now and the Map the
// sheet behind it: the first tab opens on something already drawn, and the
// Map, which takes a second to draw, is a tab further in. The left rail reads
// nothing either: its Recent Bills and Committees are Congress's committed
// snapshot until the icon beside its search is pressed.
// The three sheets come off (Brendan, 2026-09-22: "remove all three sheets
// from the root page"): the changelog, the Map and the account home are gone
// from the right, and the right rail is the one every other page wears
// (RightRailSheet, components/rail-sheet.tsx) — Favorites at its head, then
// what the page hands it, which here is the search's filters, opened by the
// icon in the search bar (components/search-rail.tsx). It was a rail of this
// file's own for an hour, and it sat where /bills's does not: no resize
// handle, no Favorites, and its heading under the header rather than clear of
// it. A page that hands the frame nothing has no right rail.
// The sheet's overrides reach its own sidebar only (the direct child), never a shell inside it: the Map's block shell has a sidebar of its own, and a descendant selector once forced it open and full width (2026-09-14).
const SHEET = "absolute inset-y-0 z-40 bg-background transition-[translate,width] duration-500 ease-out [&>[data-slot=sidebar]>[data-slot=sidebar-content]]:flex!"

export function RailsFrame({ children, rail }: { children: React.ReactNode; /** The right rail's content; none, no right rail. */ rail?: React.ReactNode }) {
  return (
    <SearchRailProvider>
    <div className="container-wrapper flex flex-1 flex-col overflow-x-clip px-2">
      {/* Closed by default here (Brendan, 2026-09-13), set before the rails below are laid out; a rail the reader opened stays open. */}
      <script dangerouslySetInnerHTML={{ __html: railScript(true) }} />
      {/* The site layout pins a page to the viewport while a designer surface is in it, which the Map's sheet was until 2026-09-22; the frame still says so, since the column below scrolls on its own and the page would otherwise scroll on to the site's footer. */}
      <span data-slot="designer" hidden />
      <SidebarProvider
        className="relative min-h-min flex-1 items-start px-0 [--top-spacing:0] lg:[--top-spacing:calc(var(--spacing)*4)] 3xl:fixed:container 3xl:fixed:px-3"
        style={{ "--sidebar-width": "calc(var(--spacing) * 72)" } as React.CSSProperties}
      >
        <div className={`${SHEET} left-0 [&>[data-slot=sidebar]]:w-72! [[data-rail-left=closed]_&]:-translate-x-[calc(var(--spacing)*66)]`}>
          <RailStrip side="left" />
          <ManualFetchProvider>
            <DocsSidebar />
          </ManualFetchProvider>
        </div>
        {/* The strips' 24px kept clear on either side. The column scrolls on
            its own (2026-09-17): the Map in the right sheet is a designer
            surface, and the site layout pins any page holding one to the
            viewport, so /research, /state and the rest could not scroll. */}
        <div className="flex h-[calc(100svh-var(--header-height))] min-w-0 flex-1 flex-col overflow-y-auto px-6">
          {children}
          <BackToTop />
        </div>
        {/* No offset of its own: the left rail here sits flush under the header too, and the two must start on one line. */}
        {rail && <RightRailSheet>{rail}</RightRailSheet>}
      </SidebarProvider>
    </div>
    </SearchRailProvider>
  )
}
