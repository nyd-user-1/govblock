# Handoff, 2026-09-19: Alabama's XML, then the continuous law reader

Superseded by `2026-09-19-laws-browser-v2.md`.

Nothing from 2026-09-18/19 is committed. Resume here.

## 1. Alabama — done (2026-09-19, afternoon)

Loader fixed (`scripts/laws/adapters/al.mjs`: a subtitle is read by its section range), 198 misfiled laws deleted and reloaded (1,491 laws), 6,659 XML works rebuilt (run `al-fix-2026-09-19`, all 249 jobs done), library rebuilt. `/laws/al` checked: every law once, Title 1 holds its own five chapters, Titles 11 and 22 theirs. Recorded in `apps/web/docs/xml/titles.md`.

Built for the reader so far: `lib/reader-settings.ts` (the settings store), `components/laws/reader-settings-panel.tsx` (the Settings view), `components/rail-views.tsx` + `RightRailSheet settings` + `DocsPage railSettings` (the rail's Page/Settings toggle), `before=` paging in `app/api/laws/route.ts`.

## 2. The continuous law reader (Brendan confirmed the spec, 2026-09-19)

Model: esv.org (Matthew 10 → 11 → 12). On `/laws/<st>?law=<id>[&doc=<section>]`:

- **Scroll through the whole code.** Past a law's last section the next law follows, in the list's order (`orderLaws`), and so on through the code; scrolling up loads the previous ones. Fetched and drawn off screen ahead of the reader — no pages, no spinner. The URL follows the law in view by `history.replaceState` (`?law=` changes, no reload); the document title and the rail's outline follow too. A law's start is marked inline, as ESV sets a large "11".
- **Two views, both kept** (Brendan: "just do both"): a typeset reading view (default: serif, section numbers set like verse numbers, headings) and the current code view (CodeMirror, line numbers). Both scroll continuously.
- **Markers** (Brendan: yes to both):
  1. Cross-references: a citation in the text ("AS 28.10.271") is a link; it opens a small card with the start of the cited section and "Open section".
  2. Notes that are not the law's words — repeal notes "[Repealed, § 2 ch 1 SLA 1963.]", history "(§ 1 ch 178 SLA 1977; am § 3 ch 52 SLA 1986)", effective-date notes — leave the sentence for a superscript marker whose card holds the note. A repealed section reads "28.11.010 Adoption of revision — Repealed ᵃ".
  - Patterns differ by state: recognize them per jurisdiction, as the titles were, and report coverage per state (like `apps/web/docs/xml/titles.md`).
- **Right rail, two views** toggled at its top: Page (Favorites, Outline, Build with GovBlocks — as now) and Settings: text size, line spacing, font (serif/sans/mono), theme (light/sepia/dark/auto), switches for headings, section numbers, cross-references, notes (off = notes back inline), justified text, and the view (reading/code). Settings persist per viewer (localStorage).

Design, as planned:
- `app/api/laws/route.ts` text pages page forward only (`after`); add `before=<seq>` for the page ending before a sequence (scrolling up, and the previous law's last page).
- A continuous document of blocks: a block is one text page (≤200 nodes / 700 KB) in the reading view, one law in the code view (CodeMirror `grow`, which virtualizes itself). Blocks within ~2 screens render; farther ones become spacers of their measured height. Prepending compensates `scrollTop` by hand (Safari has no scroll anchoring).
- `?doc=` anchors the first block at that section's sequence (tree API gives `sequence_no`), so the reader starts at the section with the rest above and below.
- The current law (for URL, title, outline, a small sticky label like ESV's "Matthew 12") comes from an IntersectionObserver on each law's wrapper against a line ~30% down the viewport.
- Rail toggle: `RightRailSheet` takes an optional settings view; a client `RailViews` switches between it and the usual contents.
- Theme: light/dark/auto map to the site's theme; sepia overrides the colour tokens while the reader is mounted.

Files today: `components/laws/law-text.tsx` (LawReader, LawReaderText, LawReaderOutline), `components/laws/laws-list.tsx`, `app/(records)/laws/[state]/page.tsx`, `components/policy/code-view.tsx` (`grow`), `lib/law-citation.ts`.
