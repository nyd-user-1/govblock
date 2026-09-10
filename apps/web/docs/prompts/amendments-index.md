# Kickoff: the Amendments index

You are working in `/Users/brendanstanton/Code/govblock` on `main` (Next.js 16 at `apps/web`, pnpm workspaces, `@govblock/ui` at `packages/ui`). Read `CLAUDE.md` and the memory index first, especially `route-shape`, `no-local-builds`, `bounded-typecheck` and `amplify-deploys`.

Another session is working in this repo at the same time. Commit only what you write. Do not revert, rename or reformat anything you did not touch.

## Rules that are not negotiable

**Copy, do not hand-roll.** This page must be the Bills page with the nouns changed. Start by reading `apps/web/app/(records)/bills/page.tsx` and `apps/web/components/bills-list.tsx` end to end, then produce the amendments pair by following them line for line: the same outer `data-slot="docs"` shell, the same widths, the same header row with `DocsCopyPage` and the next-page button, the same `typeset` body, the same `PublicRail` on the right. If you find yourself inventing a layout, you have gone wrong — go back and copy. Drift between two pages that should look identical is the specific thing this instruction exists to prevent.

**No local production builds.** Dev server only, and only as `BRENDAN_OK_LOCAL_BUILD=1 pnpm dev` from `apps/web`. Kill it when your stretch ends.

**Typecheck wide, not narrow.** A per-file check misses the consumers of a type you changed, which failed three deploys on 2026-09-10. Before pushing, run a `ts.createProgram` over every `.ts`/`.tsx` under `app`, `lib`, `components` and `hooks` with `--max-old-space-size=6144`. It must report clean.

**A push is not a deploy.** After pushing, watch the job and confirm it succeeded:

```
aws amplify list-jobs --app-id d2a69zdzqun8m7 --branch-name main --max-results 3 \
  --query 'jobSummaries[].[jobId,status,commitId]' --output text
```

If it fails, `aws amplify get-job --app-id d2a69zdzqun8m7 --branch-name main --job-id <n>`, fetch the failing step's `logUrl`, fix it, push again. Do not leave a red build behind you.

## What exists

`/amendments/[id]` is built and good: `apps/web/app/(records)/amendments/[id]/page.tsx`, drawn from `getAmendment`, `getAmendmentActions`, `getAmendmentCosponsors`, `getAmendmentTexts` and `getAmendmentNeighbours` in `lib/policy/committee-queries.ts`, with `amendmentPath` and `fmtAmendment` in `lib/policy/congress-hrefs.ts`. It is reached from a bill. There is no index, so an amendment can only be found if you already know which bill carries it.

The sibling lists are in `apps/web/components/policy/federal-lists.tsx` — `NominationsList`, `LawsList` and the rest. They share a `Shell` there that gives a list its search field, its count and its federal note. Read that file before writing anything; `Shell` is almost certainly what you want, and the amendments list should differ from its siblings only in what it queries and what a row says.

## The job

1. **`apps/web/app/(records)/amendments/page.tsx`** — the Bills page, copied, with amendments in it. Title "Amendments". A description that says what the page holds in one sentence, in the site's voice: third person, no "we", never naming the model. Wire `previous`/`next` into the record's running order the way the neighbouring pages do, and check the pages either side so the chain stays unbroken in both directions.

2. **An `AmendmentsList`** beside its siblings in `components/policy/federal-lists.tsx`, on the same `Shell`. A row should carry what identifies an amendment to a reader: its number as `fmtAmendment` prints it, its purpose or description, the bill it amends as a link, its sponsor, and the date of its latest action. Sort newest action first, as the sibling lists do. Link each row through `amendmentPath`.

3. **The data.** Find out what the record actually holds before designing the row — `congress_amendments` and whatever joins it to bills and sponsors. If a field you want is not there, say so in the report rather than leaving a column that renders blank. If there is no list query yet, write one next to the existing amendment queries in `lib/policy/committee-queries.ts` and follow their shape, including the jurisdiction in scope.

4. **Wire it up.** Add `/amendments` to the Records menu in `apps/web/lib/config.ts` in its alphabetical seat, and confirm it is in `RECORD_ROUTES` in the same file so its links carry `?state=`. Check the rail renders it.

5. **Verify.** Dev server, open `/amendments`, page through it, follow a row to its amendment and back. Then the wide typecheck, `npx eslint` on every file you touched with zero errors, commit, push, and watch the deploy go green.

## Reporting

Report what the record holds for amendments, anything you wanted for a row and could not get, and the one decision you made that another person might have made differently. Do not estimate time. Say what is done and verified, and say plainly what is not.
