# Federal resources inventory

A living map of federal congressional data sources: what each one offers, whether
we already hold the equivalent, the gap, the upstream machine-readable source,
and what it would cost to ingest.

**This document is append-only by design.** Links arrive in batches. New rows go
into the theme table they belong to, keeping the ID sequence going; links that
arrive before anyone has slotted them go into [Pending / to-triage](#pending--to-triage)
at the bottom and get promoted later. Do not renumber existing IDs — other docs
and commits cite them.

Every fetchability claim below was checked from this machine on **2026-09-07**,
batch 2 additions on **2026-09-08**.

**Where the work runs.** This laptop reads and plans; it does not ingest. Every
ingest recommended here is sized for an AWS box in the same region as the Aurora
cluster — no bulk downloads, no headless browsers, no local prototypes on this
device. Each build below says what runs where and roughly what it costs.

---

## Row format

| Field | Meaning |
| --- | --- |
| **ID** | Stable handle, `THEME-NN`. Never reused, never renumbered. |
| **Resource** | Human name + the URL a person would open. |
| **What it provides** | The data, not the page. |
| **Have it?** | `Yes` (ingested + surfaced) · `Data` (ingested, not surfaced) · `Partial` · `No`. |
| **Gap** | What is missing between what we hold and what the resource shows. |
| **Upstream** | The machine-readable source to ingest from — API, XML, bulk file. |
| **Feasibility** | `easy` (a day) · `medium` (a few days) · `hard` (a tranche of its own). |
| **Priority** | `P0` build next · `P1` soon · `P2` worth having · `P3` catalogued only. |

## Access notes (read before planning any ingest)

- **Everything the Library of Congress serves as HTML is closed to us.** Not just
  congress.gov — verified 403 on `www.congress.gov`, `bioguide.congress.gov`
  (including its `/search/bio/{id}.json` endpoint), `crsreports.congress.gov` and
  `www.loc.gov` (including the `?fo=json` collections API). Plain `curl` with a
  browser UA, Tavily extract and Exa livecrawl all fail; only Exa's *cached*
  index returns text. **The keyed `api.congress.gov` is the only LOC door that
  opens.** Treat every congress.gov page below as a design reference to rebuild
  from its own upstream, never as a scrape target — and assume the same of any
  new `*.congress.gov` or `loc.gov` link that arrives.
- **house.gov, senate.gov, govinfo.gov and gpo.gov are wide open.**
  `docs.house.gov`, `clerk.house.gov`, `www.senate.gov`,
  `www.dailypress.senate.gov`, `api.govinfo.gov`, `www.govinfo.gov/bulkdata` and
  every `github.com/usgpo` repo serve to plain `curl`, with real XML/JSON behind
  the HTML. The executive branch is likewise open: `api.usaspending.gov`,
  `fec.gov`, `irs.gov`, `data.wa.gov`. **`cbo.gov` is the exception — 403.**
- **A missing User-Agent is not a block.** `iga.in.gov` serves a 691-byte SPA
  shell to bare `curl` and the real asset to a browser UA. Legislator headshots
  are a case in point: `iga.in.gov/images/legislators/.../legislator_scott_alexander_1.jpg`
  returns **200, 193 KB, a real 600×900 JPEG** with a UA set, and the shell
  without one. Always retry with a UA before calling a source gated.
- **`govinfo.gov/bulkdata/json/*` needs `accept: application/json`.** Without the
  header it returns a 200 carrying an HTML error page, which reads as a live
  endpoint returning garbage. With it, the directory listing is clean JSON.
- **`lis.gov` is unreachable from this network** — DNS resolves (140.147.239.215)
  but every connection times out on both 80 and 443. Its content lives on
  govinfo as collection `CCAL`. See `CMT-05`.
- **govinfo needs a key we do not have.** `api.govinfo.gov` answers `DEMO_KEY`
  (rate-limited, ~30/hr), and `apps/web/.env.local` has **no** `GOVINFO_API_KEY`
  despite the tranche brief saying one exists. Bulk paths under
  `govinfo.gov/bulkdata/` need no key. **Blocker for `REC-04`, `CMT-05`, `HRG-02`.**
- **No `YOUTUBE_API_KEY` in `apps/web/.env.local`** either, though
  `lib/policy/committee-video.ts` reads one. Committee video on `/docs/committees/[id]`
  is therefore returning `unconfigured` in any environment without it.

---

## What we already hold

Baseline as of 2026-09-07, from `pg_stat_user_tables`, so "gap" below means
something real and not a table nobody checked.

| Table | Rows | Span | Note |
| --- | --- | --- | --- |
| `congress_committee_meetings` | 2,681 | 2025-01-14 → 2026-09-17 | 119th only. Forward-looking; matches docs.house.gov event-for-event (see `CAL-03`). |
| `congress_hearings` | 940 | 2025-01-03 → 2026-07-29 | Printed hearing transcripts (jacket numbers), 119th only. |
| `congress_hearing_texts` | 934 | — | Text for nearly all of the above. |
| `congress_committees` | 236 | current | 42 full committees + 178 subcommittees + joint/select. |
| `congress_committee_members` | 3,895 | current | `bioguide_id`, `rank`, `title`, `party` — chair and ranking member already resolvable. |
| `congress_record_daily` | 5,862 | 1995-01-04 → 2026-09-04 | Issue-level index, 30 years. |
| `congress_record_articles` | 91,174 | 2023 → 2026 only | **Headings, not text** — avg 239 chars, max 485. 715 of 5,862 issues have any. |
| `congress_house_votes` | 657 | 119th | House roll calls. |
| `congress_house_vote_positions` | 284,025 | 119th | Member-by-member. |
| `congress_congresses` | 119 | 1789 → | Session start/end dates. No day-level session data. |
| `congress_members` | 555 | current | |
| `house_offices` / `house_staff` | 1,524 / 9,424 | current | From directory.house.gov. |
| `senate_contact` | 100 | current | From `senators_cfm.xml`. Senate has no staff directory. |

Surfaces that already exist: `/calendar/[view]/[date]` (US reads
`congress_committee_meetings` via `lib/policy/db-queries.ts`), `/docs/meetings`,
`/docs/hearings`, `/docs/committees`, `/docs/record`, `/docs/datasets`.

---

## CAL — Calendars and schedules

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **CAL-01** | Floor Calendars index — `congress.gov/calendars-and-schedules` | Directory page: House Majority Leader weekly/annual calendars, Clerk floor activity, House & Senate days in session, Senate floor schedule, Calendar of Business, Executive Calendar, Press Gallery. | No | Not a dataset — it is the *map*. Every child is inventoried below. | n/a (reference only; page is 403 to us, read via Exa cache) | easy | P3 |
| **CAL-02** | Weekly committee schedule — `congress.gov/committee-schedule/weekly/2026/08/24` | Combined House + Senate committee meetings for a week: committee, time, location, hearing title, **witness names**, link to meeting details. | **Data** | Page does not exist. Our calendar shows title/type/committee/room only — witnesses, documents and related bills sit unread in `payload`. | None needed. Page states its sources are "the House Committee Repository and Hearings & Meetings on Senate.gov" — exactly what `congress_committee_meetings` already mirrors. | easy | **P0** |
| **CAL-03** | House Committee Repository calendar — `docs.house.gov/Committee/Calendar/ByMonth.aspx?M=9&Y=2026` (Brendan: *"this is what should be on our calendar views"*) | Month grid → `ByDay.aspx?DayID=MMDDYYYY` → `ByEvent.aspx?EventID=N`. Per event: type, committee, time, room, first-published date, **Meeting XML**, **Meeting Package (.zip)**. | **Data** | Presentation only. Verified week of 2026-07-20: docs.house.gov lists **31** House events, we hold **32**. `event_id` is byte-identical to `EventID` (checked 119538). | Already ingested via congress.gov `committee-meeting`. If we ever want the source directly: static XML at `docs.house.gov/meetings/{CC}/{CCSS}/{YYYYMMDD}/{EventID}/HHRG-{congress}-{CCSS}-{YYYYMMDD}.xml` — confirmed 200, no postback needed. | easy | **P0** |
| **CAL-04** | Senate Daily Press — `dailypress.senate.gov` | Daily Senate floor narrative: what convened, what passed, cloture ripening times, next-vote notice, Executive Calendar numbers. | No | Whole thing. | **WordPress REST, public and unauthenticated**: `/wp-json/wp/v2/posts?per_page=100&page=N`. `X-WP-Total: 1828`, oldest post 2016-10-27. ~19 requests for the full archive. | easy | **P0** |
| **CAL-05** | House floor summary — `clerk.house.gov/FloorSummary?date=08/10/2026` | Timestamped floor actions for a legislative day, each with an action code and a prose description. | No | Whole thing. | Two XML feeds, both open: per-day `clerk.house.gov/floor/{YYYYMMDD}.xml`, and whole-session `clerk.house.gov/floor/HDoc-{congress}-{session}-FloorProceedings.xml`. 119-2 = 2.2 MB, **117 legislative days, 4,601 actions, 67 distinct `act-id` codes**. Archive confirmed back to the 115th. | easy | **P0** |
| **CAL-06** | Senate floor activity archive — `senate.gov/legislative/LIS/floor_activity/all-floor-activity-files.htm` | Per-day Senate floor proceedings, sectioned (`adjournment`, measures considered, etc.) with prose content. | No | Whole thing. Senate counterpart to `CAL-05`. | **2,251 day-files of XML, 2014 → present.** Current year at `/floor_activity/{MM_DD_YYYY}_Senate_Floor.xml`, prior years under `/floor_activity/{YYYY}/`. Index page lists every URL. | easy | **P0** |
| **CAL-07** | Days in Session — `congress.gov/days-in-session/119th-congress` | Calendar grid marking each day each chamber met; a day drills to that day's Congressional Record → daily digest → chamber section → page. | **Partial** | No page. Chain's last two hops (section, page) are a real data gap — see `REC-02`. | Three ways in, all on hand or cheap: (a) `congress_record_daily` issue dates, 1995→2026, with per-chamber presence derivable from `congress_record_articles.section` — for 2026 that yields 139 issues / 118 House days / 127 Senate days; (b) House legislative days from `CAL-05`'s `<legislative_day>`; (c) Senate days from `CAL-06`'s file list. Cross-check the three. | easy | **P0** |
| **CAL-08** | Bills This Week / weekly floor program — `docs.house.gov/floor/` | Majority Leader's weekly House floor program: bills under suspension, bills under a rule, with bill text PDFs and links to govinfo XML. | No | Whole thing. This is *floor* business; `CAL-02`/`CAL-03` are *committee* business. A calendar wants both. | `docs.house.gov/billsthisweek/{YYYYMMDD}/{YYYYMMDD}.xml` (confirmed; per-week, keyed on the Monday) plus an Atom feed at `docs.house.gov/BillsThisWeek-RSS.xml`. Carries `<category>`, `<floor-item>`, `<legis-num>`, `<floor-text>`, per-item publish history. | easy | P1 |
| **CAL-09** | Senate scheduled hearings feed — `senate.gov/general/committee_schedules/hearings.xml` | Currently-scheduled Senate committee meetings: `identifier` (= our `event_id`), `cmte_code`, committee, type, ISO date/time, room, `video_url`, `senate_cable_channel`, `matter`. | **Data** | Nothing material — congress.gov mirrors it. Useful as a **freshness tripwire**: it updates before congress.gov does. | Static XML, open, tiny (~1 KB when the Senate is out). | easy | P2 |
| **CAL-10** | Senate tentative legislative schedule — `senate.gov/legislative/{year}_schedule.xml` | Whole-year Senate session/recess calendar, published in advance: `approvedDate`, congress, session, and a `<dates>` list of non-legislative periods with `beginDate`/`endDate`/`action`/`note` ("State Work Period", holidays). | No | Whole thing. This is what makes a calendar say "Senate out until Sept 14" rather than showing an empty week. | **Correction to batch 1: it is XML, not HTML.** `2025_schedule.xml` and `2026_schedule.xml` both 200 `text/xml`. One file a year, a few KB. Archive of prior years at `/legislative/common/generic/past_legislative_schedules.htm`. | easy | **P1** |
| **CAL-11** | Senate Calendar of Business / Executive Calendar — `senate.gov/legislative/executive-calendars.htm` | Measures eligible for floor action; the Executive Calendar carries nominations and treaties with calendar numbers (`Executive Calendar #902`, cited daily by `CAL-04`). | No | Whole thing. Without it, Daily Press text mentions calendar numbers we cannot resolve. | govinfo `CCAL` — see `CMT-05`. | medium | P1 |

## CMT — Committees

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **CMT-01** | Committees of the U.S. Congress — `congress.gov/committees` | Roster of current and terminated committees and subcommittees, by chamber. | **Yes** | Terminated/historical committees: we hold 236 rows, all current. congress.gov covers ~1971→present. | `api.congress.gov/v3/committee` with no `currentStatus` filter. | easy | P2 |
| **CMT-02** | Committee profiles — `congress.gov/help/committee-profiles` | Per committee: legislation, publications, meetings, executive communications, and for Senate committees nominations, treaty documents and a Members tab. Coverage ~1971→present. | **Partial** | We hold every ingredient (`congress_bill_committees` 29,763; `congress_committee_reports` 929; `congress_committee_prints` 80; `congress_committee_communications` 207,163; `congress_committee_nominations` 44,397; `congress_committee_members` 3,895) but only for the 119th, and `/docs/committees/[id]` does not assemble them into a profile. | Already ingested; backfill earlier congresses from `api.congress.gov`. | medium | P1 |
| **CMT-03** | Senate committee list — `senate.gov/committees/index.htm` | Chair, ranking member, total members, full subcommittee list per committee. | **Data** | Nothing missing — `congress_committee_members.title`/`party`/`rank` already resolves chair and ranking member; we just do not render them. | Per-committee membership XML: `senate.gov/general/committee_membership/committee_memberships_{THOMAS_ID}.xml` (e.g. `..._SSAF.xml`, confirmed 200). Good cross-check. | easy | P2 |
| **CMT-04** | Senate site index — `senate.gov/about/research-tools/site-index.htm` | An A–Z of everything senate.gov publishes. Harvested; the finds are `CAL-06`, `CAL-10`, `CAL-11`, `CMT-05`, `SES-02`, `SES-03`, `SES-04`. | n/a | — | Reference only. | easy | P3 |
| **CMT-05** | LIS Calendar of Business lists — `lis.gov/crtext/lists.html#lcal` | Senate Calendar of Business and Executive Calendar as text lists. | No | Whole thing, **and the host is unreachable from here** (connection times out). | govinfo collection **`CCAL`** — "Congressional Calendars", 6,413 packages / 100,937 granules, covering both chambers' calendars. Needs a govinfo key. | medium | P1 |
| **CMT-06** | House Clerk committee data — `clerk.house.gov/Committees/ExcelCommitteeData`, `/committees/{code}` | House committee codes, jurisdictions, membership as a spreadsheet. | **Data** | Nothing material. | Direct download; also `clerk.house.gov/xml/lists/MemberData.xml` (557 KB) for the full House membership with committee assignments. | easy | P2 |

## REC — Congressional Record

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **REC-01** | Daily Record issue index — `congress.gov/congressional-record` | Volume / issue / date / section index. | **Yes** | Nothing. 5,862 issues, 1995 → 2026-09-04. | `api.congress.gov/v3/daily-congressional-record`. | — | — |
| **REC-02** | Section and page drill-down — `.../congressional-record/volume-172/issue-3/daily-digest`, `.../senate-section/page/S19-23` | **Full text** of the Record, one article per granule, with page numbers, section (House / Senate / Extensions / Daily Digest) and speaker. | **Partial** | The real gap. Our `congress_record_articles` holds 91,174 rows but they are **headings** (avg 239 chars) and only for 2023–2026 — 715 of 5,862 issues. No page-level addressing, no full text, nothing before 2023. | govinfo **`CREC`**: 6,014 packages, **911,932 granules**. `api.govinfo.gov/packages/CREC-{date}/granules` gives `granuleId` (which encodes the page: `CREC-2026-09-04-pt1-PgH5513-3`), `granuleClass` (`HOUSE`/`SENATE`/`EXTENSIONS`/`DAILYDIGEST`) and title; `/granules/{id}/htm` gives the text. Bulk zips under `govinfo.gov/bulkdata/CREC/`. | hard | P1 |
| **REC-03** | Daily Digest | Per-day summary of both chambers' business — the spine of a days-in-session page. | **Partial** | 4,603 Daily Digest headings held (2023→2026 only). | `CREC` granules with `granuleClass=DAILYDIGEST`, or the per-package `pdfDailyDigestLink`. | medium | P1 |
| **REC-04** | Congressional Record Index — govinfo `CRI` | 641,750 granules indexing the Record by person, subject and bill. | No | Whole thing. This is what makes "everything Senator X said about Y" answerable. | govinfo `CRI`. Needs a key. | hard | P2 |
| **REC-05** | Bound Congressional Record — govinfo `CRECB` | 484,978 granules; the permanent, repaginated edition. | No | Whole thing. Only matters for pre-1995 history. | govinfo `CRECB`. | hard | P3 |

## VID — Video

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **VID-01** | Per-meeting video (the find) | Video URLs attached to individual committee meetings — YouTube watch URLs for House, `senate.gov/isvp/?comm=...&filename=...` for Senate. | **Data** | Not surfaced anywhere. **2,292 of 2,681 meetings (85%) already carry a `payload->'videos'` array** with `url` + `name`. This is the single largest unused asset found in this pass. | Already ingested. | easy | **P0** |
| **VID-02** | House committee video index — `congress.gov/committees/video` | Thin index of House committees that have video. | **Data** | Nothing — `VID-01` is strictly richer (per meeting, not per committee). | n/a | easy | P3 |
| **VID-03** | Per-committee video feed — `congress.gov/index.php/committees/video/house-agriculture/hsag00` | A committee's hearing videos in reverse-chronological order. | **Partial** | We approximate this from YouTube uploads in `lib/policy/committee-video.ts` (31 of 34 full committees hand-mapped in `lib/data/congress/committee-youtube.json`). Grouping `VID-01` by `system_code` would beat it — no API key, no quota, and it covers subcommittees. | `VID-01`, grouped. | easy | P1 |
| **VID-04** | Senate ISVP live/archived feeds | Senate committee webcasts. | **Data** | ISVP URLs are in `VID-01` for Senate meetings but the player is a Senate-hosted Flash-descendant; embedding needs checking. | `senate.gov/isvp/`. | medium | P2 |

## HRG — Hearings

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **HRG-01** | Hearing transcripts — `congress.gov` hearings | Printed hearing transcripts with jacket numbers, committee, date, text and PDF. | **Partial** | 940 hearings, 119th only. | `api.congress.gov/v3/hearing`. | easy | P2 |
| **HRG-02** | govinfo `CHRG` | **46,847** hearing packages — the full historical set, roughly 50× what we hold. | No | Everything before the 119th. | govinfo `CHRG`. Needs a key. | hard | P2 |

## SES — Sessions of Congress

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **SES-01** | Dates of Sessions of Congress — `senate.gov/legislative/sessions_of_congress.htm` | Every congress and session, 1789 → present, with convene and adjourn dates. | **Partial** | `congress_congresses` (119 rows) carries session start/end for modern congresses via the API `sessions` field; senate.gov goes to 1789 and adds special sessions. | HTML table, stable, one-time parse. | easy | P2 |
| **SES-02** | Joint Sessions & Meetings — `senate.gov/legislative/JointSessionsMeetingsofCongress.htm` | Every joint session and joint meeting with date and occasion. | No | Whole thing. Small, high-interest reference. | HTML table. | easy | P2 |
| **SES-03** | Lame Duck Sessions — `senate.gov/legislative/LameDuckSessions.htm` | Lame-duck sessions 1940 → present. | No | Whole thing. | HTML table. | easy | P3 |
| **SES-04** | All-Night Sessions — `senate.gov/legislative/AllNightSessions.htm` | Senate all-night sessions, 1915 → present. | No | Whole thing. Colour, not spine. | HTML table. | easy | P3 |

## VOT — Votes (owned by the roll-call tranche; catalogued here so nobody re-discovers them)

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **VOT-01** | Senate roll calls — `senate.gov/legislative/LIS/roll_call_lists/vote_menu_{congress}_{session}.xml`, index at `senate.gov/legislative/votes_new.htm` | Every Senate roll call for a session: number, date, issue, question, result, yea/nay tally, title. Per-vote member positions at `/roll_call_votes/vote{C}{S}/vote_{C}_{S}_{NNNNN}.htm`. | ~~No~~ → **Data** | ~~We hold zero Senate roll calls.~~ **Closed 2026-09-08.** The sibling roll-call tranche landed `congress_senate_votes` (890: 659 in 119-1, 231 in 119-2) and `congress_senate_vote_positions` (88,988), with `lis_member_id`, `bioguide_id`, `people_id`, party, state and cast. Brendan's "we're missing them" was true when the brief was written and is not any more. Remaining gap is pre-119th. | senate.gov XML, open. | easy | ~~P0~~ **done** |
| **VOT-02** | House roll calls — `clerk.house.gov/Votes` | House roll calls and member positions. | **Data** | 657 votes / 284,025 positions, 119th only. | `api.congress.gov/v3/house-vote`, or Clerk `evs` XML for history. | easy | P1 |

## BULK — Cross-cutting bulk sources

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **BULK-01** | govinfo API — `api.govinfo.gov/collections` | 40+ collections. Relevant here: `CREC` (911,932 granules), `CRECB` (484,978), `CRI` (641,750), `CCAL` (100,937), `CHRG` (46,847 pkgs), `CPRT` (7,784), `CRPT`, `CDIR` (Congressional Directory, 15,024 granules), `BILLS` (290,351). | **Partial** | We use govinfo bulk zips for bill status and text. Everything else is untouched — **and we have no API key on file**. | `api.govinfo.gov` + `govinfo.gov/bulkdata/`. | — | **Blocker** |
| **BULK-02** | House Clerk member data — `clerk.house.gov/xml/lists/MemberData.xml` | Full House membership: names, districts, party, committee assignments, office data. 557 KB. | **Partial** | `congress_members` (555) + `house_offices`/`house_staff` cover most of it. Useful as a same-day-accurate cross-check on vacancies and party counts. | Static XML, open. | easy | P2 |
| **BULK-03** | House Clerk procedural feeds — `/DischargePetition`, `/ConsensusCalendarMotions`, `/Home/Feed` | Discharge petitions with signature counts; consensus-calendar motions; a site RSS. | No | Whole thing. Discharge petitions are genuinely hard to find elsewhere and are newsworthy. | HTML + RSS on clerk.house.gov. | medium | P2 |

---

# Batch 2 — 2026-09-08

## META — the catalogue that supersedes link-hunting

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **META-01** | Legislative Branch Innovation Hub — `usgpo.github.io/innovation/data` | **The Congressional Data Task Force's own DCAT catalogue of 119 congressional datasets**, each with title, description, publisher, update frequency, landing page and machine-readable DCAT record. Publishers span AOC, Census, CBO, CRS, GAO, GPO, LOC, House, Senate, OPM, OLRC and civil society. | No | Whole thing — **and it makes most future link batches unnecessary.** It already lists resources this inventory found the hard way (House Committee Repository, Clerk floor summary, Senate hearings XML, MemberData XML) plus a dozen nobody has mentioned yet. | **`raw.githubusercontent.com/usgpo/innovation/master/_data/data.json`** — 128 KB, 119 entries, plain JSON, no key, default branch is `master` not `main`. | easy | **P0** |

Ingesting META-01 is a ~2 hour job that turns "someone finds a link" into "diff
the catalogue." Recommend doing it before working through any further batches.
Runs anywhere; it is one HTTP GET.

## GPO — govinfo, in full

`api.govinfo.gov/collections` answers `DEMO_KEY` (≈30 req/hr) and returns **42
collections**. Full enumeration, since Brendan asked for it — package and granule
counts as of 2026-09-07, sorted by size:

| Code | Collection | Packages | Granules |
| --- | --- | --- | --- |
| `USCOURTS` | United States Courts Opinions | 2,165,580 | 4,622,624 |
| `BILLS` | Congressional Bills | 290,351 | — |
| `SERIALSET` | Congressional Serial Set | 233,921 | — |
| `BILLSTATUS` | Congressional Bill Status | 172,354 | — |
| `CRPT` | Congressional Reports | 162,715 | 588 |
| `GOVPUB` | Bulk Submission | 137,870 | 325 |
| `CDOC` | Congressional Documents | 82,385 | 10,068 |
| `CHRG` | Congressional Hearings | 46,847 | 353 |
| `FR` | **Federal Register** | 22,799 | 1,010,102 |
| `CPD` | Compilation of Presidential Documents | 18,522 | 23,012 |
| `GAOREPORTS` | GAO Reports & Comptroller General Decisions | 16,569 | — |
| `BILLSUM` | Congressional Bill Summaries | 9,247 | — |
| `CPRT` | Committee Prints | 7,784 | 1,852 |
| `CFR` | Code of Federal Regulations | 6,647 | 7,826,892 |
| `CCAL` | Congressional Calendars | 6,413 | 100,937 |
| `CREC` | Congressional Record | 6,014 | 911,932 |
| `PLAW` | Public and Private Laws | 5,999 | — |
| `CZIC` | Coastal Zone Information Center | 4,887 | — |
| `GPO` | Additional Government Publications | 4,346 | 80,562 |
| `ANNUALREP` | Annual Reports | 3,655 | 2 |
| `COMPS` | Statutes Compilations | 2,685 | — |
| `CRECB` | Congressional Record (Bound) | 2,420 | 484,978 |
| `PAI` | Privacy Act Issuances | 1,685 | — |
| `USCODE` | United States Code | 1,552 | 2,027,914 |
| `CMR` | Congressionally Mandated Reports | 1,175 | — |
| `USREPORTS` | United States Reports | 582 | 36,942 |
| `ERIC` | Education Reports from ERIC | 573 | — |
| `BUDGET` | United States Budget | 457 | 7,172 |
| `ECONI` | Economic Indicators | 375 | 17,996 |
| `LSA` | List of CFR Sections Affected | 359 | 18,606 |
| `CDIR` | Congressional Directory | 239 | 15,024 |
| `PPP` | Public Papers of the Presidents | 180 | 24,847 |
| `SJOURNAL` | Journal of the Senate | 178 | — |
| `HJOURNAL` | Journal of the House | 155 | 33,948 |
| `STATUTE` | Statutes at Large | 137 | 116,764 |
| `GOVMAN` | United States Government Manual | 98 | 5,370 |
| `ERP` | Economic Report of the President | 80 | 3,040 |
| `ECFR` | Electronic CFR | 49 | — |
| `CRI` | Congressional Record Index | 44 | 641,750 |
| `HOB` | **History of Bills** | 44 | 327,731 |
| `HMAN` | **House Rules and Manual** | 25 | 2,282 |
| `SMAN` | **Senate Manual** | 23 | 1,386 |

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **GPO-01** | `HOB` — History of Bills | 327,731 granules indexing every legislative action on a bill back through the Congressional Record. The historical spine under `congress_bill_actions`. | No | Everything before the 119th. Our `congress_bill_actions` is 71,239 rows, 119th only. | `govinfo.gov/bulkdata/HOB` + API. | medium | P1 |
| **GPO-02** | `HMAN` / `SMAN` — House Rules and Manual, Senate Manual | The chambers' governing rules in **USLM XML** — section-addressable, so a rule can be cited and linked the way a statute is. | No | Whole thing. This is what lets a page say *"under clause 13 of Rule I"* and link it — and the Clerk floor XML (`CAL-05`) cites rules constantly. | `govinfo.gov/bulkdata/HMAN` (25 pkgs, by congress) and `/SMAN`. Small. | easy | **P1** |
| **GPO-03** | `FR` — Federal Register | 1,010,102 granules. Rules, proposed rules, notices — the executive-branch half of "what did the law actually do." | No | Whole thing. | `govinfo.gov/bulkdata/FR`, plus `federalregister.gov`'s own free API. | hard | P2 |
| **GPO-04** | `CDIR` — Congressional Directory + Congressional Pictorial Directory | 15,024 granules of official member/staff/office data, and the Pictorial Directory is the official source of **member photographs**. | **Partial** | We hold `house_offices` (1,524) and `house_staff` (9,424) from directory.house.gov; no member photos of federal provenance. | `govinfo.gov/bulkdata/CDIR`; `govinfo.gov/collection/congressional-pictorial-directory`. | medium | P2 |
| **GPO-05** | `STATUTE`, `PLAW`, `COMPS`, `USCODE` | Statutes at Large (116,764 granules), public laws, statute compilations, the US Code (2,027,914 granules) in USLM XML. | **Partial** | `congress_laws` is 105 rows. | govinfo bulkdata; `uscode.house.gov/download` for the Code. | hard | P2 |
| **GPO-06** | `HJOURNAL` / `SJOURNAL` | Official chamber journals — the constitutional record of proceedings, distinct from the Congressional Record. | No | Whole thing. | govinfo. | medium | P3 |
| **GPO-07** | govinfo Link Service — `govinfo.gov/link-docs` | Deterministic URL construction for any govinfo resource, including "latest version of" — e.g. `govinfo.gov/link/cfr/3/100?sectionnum=1&year=mostrecent`, with `link-type` of pdf/xml/mods/premis/details/context/related. OpenAPI-documented. | No | We hand-build govinfo URLs. | `github.com/usgpo/link-service`. | easy | **P1** |
| **GPO-08** | govinfo sitemaps + RSS — `govinfo.gov/sitemaps`, `/feeds` | Crawlable indexes and per-collection feeds. The cheap way to know *what changed* without diffing bulk. | No | Whole thing. Directly useful to `watch_*` and the Clerk. | `github.com/usgpo/sitemap`, `github.com/usgpo/rss`. | easy | P1 |
| **GPO-09** | **govinfo MCP server** — `github.com/usgpo/api/blob/main/docs/mcp.md` | GPO ships an official MCP server over govinfo. | No | Whole thing — and it lands directly in the Clerk's tool belt rather than needing an ingest at all. | GPO. Needs a govinfo key. | easy | **P0** for the Clerk |
| **GPO-10** | USLM schema — `github.com/usgpo/uslm`, `xml.house.gov/schemas/uslm/1.0/` | The XML schema all of the above is marked up in, with a user guide. Bill DTDs at `github.com/usgpo/bill-dtd`. | **Partial** | We parse bill XML already; the schema is the reference for doing it properly. | GitHub. | easy | P3 |
| **GPO-11** | GPO cataloging records — `github.com/usgpo/cataloging-records*` | MARC/MARCXML records for the Catalog of U.S. Government Publications, including a Serial Set set. | No | Whole thing. Library metadata; only worth it if we do historical documents. | GitHub. | medium | P3 |

`GPO-01` … `GPO-06` all run on an AWS box: pull bulk zips to S3, unpack on an
EC2 spot instance or a Batch job in the Aurora region, load over the Data API or
a direct connection. None of it belongs on a laptop.

## MEM — members and identity

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **MEM-01** | Bioguide — `bioguide.congress.gov`, field values at `congress.gov/help/field-values/member-bioguide-ids` | Canonical member identifier, 1789 → present, with biography. | **Yes, for the current Congress** | `congress_members`: **555 rows, 555 distinct `bioguide_id`, zero null** — clean. Gap is historical members and the biographical narrative. | **`bioguide.congress.gov` is 403 to us, including `/search/bio/{id}.json`.** Use `api.congress.gov/v3/member` (keyed, works) or the community mirror in `MEM-03`. | easy | P2 |
| **MEM-02** | House Member data — `clerk.house.gov/xml/lists/MemberData.xml` (557 KB), `member-info.house.gov/members.xml`, `clerk.house.gov/Members/ExcelMemberData` | Full House membership with districts, party, committee assignments, office data. Same-day accurate on vacancies. | **Partial** | Duplicate of `BULK-02`; listed here so the member theme is complete. | Static XML, open. | easy | P2 |
| **MEM-03** | `unitedstates/congress-legislators` — `unitedstates.github.io/congress-legislators/legislators-current.json` | Community-maintained crosswalk: bioguide ↔ FEC ↔ ICPSR ↔ THOMAS ↔ GovTrack ↔ OpenSecrets CID, plus terms, parties, social accounts. Confirmed 200 JSON. | No | **This is the join table that makes `opensecrets-reconstruction.md` step 1 possible** — it is how a `congress_members.bioguide_id` reaches an FEC candidate id. | GitHub Pages, no key. Public domain / CC0. | easy | **P0** |
| **MEM-04** | Congressional district maps — `kml.house.gov`, Census TIGER shapefiles | District boundaries as KML/shapefiles, per congress. | No | Whole thing. Needed for any "find my representative" or district-level surface. | `kml.house.gov` (200); Census TIGER; `catalog.data.gov/dataset/congressional-districts5` for the 119th. | medium | P2 |
| **MEM-05** | Member photographs | Official headshots. | No | Whole thing. | `GPO-04` Pictorial Directory is the official federal source. Note `theunitedstates.io/images/congress/` — the usual community mirror — is **dead** (connection fails). | medium | P2 |

## DISC — disclosure feeds (the revolving door, and what offices spend)

Every one of these is a first-party House or Senate feed, all confirmed 200, and
none is currently ingested. They matter because the sibling lobbying tranche
wants a revolving-door count and a member money page.

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **DISC-01** | House post-employment lobbying — `disclosures-clerk.house.gov/PostEmploymentNotification` | Former House staff who have registered to lobby. **This is the revolving door, filed at source.** | No | Whole thing. Beats inferring it by name-matching `house_staff` against `LobbyingActivities`. | House Clerk. | medium | **P1** |
| **DISC-02** | House financial disclosures — `disclosures-clerk.house.gov/FinancialDisclosure` | Annual ZIPs of XML + PDF: assets, transactions, liabilities, positions, agreements. | No | Whole thing. Maps to OpenSecrets' 10 Personal Finances tables. | House Clerk, annual ZIPs. | medium | P1 |
| **DISC-03** | House foreign travel + gift/private-sponsor travel — `/ForeignTravel`, `/GiftTravelFilings` | Who paid for a member's or staffer's travel, and why. | No | Whole thing. | House Clerk. | medium | P2 |
| **DISC-04** | House Statement of Disbursements | Quarterly, itemised spending of every member office and committee — salaries, vendors, rent. | No | Whole thing. Reliably newsworthy and rarely surfaced well. | `house.gov/the-house-explained/open-government/statement-of-disbursements`. | medium | P2 |
| **DISC-05** | Senate financial disclosures — `efdsearch.senate.gov` | Senate equivalent of `DISC-02`. | No | Whole thing. | **Hard**: session-cookie search and many filings are scans, not text. Do the House first and say so on the page. | hard | P3 |
| **DISC-06** | Senate gift-rule / private-sponsor travel — `giftrule-disclosure.senate.gov` | Senate travel filings. | No | Whole thing. | senate.gov. | medium | P3 |
| **DISC-07** | House unsolicited mass communications — `masscommsdisclosure.house.gov` | Franked mass-mail and digital communications by member offices. | No | Whole thing. Niche but genuinely unavailable elsewhere. | House. | medium | P3 |

## NOM — Senate nominations

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **NOM-01** | Senate nomination status feeds | **Nine separate XML feeds**, one per status: `NomCivilianConfirmed`, `NomCivilianPendingCalendar`, `NomCivilianPendingCommittee`, `NomNonCivilianConfirmed`, `NomNonCivilianPendingCalendar`, `NomNonCivilianPendingCommittee`, `NomFailedOrReturned`, `NomPrivileged`, `NomWithdrawn` — all under `senate.gov/legislative/LIS/nominations/`. Confirmed 200 `text/xml`. | **Partial** | We hold `congress_nominations` (2,076), `congress_nomination_actions` (13,177), `congress_nomination_committees` (2,087), `congress_nomination_hearings` (195) from congress.gov. What these feeds add is **live status partitioning** — pending-on-calendar vs pending-in-committee vs privileged — which is what a nominations tracker actually needs, and it updates before congress.gov does. | senate.gov XML, open, small. | easy | **P1** |

## IND — Indiana (first-party jurisdiction effort)

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **IND-01** | MyIGA API — `api.iga.in.gov`, docs at `docs.api.iga.in.gov` | Indiana's first-party legislative API — the source `iga.in.gov` itself calls. | No | Whole thing. Today Indiana reaches us through LegiScan, which the first-party policy demotes to a supplement. | **Needs a free token**: request at `apitoken.request@iga.in.gov`; auth is `x-api-key` plus `User-Agent: iga-api-client-<token>`. Verified: keyless calls return a clean `403 {"description":"Invalid API key"…}` with a pointer to the docs, so the API is live and the only blocker is the token. | easy **once we have a token** | **P1** |
| **IND-02** | Legislator headshots — `iga.in.gov/images/legislators/{congress}/{year}/{chamber}/legislator_{name}_{n}.jpg` | Official Indiana legislator photographs. | No | Whole thing. | **Correction to the batch brief: these ARE fetchable.** With a browser User-Agent the URL returns **200, 193,494 bytes, a real 600×900 JPEG**; without one it returns the site's 691-byte SPA shell. No headless browser needed — just set a UA. | easy | P2 |
| **IND-03** | Legislator index page — `iga.in.gov/legislative/2026/legislators` | The list that maps a legislator to their photo filename. | No | The names in `IND-02`'s path have to come from somewhere. | **This one really is a React SPA** — 691 bytes to `curl` even with a UA. Get the roster from `IND-01` instead of rendering the page; only fall back to a headless render (on an AWS box, never here) if MyIGA turns out not to expose member metadata. Resolve this by asking MyIGA for the token first — it is a free email away and it moots the question. | — | **blocked on IND-01** |

## SPEND — money and spending

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **SPEND-01** | USAspending REST API — `api.usaspending.gov` | Every federal award — contracts, grants, loans, direct payments — plus agency budget accounts, obligations and outlays. Confirmed live and **unauthenticated** (`/api/v2/references/toptier_agencies/` returns immediately). | **Partial** | `Contracts` (97,804) and `contracts` exist but are a narrow slice. | REST API, no key. | easy | **P1** |
| **SPEND-02** | USAspending full PostgreSQL archive — `onevoicecrm.my.site.com/usaspending/s/database-download` | The complete database behind USAspending, DATA Act FY2001 → present, `pg_dump --format=directory`. | No | Whole thing — **and it is enormous.** Their own setup guide, revised **April 2026**: **>160 GB** for the ZIP, **>170 GB** unzipped, **>2.5 TB** for the restored database with materialized views. PostgreSQL 16, several `contrib` extensions, "many hours" to restore, regenerated monthly. | Note the historical **RDS-snapshot route was deprecated in April 2019** — there is no shared snapshot to restore any more, only the archive. | **hard, and expensive** | P2 |
| **SPEND-03** | USAspending Award Data Archive + Custom Account Data | Pre-generated per-agency, per-fiscal-year CSV ZIPs, and custom account extracts. | No | Whole thing. | `usaspending.gov/download_center/award_data_archive`. | easy | **P1** |
| **SPEND-04** | CBO budget and economic data — `cbo.gov/data/budget-economic-data`, `cbo.gov/publication/55681` | Baseline projections, long-term outlook, historical budget data, cost estimates. | **Partial** | `congress_cbo_estimates` (1,125) holds cost estimates linked to bills; the macro datasets are absent. | **`cbo.gov` returns 403 to `curl`** — only Exa's cache reads it, and that returned navigation rather than the file table, so **the dataset list and formats are unverified**. Better door: the **`US-CBO` GitHub organisation, 33 public repos** including `cbo-data`, plus published models. | medium | P2 |
| **SPEND-05** | SAM.gov — `api.sam.gov` | Federal entity registrations, exclusions, contract opportunities. The entity master that award data joins to. | No | Whole thing. | **Needs a real `api.data.gov` key** — `DEMO_KEY` returns 404 on both the entity and opportunities endpoints. | medium | P2 |
| **SPEND-06** | Appropriations Status Table — `crsreports.congress.gov/AppropriationsStatusTable` | Where each of the twelve annual appropriations bills stands. | No | Whole thing. Would make `congress.gov/help/appropriations-and-budget` actionable rather than explanatory. | **403 to us** (LOC). Rebuild from `congress_bills` + `congress_bill_actions` filtered to appropriations measures — we hold the inputs. | medium | P2 |
| **SPEND-07** | GAO — `gao.gov`, `innovations.gao.gov`, govinfo `GAOREPORTS` | Audit reports, legal opinions, bid protests, appropriations-law decisions. | No | Whole thing. | **`innovations.gao.gov` is a project showcase, not a dataset** — Innovation Lab write-ups (Legislative Mandates detector, Identity Verification Simulator, Single Audits). The actual data is govinfo `GAOREPORTS` (16,569 packages) and gao.gov's own search endpoints. | medium | P2 for `GAOREPORTS`, **P3** for innovations.gao.gov |

## CGOV — congress.gov surfaces, answered

Every row here is a page Brendan asked whether we cover. All are 403 to fetch;
all have to be rebuilt from data, and in most cases the data is already ours.

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **CGOV-01** | Hearing transcripts — `/house-hearing-transcripts/119th-congress`, `/senate-…`, `/joint-…` | Printed hearing transcripts by chamber. | **Data** | Chamber-split index pages do not exist on our side. We hold 940 hearings — **House 586, Senate 330, NoChamber 24** — with 934 texts, but **119th only**. Historical gap is `HRG-02` / govinfo `CHRG` (46,847). | Already ingested. | easy (pages) / hard (backfill) | P2 |
| **CGOV-02** | Bill texts received today — `/bill-texts-received-today` | Bill text versions published in the last day. | **Data** | Page does not exist. `congress_text_formats` (21,527) carries `version_date`, `version_type`, `html_url`, `pdf_url`, `xml_url` — a "today" view is a `where version_date = current_date` away. | Already ingested. | easy | P2 |
| **CGOV-03** | Presented to the President — `/presented-to-the-president` | Measures sent to the White House and awaiting signature. | **Data** | Page does not exist. Derivable: `congress_bill_actions` action codes **`28000`** and **`E20000`**, 112 rows each. | Already ingested. | easy | P2 |
| **CGOV-04** | State legislature websites — `/state-legislature-websites` | Official site for every state legislature. | No | Whole thing — and it is the seed list for the all-states first-party effort, the same role `IND-01` plays for Indiana. | 403 to fetch; rebuild from NCSL's equivalent list or read once via Exa cache. Small, static. | easy | **P1** |
| **CGOV-05** | Search filter URL params — e.g. `/search?q={"congress":119,"chamber":"House","type":"resolutions"}` | congress.gov encodes its whole filter state as a JSON `q` parameter. | n/a | Reference for our own search, not data. Worth copying: it makes any filtered view linkable and shareable. | Reference. | easy | P3 |
| **CGOV-06** | Appropriations & budget help — `/help/appropriations-and-budget` | Explains the appropriations process and where its documents live. | n/a | Reference. The actionable version is `SPEND-06`. | Reference. | easy | P3 |
| **CGOV-07** | House help menu — `/help/house-of-representatives` | Index of House-specific congress.gov features. | n/a | Reference. | Reference. | easy | P3 |

## REF — reference and how-to (cheap wins, no ingest)

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **REF-01** | Legislative glossary — `congress.gov/help/legislative-glossary` | Definitions of procedural terms. | No | We use terms like "cloture", "suspension of the rules", "pro forma" across the app with no definition anywhere. A glossary + hover definitions is a genuinely cheap improvement. | 403; a few hundred terms, read once via Exa cache and store as a JSON file beside `lib/data/`. | easy | P2 |
| **REF-02** | Linking to congress.gov — `/help/linking-to-congress-gov` | Stable URL patterns for congress.gov resources. | No | We construct congress.gov links by hand. Pairs with `GPO-07`. | Reference. | easy | P3 |
| **REF-03** | Citation guide — `/help/citation-guide` | How to cite congressional documents. | No | Would make the Clerk's citations conform to a published standard. | Reference. | easy | P3 |
| **REF-04** | Library of Congress research guides — `guides.loc.gov`, A–Z at `guides.loc.gov/az.php` | **Triaged, and mostly not what it looks like.** `az.php` is the A–Z list of *licensed subscription databases* (HeinOnline, vLex, CNKI, Integrum) — reading-room resources, not ingestible and mostly not public. The research guides proper are **1,987 pages** enumerated in `guides.loc.gov/sitemap.xml`; the overwhelming majority are Chronicling America topic guides and 50 state guides, i.e. curated reading lists. | No | **Reference-only, with one exception:** the `chronicling-america` family points at digitised newspapers 1690–1963 with OCR text. Also of passing use: the 50 `*-state-guide` pages as a starting bibliography for the all-states effort. | `guides.loc.gov/sitemap.xml` is open (1,989 URLs). **But `www.loc.gov` itself is 403 to us, including its `?fo=json` API** — so Chronicling America would need a route around LOC's bot gate before it is buildable. | — | **P3** — inventoried, not recommended |

## LOB — lobbying reference

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **LOB-01** | OpenSecrets bill-lobbying page — `opensecrets.org/federal-lobbying/bills/hr1/lobbyists?bill_id=hr1-119` | Clients and firms lobbying a named bill. | **Data** | **Reference layout only** — we already hold the underlying federal LDA set (562,061 `LobbyingBills` rows). See the sibling lobbying tranche. | n/a — and note opensecrets.org is CC BY-NC-SA, so this is a design reference, not a data source. See `opensecrets-reconstruction.md`. | — | P3 |
| **LOB-02** | Community OpenSecrets API wrappers — `github.com/jvpoulos/opensecrets-API`, `github.com/kartikye/opensecrets_api`, `github.com/opensecrets` | Client libraries for the now-dead OpenSecrets API. | No | Nothing to gain as clients — **the API was discontinued 2025-04-15.** Residual value is as documentation: their method signatures enumerate what the API used to expose, which is a second witness on the schema in `opensecrets-reconstruction.md`. | GitHub. | easy | P3 |
| **LOB-03** | House / Senate lobbying disclosure portals — `lobbyingdisclosure.house.gov`, `lda.senate.gov/system/public/` | The LDA filings themselves. | **Yes** | Already ingested: 357,379 filings, 2023–2026. | Senate LDA API. | — | — |

---

## Ranked build list

Sized in engineer-days against one engineer who already knows this codebase.

### Tranche 1 — "The week ahead" (≈3 days, no new ingest)

Everything here is `congress_committee_meetings` rendered properly. Nothing to
fetch, nothing to schedule, nothing to backfill.

1. **Extract the payload we already hold** (~0.5 d). `witnesses`,
   `witnessDocuments`, `meetingDocuments`, `relatedItems.bills`, `videos` are
   sitting in `payload` jsonb and no query reads them. Add generated columns or
   a view; the two calendar queries in `lib/policy/db-queries.ts` currently
   select six fields out of sixteen.
2. **`/calendar` gets the committee agenda** (~1 d) — `CAL-02`, `CAL-03`. Each
   event expands to witnesses, documents and the bills to be considered, the way
   docs.house.gov and the congress.gov weekly schedule show it.
3. **`/docs/committee-schedule/weekly/[year]/[month]/[day]`** (~1 d) — `CAL-02`.
   The congress.gov weekly page, rebuilt from our own rows, laid out like
   `/docs/datasets`. Day-by-day, both chambers, witnesses inline.
4. **Video on the meeting** (~0.5 d) — `VID-01`. 2,292 meetings have a video URL
   nobody has ever rendered. Put it on `/docs/meetings/[id]`, and group by
   committee to give `/docs/committees/[id]` a real video list that does not
   need `YOUTUBE_API_KEY` (`VID-03`).

**Why first:** highest value per unit of risk in the whole document. No new
dependency, no new key, no new cron, and it closes the thing Brendan pointed at.

### Tranche 2 — "Days in session" (≈2 days, no new ingest)

5. **`/docs/days-in-session/[congress]`** (~1.5 d) — `CAL-07`. Calendar grid,
   1995 → present, per chamber, derived from `congress_record_daily` +
   `congress_record_articles.section`. Each day links to its Record issue.
6. **Validate the derivation** (~0.5 d). Cross-check 2026 (139 issues / 118 House
   / 127 Senate) against the House Clerk's `<legislative_day>` list from
   `CAL-05` and the Senate floor-activity file list from `CAL-06`. Three
   independent sources agreeing is the whole point; if they disagree, the
   Clerk and Senate files win and the Record becomes the fallback.

### Tranche 3 — "Floor feed" (≈4 days, three small ingests)

7. **House floor proceedings** (~1.5 d) — `CAL-05`. Parse
   `HDoc-{congress}-{session}-FloorProceedings.xml` for backfill (115th →
   present, ~3 MB/session) and `{YYYYMMDD}.xml` for the daily tick. New table
   `house_floor_actions`; the 67 `act-id` codes are a taxonomy worth keeping and
   cross-walk directly to the action-taxonomy audit in the sibling tranche.
8. **Senate floor proceedings** (~1.5 d) — `CAL-06`. 2,251 day-files, 2014 →
   present. New table `senate_floor_actions`.
9. **Senate Daily Press** (~1 d) — `CAL-04`. 1,828 WordPress posts, 2016 →
   present, ~19 paged requests. This is the readable narrative that makes the
   structured floor actions legible: *"cloture on H.R.3633 ripens Tuesday at 2:15."*

Then `/docs/floor` — a two-chamber, day-by-day floor summary — falls out of 7–9
almost for free.

### Tranche 4 — "Congressional Record, for real" (≈2 weeks, blocked on a key)

10. **govinfo `CREC` ingest** — `REC-02`, `REC-03`. 911,932 granules. Page-level
    addressing, full text, 1994 → present. This is the one genuinely large job
    in the document and the one that unlocks the drill-down chain Brendan
    walked. **Blocked until we have a `GOVINFO_API_KEY`.**
11. **Calendars of Business** — `CMT-05`, `CAL-11`, via govinfo `CCAL`. Same
    blocker, much smaller job.

### Tranche 0 — "Stop hunting links" (≈half a day, added by batch 2)

Jumps the queue because it is cheap and it changes how every later batch is
handled.

0a. **Ingest the CDTF catalogue** (~2 h) — `META-01`. One GET of a 128 KB DCAT
    JSON gives 119 curated congressional datasets with publisher and update
    frequency. From then on, "here are some links" becomes "diff the catalogue."
0b. **Pull `congress-legislators`** (~2 h) — `MEM-03`. The bioguide ↔ FEC ↔ ICPSR
    ↔ OpenSecrets-CID crosswalk. Small, CC0, and it is the prerequisite for
    step 1 of `opensecrets-reconstruction.md`.
0c. **Point the Clerk at GPO's MCP server** (~2 h) — `GPO-09`. Tool wiring, not
    an ingest. Blocked with everything else on the govinfo key.

Runs anywhere — three HTTP GETs and a tool registration.

### Standing backlog (catalogued, not scheduled)

`CMT-02` committee-profile assembly · `CAL-08` Bills This Week · `HRG-02`
historical hearings · `REC-04` Record index · `BULK-03` discharge petitions ·
`SES-02`/`SES-03`/`SES-04` session-history tables · `GPO-01` History of Bills ·
`GPO-02` House/Senate manuals · `GPO-07` link service · `GPO-08` sitemaps and
feeds · `NOM-01` Senate nomination status · `DISC-01` post-employment lobbying ·
`DISC-02` House financial disclosures · `SPEND-01`/`SPEND-03` USAspending ·
`CGOV-02`/`CGOV-03`/`CGOV-04` · `REF-01` glossary.

### Where each ingest runs, and roughly what it costs

Nothing below runs on the laptop. Sizes are the ones actually verified.

| Work | Where | Rough cost |
| --- | --- | --- |
| `META-01`, `MEM-03`, `NOM-01`, `CAL-09`, `CAL-10`, `GPO-02` | Anywhere — a few HTTP GETs of files under a megabyte | negligible |
| `CAL-04`/`CAL-05`/`CAL-06` floor feeds | Small scheduled job (Amplify cron or a Lambda) in the Aurora region. Largest single file is 4.6 MB; the Senate backfill is 2,251 files | negligible; minutes of compute |
| `REC-02` govinfo `CREC` (911,932 granules) | EC2 or AWS Batch in-region: pull bulk zips → S3, unpack, load. Not the Data API — use a direct connection for a load this size | hours of spot compute, tens of GB of S3 |
| `GPO-01`/`GPO-04`/`GPO-05` govinfo bulk | Same pattern as above | same order |
| `SPEND-02` USAspending full archive | **Only** on AWS, and size it before committing: >160 GB download, >2.5 TB restored. That is roughly **$290/month in gp3 storage alone** before any instance, for a monthly-refreshed snapshot | expensive — prefer `SPEND-01`/`SPEND-03` |
| `IND-03` headless render | Only if MyIGA has no member metadata, and only on an AWS box. Ask for the token first — it very likely removes the need | avoid |

---

## Standouts Brendan flagged, answered

| He asked for | Verdict |
| --- | --- |
| A calendar built on the House Committee calendar + congress.gov weekly committee schedule | **Build it now, no ingest.** We hold 32 House events for the week docs.house.gov shows 31, keyed on the same `EventID`, with witnesses and documents already in the payload. This is a rendering job, not a data job. |
| A days-in-session page | **Build it now, no ingest** — derivable from `congress_record_daily` back to 1995. Validate against two independent chamber sources before shipping. |
| A floor-summary feed | **New ingest, but a small and clean one.** Three open XML/JSON feeds, no keys, no scraping, archives back to 2014 (Senate), 2017 (House) and 2016 (Daily Press). |

---

## Open questions for Brendan

1. **govinfo key** — the brief says we have one; `apps/web/.env.local` does not.
   Where does it live? It blocks `REC-02`, `REC-04`, `CMT-05`, `HRG-02`.
2. **`YOUTUBE_API_KEY`** — same question, and `VID-03` may make it unnecessary.
3. **Follow the Money key** — `FOLLOWTHEMONEY_API_KEY` exists in
   `~/Code/livingston/.env.local`, not in govblock. Per the brief I have not
   copied it. Say the word and Part B's schema probe runs against the live API
   instead of documentation. See `opensecrets-reconstruction.md`.
4. **MyIGA token** (batch 2) — free, from `apitoken.request@iga.in.gov`. It
   unblocks `IND-01` and probably moots the headless-render question in `IND-03`.
   Someone has to send the email.
5. **`api.data.gov` key** (batch 2) — needed for SAM.gov (`SPEND-05`); `DEMO_KEY`
   404s. The same key also lifts the govinfo `DEMO_KEY` rate limit.

---

## Pending / to-triage

Links that arrived before they were slotted. Move them up into a theme table
with a real ID once checked; delete nothing, so the trail stays readable.

- _batch 1, 2026-09-07 — fully triaged._
- _batch 2, 2026-09-08 — fully triaged into `META`, `GPO`, `MEM`, `DISC`, `NOM`,
  `IND`, `SPEND`, `CGOV`, `REF`, `LOB`; two batch-1 rows corrected (`VOT-01`
  closed, `CAL-10` upgraded to XML)._
- _Nothing awaiting triage. More batches expected._

### Not verified, and honest about it

- **`SPEND-04` CBO** — `cbo.gov` 403s and its cached copy returned navigation
  rather than the dataset table, so the datasets and formats there are
  **unsized**. The `US-CBO` GitHub org (33 repos) is a confirmed alternative
  door but is models and code, not the budget baselines. Needs a second look.
- **`CAL-11` / `CMT-05` Calendars of Business** — inferred to live in govinfo
  `CCAL` (6,413 packages / 100,937 granules) from the collection listing and
  senate.gov's own pointer. The mapping from a Senate Executive Calendar number
  to a `CCAL` granule is **not yet confirmed**.
- **`REF-04` Chronicling America** — the guides are real and enumerable, but
  `www.loc.gov`'s JSON API is 403 to us, so no route to the data has been proven.
- **`calendar.house.gov` (HouseCal)** — listed in the CDTF catalogue, but the
  connection fails from here. Probably internal to the House network.
