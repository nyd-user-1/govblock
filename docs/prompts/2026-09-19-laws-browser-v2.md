# Handoff, 2026-09-19: laws browser v2, and the rest of 2026-09-18/19

Supersedes `2026-09-19-continuous-reader.md`. Nothing from these two days is
committed or pushed; branch `feature/typeset-flip`. The dev server runs on
`localhost:3000` (started with `BRENDAN_OK_LOCAL_BUILD=1`).

The working tree also holds other windows' uncommitted work, untouched here:
`content-calendar` (moved from `posts`), `api/linkedin/callback`, `tags`,
`users`, `sources`, `lib/gdelt`, `scripts/gdelt`, `rail-resize.tsx`,
`elections/simulator.tsx`, `lobbying-board.tsx`, `posts-workspace.tsx`,
`social-accounts.tsx`, `rails-frame.tsx`, `record-header.tsx`,
`back-to-top.tsx`, `workspace-footer.tsx`, `lib/config.ts`, `lib/rail-script.ts`,
and the committees, hearings, members, news and sources pages (the sources
page also carries this session's one-line `assetUrl` change). Commit this
session's files on their own.

## 1. The laws browser — kept, at `/laws-browser/<st>`

The jurisdiction's law as a repository: laws in the left rail with "Go to
law…", one search box over this law or every law, the whole law as numbered
plain text in CodeMirror (`CodeView`, the bill Git view's component), and the
outline on the right. Built for New York 2026-09-04 (aa1f248), opened to every
jurisdiction in b0096a6.

- `apps/web/components/laws/laws-browser.tsx`, `apps/web/components/laws/law-text.tsx`
- `apps/web/app/laws-browser/[state]/page.tsx`: HEAD's `app/laws/[state]/page.tsx`

This session deleted it when `/laws/<st>` took the new design. Brendan never
asked for that. It was restored the same day, byte-identical to HEAD, and the
page moved to its own route because `/laws/[state]` now serves v2 (two pages
cannot share a path). Checked: 0 type errors against today's code, and
`/laws-browser/ak?law=C28.10` draws the rail, search, 1,181 numbered lines and
the 116-entry outline. Its title reads "Laws of Alaska — govblock - govblock",
the page's own title plus the site's suffix; the code is HEAD's, unchanged.

Never delete it. A future design that takes a route moves the old view to a
route of its own.

## 2. Laws browser v2, `/laws/<st>`

### The list (no `?law`)
`/bills`' layout. Laws grouped by title where the jurisdiction has one, else
by kind; the chapters index in the right rail.

- `app/(records)/laws/[state]/page.tsx`: `lawsOf()` joins `xml_library` for the
  title columns, then `fillTitles`, `orderLaws`
- `components/laws/laws-list.tsx`: `groupsOf`, `LawsList`, `LawChapters`
- `lib/law-citation.ts`: `lawCitation`, `lawName`, `orderLaws`, `fillTitles`,
  `titleHeading`, `lawsNoun`

### The reader (`?law=<id>[&doc=<section>]`)
After esv.org's Matthew 10 → 11 → 12: past a law's last section the next law
follows, through the whole code; scrolling up loads the ones before. The
address (`?law=` by `replaceState`), the document title, a sticky label
("cite · name") and the rail's outline follow the law in view.

- `components/laws/law-reader.tsx`: `LawReader` (provider), `LawDocument`,
  `LawDocOutline`. A window of blocks: in the reading view one API page
  (≤200 nodes, 700 KB), 8 kept; in the code view one law in its own
  `CodeView grow`, 3 kept. Prepending holds the text still by hand (Safari has
  no scroll anchoring).
- `app/api/laws/route.ts`: `?text=1&before=<seq>` returns the page ending
  before a sequence, for scrolling up.
- `components/policy/code-view.tsx`: `grow` (the window scrolls; the editor
  still draws only the lines in view); the highlight survives a rebuild.
- Right rail, two views toggled at its top: Page (Favorites, Outline, Build
  with GovBlocks) and Settings, esv.org's Text Settings.
  - `components/rail-views.tsx`, `RightRailSheet settings`, `DocsPage railSettings`
  - `components/laws/reader-settings-panel.tsx`, `lib/reader-settings.ts`
    (localStorage `govblock-reader-settings`): view (reading/code), size,
    spacing, font, theme (light/sepia/dark/auto; sepia recolors the tokens
    while the reader is mounted), and switches for headings, section numbers,
    cross-references, notes and justified text.

Verified in headless Chromium on the U.S. Code: down into Title 2 (address,
title and label change), up into Title 1 with the text held still (833 px →
833 px), the code view, `?doc=` landing the section at 184 px.

Not yet verified by eye: sepia, fonts, justified text, the headings and
numbers switches, switching reading ↔ code mid-code.

### Markers: not built, decision pending
The confirmed spec: cross-references become links with a card (the start of
the cited section, "Open section"); notes that are not the law's words
(history, repeal, effective date) become superscript markers with a card; a
repealed section reads "28.11.010 Adoption of revision — Repealed ᵃ"; the
Settings switches turn each off (notes off: back inline). Per-state coverage
reported, as `apps/web/docs/xml/titles.md` does for titles.

The session was about to write per-state rules inside the reader when Brendan
asked why, given the XML grammar work. The facts:

- The XML store makes the output uniform (USLM: `num`, `heading`, levels,
  `sourceCredit`, `note`, `ref`), but the grammar is per state by design:
  `apps/web/lib/xml/frontends/profiles.ts`, "one profile per state … fifty
  front ends", over `generic.ts`.
- Seven statute profiles mark history as `sourceCredit` (`credit`,
  `creditStart`, `notesStart`): IN, SC, LA, NV, KS, WA, OR. In the other 45
  the history is an ordinary paragraph in the XML.
- `ref` exists only for the U.S. Code, carried over from its source XML
  (`frontends/us.ts`). No state front end makes one.
- The reader reads raw `"Laws"` rows through `/api/laws`, not the XML.
  Statutes' XML is served at `/api/xml/uslm/[...address]`, and a statute opens
  in Typeset only in the XML reader.

Recommended to Brendan, awaiting his word: put the note and citation rules in
the statute profiles (a citation rule is a new field), rebuild the statute
store, and have v2 render the XML: `sourceCredit` and `note` as markers, `ref`
as a link with its card, raw text as the fallback for a section that falls
out. Costs: a rebuild of all 52 statute lines (hours on the box, each profile
measured first, window 8's practice); an S3 fetch per work instead of an
Aurora page (not measured); weaker grammars read worse until fixed.

### The survey, for whichever route
About 180 sections per jurisdiction, 2026-09-19 (`tablesample system (4)` into
a temp table inside one Data API transaction, then one select per state:
12 s in all). The sample files live only in the session's scratchpad, which does
not outlast it; the query rebuilds them. A dash under citations means none turned up in the
few sections read, not that the state has none.

| | Notes, as the source prints them | Citations seen | Text |
|---|---|---|---|
| AK | none; repeals "[Repealed, § 3 ch 75 SLA 1963.]" | "AS 04.09.120"; ranges lost their dash ("AS 19.30.260  19.30.320") | |
| AL | last paragraph "(Act 2019-94, §1.)", "(Code 1876, §3481; …)"; a repeal can ride in the heading ("Repealed in the 2014 Regular Session by Act 2014-144 …") | "Section 10A-2A-14.03" | |
| AR | "History", then the credit; "[Repealed.]" | "26 U.S.C. § 501(c)(3)" | |
| AZ | none | — | |
| CA | "(Amended by Stats. 2019, Ch. 351, Sec. 7. (AB 496) Effective January 1, 2020.)", "(Added by …)" | "Section 18 of Article XVI of the California Constitution" | |
| CO | " Source: L. 93: …" run onto the end; "(Repealed)" after the catchline | — | one line |
| CT | "(P.A. …)", then "History: …"; furniture "(Return to Chapter Table of Contents)…" | "sections 1-206, 4-147, 9-23g" | |
| DC | "(June 19, 1976, D.C. Law 1-72, § 8, 23 DCR 578)" | — | |
| DE | the credit after the body, broken at every "§" ("79 Del. Laws, c. 357,⏎§⏎1;") | "§ 404 of this title" | |
| FL | "History.—s. 14, ch. 2019-71; …" | "s. 627.7711", "s. 775.082 or s. 775.083" | |
| GA | "History", then "Code 1981, § 10-1-627, enacted by Ga. L. 1993 …" | — | |
| HI | "[L 1970, c 26, pt of §2; am L 1981 …]" closing the last paragraph; "§147-6 REPEALED. L 1991, c 134, §3." | — | hard-wrapped |
| IA | "[C75, 77, 79, 81, §384.13] 86 Acts, ch 1245, §118; …" then "Referred to in §384.5, …" closing the text; the next part's heading leaks in ("PART 4 FARMERS COOPERATIVE …") | "§384.5" | one line |
| ID | "History:", then "[I.C., sec. 10-1217, as added by 1974, ch. 32 …]" | — | |
| IL | "(Source: P.A. 90-97, eff. 7-11-97.)"; "(Repealed)."; heading lines "(105 ILCS 5/10-22.25a) (from Ch. 122, …)" and "Sec. 10-22.25a." | — | |
| IN | "[Pre-2003 Recodification Citation: …]", "As added by P.L.2-2003, SEC.9. Amended by …" | — | hard-wrapped |
| KS | "History:", then "L. 1923, ch. 145, § 1; …" | — | |
| KY | "Effective: April 27, 2024"; "History: Amended 2024 Ky. Acts ch. 224 … -- Created …" | "KRS 7.136(1)" | |
| LA | "Acts 1970, No. 456, §1; …", "Added by Acts 1990 …"; "§162. Repealed by Acts 2014 …" | — | hard-wrapped; "RS 10:4A-504", then "§4A-504. Catchline" |
| MA | none | — | HTML entities ("2&ndash;612"); some one line |
| MD | none | — | en dash in numbers ("§2–216") |
| ME | "[PL 2023, c. 327, §3 (AMD).]" after each subsection; "SECTION HISTORY", then the list; "(REPEALED)" | "section 1202‑B" (a non-breaking hyphen), "Title 23, chapter 3" | |
| MI | "History: 1988, Act 496, Eff. Mar. 30, 1989"; "Compiler's Notes:"; "18.353a Repealed. 1996, Act 519 …" | — | |
| MN | "History:", then "1974 c 470 s 16; …"; "[Repealed, 1Sp1985 c 13 s 376]" | "section 302A.721", "sections 86B.205, 103G.605, and 103G.621" | stray "§" lines before subdivisions |
| MO | — | — | headings only: no section text was loaded |
| MS | "History", then "Codes, 1942, § 21-06; Laws, 1972 …"; repealed sections end "§ 1-1-51. [Laws, 1973 …]" | — | |
| MT | "History: En. Sec. 2, Ch. 504, L. 2021."; "Repealed. Sec. 27, Ch. 381, L. 2005." | bare numbers: "10-3-102", "5-11-210" | |
| NC | "(1947, c. 693, s. 1.)" closing the last paragraph; "Repealed by Session Laws 1967, c. 954, s. 4" | — | |
| ND | none; "Repealed by S.L. 1975, ch. 109, § 8."; furniture "Page No. 2" | "section 41-03-54" | one line |
| NE | "Source:Laws 1993, LB 757, § 21."; "Annotations" (case notes); "Repealed. Laws 1987, LB 408, § 13." | "sections 48-1,113 and 48-1,114" | |
| NH | "Source. 2001, 290:6. 2003, 242:14. …"; "Repealed by 1987, 260:4, I, …" | — | |
| NJ | "L.1993, c.265, s.3; amended 2002, c.34, s.1." | "P.L.1968, c.410 (C.52:14B-1 et seq.)" | |
| NM | " History: Laws 1987, ch. 253, § 44." closing the text; "Repealed." | — | one line |
| NV | "(Added to NRS by 1989, 356; A 1989, 721)"; "Repealed. (See chapter 190, Statutes of Nevada 2025 …)" | — | |
| NY | none | — | hard-wrapped, paragraphs start indented; some sections open "*" |
| OH | "Effective: …", "Latest Legislation: House Bill 538 - 121st General Assembly", "Last updated … at 2:01 PM" | "… of the Revised Code" | |
| OK | " Added by Laws 1987, c. 225, § 39 … Amended by … Renumbered from § 1-818.39 of Title 63 …" closing the text; furniture "Oklahoma Statutes - Title 1. Abstracting Page 7" | — | one line |
| OR | "[1985 c.665 §14]" closing the text; "Note: …"; a repealed section is its bracket, then the next heading ("(Miscellaneous Provisions)") | "ORS 126.842" | |
| PA | "Cross References. Section 11804 is referred to in section 12531 of this title." | "section 12531 of this title" | hard-wrapped |
| RI | "History of Section.", then "G.L. 1923, ch. 351, § 31; …" | "§ 10-5-42" | hard-wrapped |
| SC | "HISTORY: 2000 Act No. 292, SECTION 1."; editors' notes on amendments | — | |
| SD | "Source: SL 1994, ch 290, § 1."; runs of repealed sections inside one ("10-12-10, 10-12-11. Repealed by SL 1982 …") | "§ 36-2-19", "chapter 34-12" | |
| TN | "History", then "Acts 1992, ch. 731, § 1."; "[Repealed]" | — | |
| TX | "Added by Acts 2001, 77th Leg., ch. 1393 …"; "Amended by:", then one paragraph per act | "Section 60.030" | |
| US | "(Pub. L. 104–1, title III, § 306 … 123 Stat. 2031.)" | in the source XML already | |
| UT | "Amended by Chapter 316, 2004 General Session", the year doubled ("Session2004", "No Change Since 19531953") | "Section 58-1-307" | |
| VA | "1975, c. 411, § 7.1-25.1; 2005, c. 839.", "Code 1919, § 1; R. P. 1948, § 1-1."; "§§ 10.1-1200 through 10.1-1212. Repealed." | — | |
| VT | "(Added 1989, No. 250 (Adj. Sess.), § 1.)" closing the last paragraph; "Repealed. 2019, No. 49, § 4 …" | "3 V.S.A. § 3091" | hard-wrapped |
| WA | "[ 2010 c 254 s 8.]", then "Notes:" and each note | "RCW 36.75.010", "15 U.S.C. Sec. 7001" | |
| WI | none | — | one line |
| WV | none | "§30-4A-1 et seq." | |
| WY | none; "Repealed by Laws 2019, ch. 13, § 2." | "W.S. 1-18-101 through 1-18-110" | one line |

"Hard-wrapped": single line breaks mid-sentence, paragraphs split by blank
lines (share of single breaks that fall mid-sentence: HI 91%, IN 87%, LA 88%,
PA 93%, RI 83%, VT 94%, NY 86%). Elsewhere a single break before "(1)" is a
new paragraph (AK, AR, GA, MS, TN). "One line": the whole section with no
breaks at all, catchline and credit included. Whether the XML already rejoins
or splits these is not checked. Both v2 and the laws browser draw the rows as
stored.

Resolving a citation: in most states `location_id` is the section number and
unique statewide. Not in CA, TX, NY, MD (numbers repeat across codes: resolve
by the named code, else this one), DE, PA, ME (numbered within a title), OK
(`12-1762`, title-prefixed), VT (numbered within a title, but laws are
chapters, `T04C029`), US (`s589` under `USC07`), IL (`105 ILCS 305/0.01`), MA
(within a chapter). ND and TX suffix repeats `~2`. A lookup by
`(state, location_id)` without `law_id` scans `Laws_pkey` for the state: about
1 s cold. There is no `(state, location_id)` index; adding one is DDL, Brendan's
call.

## 3. Titles and Alabama — done

`apps/web/docs/xml/titles.md` has the 52-row report and what is still wrong
(Maine's 25 lettered titles unloaded; South Dakota 18 titles; about 25 laws
filed as the constitution by `isConstitution`; 28 units named only by number).
`sql/033_library_titles.sql` (run, with Brendan's word), `scripts/xml/lib/titles.mjs`,
`scripts/xml/sources/titles/*.json`, `scripts/xml/library.mjs`. Alabama's loader
(`scripts/laws/adapters/al.mjs`) now reads a subtitle by its section range;
1,491 laws reloaded, 6,659 works rebuilt (run `al-fix-2026-09-19`), library rebuilt.

## 4. National search — steps 1–3 of `2026-09-18-national-search.md`, done

- Step 1 timings, reported 2026-09-18: common words are the slow case
  ("tax" in all bill text hit the 45 s cap at the default 4 MB `work_mem`;
  2.9 s cold at 64 MB; law ranked by `ts_rank_cd` 33 s cold for "tax").
- Step 2: no DDL; `people_name_trgm` and `people_aliases_trgm` exist.
- Step 3: `lib/policy/db.ts` `qTuned` (one transaction: `work_mem` 64 MB and a
  statement timeout); `lib/policy/national-search.ts` (bills in current
  sessions first, widening when short; law headings first, then text;
  legislators); `app/api/national-search/route.ts` (`?q=&j=&only=&sort=`);
  `components/national-search.tsx`; `components/search-sections.tsx`, shared with
  `/search`. `lib/policy/db-queries.ts` exports its constants and
  `billNumberMatch`.

## 5. Home, `/state`, favorites — done

- Home section 2 is `/bills`' layout, titled "Scope", counts line "2.1M Bills,
  1.9M Sections of Law, and 21.7K Legislators" (`components/bills-index.tsx`,
  `bills-views.tsx` with cards/table and their skeletons, `docs-header.tsx`,
  `root-sections.ts`); the search bar sits above the header's rule. Hero
  down-arrow, last to fade in, floating, scrolls to section 2
  (`sign-stage.tsx`); particle line at 0.83 (`app/page.tsx`).
- `/state`: count columns whose counts are the links, first-session year links
  to that session (`components/state-table.tsx`, `lib/policy/state-index.ts`,
  `app/api/state-index`, `app/state/(index)`, `bills-scope.tsx` reads `?session`).
- Favorites: a star before the ↗ in `RecordItem`, yellow when kept; the
  favorites rail first in every right rail, three shown with a chevron; members
  carry "Party, State, District" (`lib/favorites.ts`, `favorite-star.tsx`,
  `favorites-rail.tsx`, `rail-sheet.tsx`, `lib/legislative-body.ts` `memberLine`).
- Jurisdiction index: grey hover, underline kept.

## 6. Amplify's size cap

Production has served job 282 (2026-09-15, 180 MB) since jobs 283–287
failed. Job 287 (2026-09-17) built 234.9 MB against a 230.7 MB cap, from
Amplify's own log (`aws amplify get-job --app-id d2a69zdzqun8m7 --branch-name
main --job-id 287`, the BUILD step's log URL; the build prints its sizes):

| | Job 287 | Since 282 |
|---|---:|---:|
| `.next/server/app/mentions`, pre-rendered pages | 37 MB | new |
| `.next/server/app`, every other route | 80 MB | +8 MB |
| `.next/server/chunks` | 72 MB | +5 MB |
| `.next/static` | 42 MB | 0 |
| `public/` | 12 MB | 0 |

`public/` counts: `lib/map/geo-url.ts` records the map's 13 MB of `/geo`
leaving it for the same cap. Git tracks 46 MB; the repo is not the problem.

Done 2026-09-19, uncommitted, not yet measured by a build:

1. **`/mentions` renders on request.** `mentions/day/[date]` and
   `mentions/state/[code]` return `[]` from `generateStaticParams`, like 13
   other routes; the build wrote 53 state pages and the day pages with their
   data (a day page is 725 KB of HTML). About −37 MB.
2. **Six `public/` folders moved to the public bucket**, 267 files, 10.7 MB,
   byte counts checked: `chambers`, `seals`, `unite`, `forms`, `reports`, `r`
   at `https://govblock-geo-638175140432.s3.amazonaws.com/public/<folder>/…`,
   each file with its content type, CORS open for GET. `public/` is 704 KB.
   - `lib/assets.ts` (`assetUrl`, `ASSET_BASE`) turns `/chambers/…` into the
     bucket's URL; used by `chamberImage` (`lib/imagery.ts`), `AGENCY_SEALS`
     (`lib/seals.ts`), `FormSeal`, the sources page, the workspace datasets'
     seals, the Unite captures (`unite-2.tsx`) and the Filer's PDF fetch
     (`lib/forms/fill.ts`). Pages carry the bucket URLs directly; checked on
     `/sources`, `/members`, `/bills/us`, `/unite-2`, every image loading.
   - `next.config.ts` redirects the old addresses (307) for everything else:
     the shadcn registry `/r/…` that v0 and the CLI fetch, `/forms/*.pdf`,
     `/reports/*.pdf|html`. `/forms` and `/reports` stay pages.
   - The licence logs moved to `apps/web/docs/assets/chambers-sources.md` and
     `seals-sources.md`.
3. **George** (`george_washington_1979.5.1.jpg`, 3.4 MB, referenced nowhere)
   is at `s3://govblock-geo-638175140432/archive/`, checksum matched, and out
   of the repo.

Estimated output now about 187 MB. A local production build would give the
number; builds on the Mac need `BRENDAN_OK_LOCAL_BUILD=1` and his word.

Still open, from the inventory:
- **Snapshot data in browser JavaScript, at least 4.8 MB.** The client hook
  `lib/policy/use-folder.ts` imports `lib/policy/snapshot.ts` (about 3.5 MB of
  Congress JSON); `changelog-v2-body` → `lib/policy/stream.ts` (0.39 MB),
  `erd/canvas` → `lib/erd/model.ts` (0.33 MB), `chat/delivery-card` →
  `lib/forms/specs/ldss-2921.ts` (0.17 MB), `directory-list` →
  `members-us.json` (0.17 MB). Fetch them through the API instead.
- **Server data:** GDELT press 1.43 MB, sample 1.28 MB, model-bill matches
  0.78 MB; the uncommitted `gdelt-tag-stories.json` (1.55 MB) and
  `gdelt-tags.json` (0.15 MB) ship when committed.
- **Dev-only routes:** `app/dev/typeset-bench`, `app/preview/typeset`.
- **Which libraries fill the 72 MB of server chunks and 42 MB of browser
  JavaScript:** needs a production build.
- **Root files that never reach the build** (Amplify's artifact is
  `apps/web/.next`) but go to GitHub with every push: eight prototype HTML
  files, 5.7 MB (`simulator.html`, `chart-2.html`, `briefing-1.html`,
  `labor-committee-dashboard.html`, `unite-hero-v1/v2.html`,
  `report-1/2.html`), `docs/design/simulator`'s three HTML files (2.1 MB),
  `scripts/gdelt/legislators.json` (3.0 MB). Brendan: "none of this should be
  pushed"; whether they leave git is his call.

## 7. Open

- Markers: Brendan's decision on the grammar route (section 2).
- Missouri's section text: the loader stored headings only.
- The header's border/shadow on `/`: `ScrollShade` watches only the window's
  scroll. Offered, not approved.
- The "Open in v0" button (`components/open-in-v0-button.tsx`) points at
  `/r/styles/…`, removed from `public/r` in a5324a1 before this session; the
  link was already dead.

## 8. Checking

- Typecheck changed files only: `cd apps/web && node --max-old-space-size=2048 ../../scripts/check-files.cjs <files>`.
- Headless Chromium: `~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell --remote-debugging-port=9333`,
  driven over CDP from Node's WebSocket. Override the user agent to a normal
  Chrome's: the proxy refuses "HeadlessChrome".
- Data API from the shell: `aws rds-data execute-statement` with the ARNs in
  `apps/web/.env.local`, retrying `DatabaseResumingException` while the cluster
  wakes; 45 s per statement. The API reads `:name` as a parameter, so no
  `[1:2]` slices in SQL.
- After a library rebuild, clear the read cache
  (`clearReadCache([...], "http://localhost:3000")`) and load twice: tag
  revalidation serves stale once.
