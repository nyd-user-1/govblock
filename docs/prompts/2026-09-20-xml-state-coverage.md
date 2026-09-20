# Brief: every state's newest bills print from XML

Written 2026-09-20 by the lead session for a fresh window. Brendan launches it; questions route back through the lead, in this file's "Rulings" section at the foot.

## Why

Every bill text block on the site (the changelog's, the bill page's) prints from the stored USLM XML when that printing reads cleanly, and falls back to the state's stored plain text when it does not (`apps/web/lib/typeset/printed-text.ts`: `printedTexts`, `codeBlockTexts`, guarded by `looksCaptured` and `printedLooksParsed`). The fallback is why blocks look different from state to state: run-on lines, a legislature's site menu captured in place of the bill, numbered lines that hold whole paragraphs. Brendan wants one standard: every jurisdiction's blocks from XML.

## Where it stands (measured 2026-09-20, newest 6 bills per jurisdiction, 308 bills)

Run it again any time, dev server up: `cd apps/web && node scripts/xml/print-coverage.mjs 6`

| | Jurisdictions |
|---|---|
| All XML (17) | US CO IN KY LA MI MN NE NH NM NC OH PA RI TX UT VT |
| Mixed (15) | CA 5/6 · DE 4/6 · GA 5/6 · ID 2/6 · IL 3/6 · KS 3/6 · ME 1/6 · MD 4/6 · MA 3/6 · OK 3/6 · OR 1/6 · SC 5/6 · TN 2/6 · VA 5/6 · WY 1/6 |
| No XML, stored text only (17) | AL AK AZ AR CT DC FL HI IA MS MO NV NJ ND SD WA WI |
| Nothing to print (3) | MT NY WV |

Totals: 149 from XML, 141 from stored text, 18 with nothing.

The corpus was compiled for every state on 2026-09-14 (`apps/web/docs/xml/lead.md`: 2,865,305 state bill printings), so "no XML" on the newest bills has more than one possible cause. Do not assume the grammar is at fault.

## Where bill text comes from (settled; do not reopen)

Every jurisdiction's bill text is fetched from that legislature's own source. LegiScan supplies the index of bills and the link to the state's own document (`state_link`); it never supplies the text. The loaders live in the **livingston** repo (`~/Code/livingston`), not here, and run on the 44b worker box (`i-030d9cac100e6e124`, t4g.large, us-east-1c) from `ops/box/jobs.d/`:

- `lv-text-walk` (nightly): walks the 47 legislature websites that will answer, four hours a night, through `state_link` (`scripts/box/text-backfill.mjs`).
- `lv-text-delta` (nightly): the text of whatever moved in the last seven days (`api/bill-text.ts mode=delta`).
- Native feeds where a site refuses the walker: California `pubinfo` zips, Texas FTP, Massachusetts API, Ohio API (livingston `prompts/2026-08-29-native-text.md`), Virginia's LIS API, New York's Senate API (`lv-bills-sync`), Congress from GovInfo.
- This repo's `scripts/xml/nightly.mjs` then compiles whatever landed in `"BillTexts"` since its last run, per state (`ops/xml/lv-xml-nightly.json`).

**Why nothing new has arrived (found 2026-09-20):** the box is woken each night by the EventBridge Scheduler schedule `44b-wake-nightly` (07:15 UTC). That schedule is **DISABLED**, as is `livingston-worker-2-wake-nightly`. The box last started 2026-09-03 07:15 UTC and stopped itself two minutes later; the last text written is 2026-08-30/31. Re-enabling the schedule is Brendan's call, not the window's: ask through the lead.

## The job

For each jurisdiction that is not All XML, find which of these is true, fix it, and re-measure:

1. **No expression stored for the bill.** The bill is newer than the last compile, or its text was never fetched (the worker box has not run since 2026-09-03, above). Check `expressions` / `xml_library` for the bill's work address, and `"Bills".text_fetched_at`. Known on 2026-09-20: the nightly text fetch last ran 2026-08-30/31 for NY, MA, OH, TX and US (CA on 09-14), so bills acted on since have no text at all. NY, MT and WV showing "nothing" is this, or a captured page (West Virginia's stored text opens with the legislature's site menu: "skip navigation / SENATE / PRESIDENT…").
2. **An expression is stored but its print is rejected.** `printedLooksParsed` or `looksCaptured` said no, which means the state's grammar misread the printing. Fix the grammar (`scripts/xml/`, the state notes in `apps/web/docs/xml/grammars/*.md`), rebuild that state, confirm the print.
3. **The stored text is a captured web page or an error page,** so there is nothing to compile from. That is a re-fetch from the state's own source, through livingston's loaders (a native feed where one exists, the `state_link` walker otherwise). Virginia's re-fetch (`scripts/xml/va-refetch.mjs`) is the model.

Work the No XML group first (17 states, zero coverage), then Nothing, then Mixed from the lowest ratio up.

## Steps

1. Read `apps/web/docs/xml/lead.md`, `schema.md`, `sources.md`, and the grammar note for the first state you take. Read `scripts/xml/run.mjs`, `nightly.mjs`, `worker.mjs` and `scripts/xml/coverage.mjs` (the pipeline's own coverage; different from the print coverage above).
2. Classify all 35 jurisdictions into causes 1, 2, 3 with one query-backed line each. Write the table into this file under "Findings" before fixing anything, and stop for a ruling if cause 1 dominates: that is a scheduling problem (the nightly step is not running), not a grammar problem, and the fix is one job, not 35.
3. Fix state by state. After each: rebuild, run `print-coverage.mjs`, record the before and after here.
4. Finish with the table re-measured at 12 bills per jurisdiction.

## Rules

- The pipeline box is `govblock-xml-direct` (stopped, not terminated; `aws ec2 start-instances`, new IP each start; clone at `~/govblock-xml`, tools at `~/xml-tools`). Long compiles run there, never on the Mac or the dev box. Stop it when done.
- Aurora pauses after five idle minutes: the first statement after a pause fails with `DatabaseResumingException`. Wait and retry; it is not an outage.
- One command at a time. No subagents. No background watchers.
- No whole-project type checks or builds on the Mac (hooks block them). Check changed files with a bounded `ts.createProgram` script under a 2 GB cap.
- No DDL without asking. Data writes that a loader would make are fine; one-off UPDATEs on production rows are a ruling.
- Commit on the working branch; never push. Brendan pushes.
- Do not touch `apps/web/app` or `apps/web/components`. The printing code in `apps/web/lib/typeset` and `apps/web/lib/policy/printed-bill-text.ts` is in scope only where a guard is wrong.
- Reports are short: what changed, the number before and after, what is blocked.

## Findings

(the window fills this in at step 2)

## Rulings

(the lead writes here)
