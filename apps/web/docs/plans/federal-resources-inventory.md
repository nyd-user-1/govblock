# Federal resources inventory

A living map of federal congressional data sources: what each one offers, whether
we already hold the equivalent, the gap, the upstream machine-readable source,
and what it would cost to ingest.

**This document is append-only by design.** Links arrive in batches. New rows go
into the theme table they belong to, keeping the ID sequence going; links that
arrive before anyone has slotted them go into [Pending / to-triage](#pending--to-triage)
at the bottom and get promoted later. Do not renumber existing IDs — other docs
and commits cite them.

Every fetchability claim below was checked from this machine on **2026-09-07**.

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

- **congress.gov HTML is closed to us.** Plain `curl` with a browser UA returns
  403, as does Tavily extract and Exa livecrawl; only Exa's *cached* index
  returns text. So congress.gov is usable as an **API** (`api.congress.gov`, key
  in `apps/web/.env.local`) and as a *reference* for page design, never as a
  scrape target. Every congress.gov page below therefore has to be rebuilt from
  its own upstream, not mirrored.
- **house.gov and senate.gov are wide open.** `docs.house.gov`, `clerk.house.gov`,
  `www.senate.gov` and `www.dailypress.senate.gov` all serve to plain `curl`,
  with real XML/JSON endpoints behind the HTML.
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
| **CAL-10** | Senate tentative legislative schedule — `senate.gov/legislative/2025_schedule.htm`, archive at `/legislative/common/generic/past_legislative_schedules.htm` | Whole-year Senate session/recess calendar, published in advance. | No | Whole thing. This is what makes a calendar say "Senate out until Sept 14" rather than showing an empty week. | HTML only; annual, so a hand-parse once a year is defensible. | easy | P2 |
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
| **VOT-01** | Senate roll calls — `senate.gov/legislative/LIS/roll_call_lists/vote_menu_{congress}_{session}.xml` | Every Senate roll call for a session: number, date, issue, question, result, yea/nay tally, title. Confirmed 200, 153 KB for 119-2 (231 votes). Per-vote member positions at `/roll_call_votes/vote{C}{S}/vote_{C}_{S}_{NNNNN}.htm`. | **No** | We hold **zero** Senate roll calls. | senate.gov XML, open. | easy | **P0** (that tranche) |
| **VOT-02** | House roll calls — `clerk.house.gov/Votes` | House roll calls and member positions. | **Data** | 657 votes / 284,025 positions, 119th only. | `api.congress.gov/v3/house-vote`, or Clerk `evs` XML for history. | easy | P1 |

## BULK — Cross-cutting bulk sources

| ID | Resource | What it provides | Have it? | Gap | Upstream | Feas. | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **BULK-01** | govinfo API — `api.govinfo.gov/collections` | 40+ collections. Relevant here: `CREC` (911,932 granules), `CRECB` (484,978), `CRI` (641,750), `CCAL` (100,937), `CHRG` (46,847 pkgs), `CPRT` (7,784), `CRPT`, `CDIR` (Congressional Directory, 15,024 granules), `BILLS` (290,351). | **Partial** | We use govinfo bulk zips for bill status and text. Everything else is untouched — **and we have no API key on file**. | `api.govinfo.gov` + `govinfo.gov/bulkdata/`. | — | **Blocker** |
| **BULK-02** | House Clerk member data — `clerk.house.gov/xml/lists/MemberData.xml` | Full House membership: names, districts, party, committee assignments, office data. 557 KB. | **Partial** | `congress_members` (555) + `house_offices`/`house_staff` cover most of it. Useful as a same-day-accurate cross-check on vacancies and party counts. | Static XML, open. | easy | P2 |
| **BULK-03** | House Clerk procedural feeds — `/DischargePetition`, `/ConsensusCalendarMotions`, `/Home/Feed` | Discharge petitions with signature counts; consensus-calendar motions; a site RSS. | No | Whole thing. Discharge petitions are genuinely hard to find elsewhere and are newsworthy. | HTML + RSS on clerk.house.gov. | medium | P2 |

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

### Standing backlog (catalogued, not scheduled)

`CMT-02` committee-profile assembly · `CAL-08` Bills This Week · `HRG-02`
historical hearings · `REC-04` Record index · `BULK-03` discharge petitions ·
`SES-02`/`SES-03`/`SES-04` session-history tables.

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

---

## Pending / to-triage

Links that arrived before they were slotted. Move them up into a theme table
with a real ID once checked; delete nothing, so the trail stays readable.

_(empty — batch 1 fully triaged 2026-09-07)_
