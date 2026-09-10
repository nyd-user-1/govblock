# Kickoff: the standing law of every state

You are working in `/Users/brendanstanton/Code/govblock` on `main` (Next.js 16 at `apps/web`, Aurora Serverless v2 through the RDS Data API — never Neon). Read `CLAUDE.md` and the memory index first, especially `ny-laws`, `route-shape`, `production-database`, `no-local-builds`, `bounded-typecheck` and `amplify-deploys`.

Another session is working in this repo at the same time. Commit only what you write.

## Why this exists

`/laws` today is the Consolidated Laws of the State of New York — every section, searchable, free. Brendan built it because "for decades there was a monopoly of private businesses who offered the full text to willing buyers… you had to pay to see the law?"

New York is one state. Get the other forty-nine, plus DC and the territories the record covers.

## There is nothing to decide

**The standard already exists and it is `/laws?state=NY`.** Every state you load matches it in style, format and design. The index page matches the Bulk Datasets index. Read both before you start:

- `apps/web/app/api/laws/route.ts` — the shape every row must satisfy.
- `apps/web/components/laws/laws-browser.tsx` and `law-text.tsx` — what draws it.
- `apps/web/app/docs/datasets/page.tsx` — the index, which is `JurisdictionIndex` with a `base`. Yours is the same component with `base="/laws"`.

Do not design a schema, a layout or an index. Match what is there. If something makes you want to change the schema, you have misread how New York was modelled — go back and read it again.

## The plumbing is already multi-state

The `Laws` table on Aurora is keyed by `state` and carries `law_id`, `law_name`, `law_type`, `chapter`, `location_id`, `doc_type`, `doc_level_id`, `title`, `parent_location_id`, `sequence_no`, `depth`, `repealed`, `active_date`, `text`, `fetched_at`. `/api/laws` already takes `?state=`. A state is done when its rows are in that table with a correct tree, and the existing browser draws it with no further work.

**Normalisation to that shape is the job, not a question to bring back.** Every source you meet will be shaped differently — a real API, bulk USLM or Akoma Ntoso, structured HTML, a vendor's rendered pages. Every one of them normalises to the columns above. `parent_location_id`, `sequence_no` and `depth` are what make the tree, the crumbs and the search work; get them right per source and the page is right for free.

## Copyright: take the law, leave the annotations

A commercial vendor cannot copyright a statute. Several states publish their code through one, and what that vendor may own is the layer it added — headnotes, case notes, editorial commentary, research references, its own numbering of its own notes. **Respect that layer and leave it behind. Take the text of the law itself.**

This applies to every jurisdiction. There are no exceptions and no jurisdiction gets skipped because a vendor sits in front of it. Act in good faith: statute text and the structure it sits in, nothing the vendor authored.

## The work, continuous

1. **Survey**, into `apps/web/docs/state-law-sources.md`: one row per jurisdiction — publisher, URL, format, whether a vendor sits in front, rate limits and keys, rough section count. Write it as you go and keep it current. **Do not stop for a review.** It is a working document, not a gate.

2. **Load**, straight on from the survey. `scripts/laws/` with one runner and one adapter per source shape — states sharing a publisher share an adapter, not one script per state. Follow `scripts/geo/` and `scripts/news/`: `--state`, `--dry`, one request at a time, retry on 5xx, resumable, a printed summary of rows written.

   Before loading a state in full, load one law from it and walk the tree in the browser to a section with text. Wrong crumbs or ordering means the adapter is wrong, never the schema.

   Work in tiers, cleanest and largest sources first, and report after each tier rather than at the end.

3. **The route.** `/laws/[state]` in `app/(records)/`, in `RECORD_ROUTES` in `lib/config.ts` so its links carry the jurisdiction. `/laws` is the index, `JurisdictionIndex` with `base="/laws"`, matching Bulk Datasets. `/laws` must not 404.

   A jurisdiction not yet loaded says so plainly. A jurisdiction whose law genuinely cannot be got says what is actually true about it. Those are different sentences and neither is "coming soon".

## Rules that are not negotiable

**No local production builds.** Dev server only, `BRENDAN_OK_LOCAL_BUILD=1 pnpm dev` from `apps/web`, killed when your stretch ends.

**Typecheck wide.** Before every push, a `ts.createProgram` over every `.ts`/`.tsx` under `app`, `lib`, `components`, `hooks` with `--max-old-space-size=6144`, reporting clean. A per-file check misses the consumers of a type you changed and has already failed three deploys.

**A push is not a deploy.** After pushing, confirm the job went green, and fix it if it did not:

```
aws amplify list-jobs --app-id d2a69zdzqun8m7 --branch-name main --max-results 3 \
  --query 'jobSummaries[].[jobId,status,commitId]' --output text
```

**Aurora pauses at 0 ACU.** Wake it before a long load. Keep a Data API result under 1 MB; page rather than raising a limit.

**Be a good citizen.** One request at a time, a real user agent naming the project, back off when told to. The point is to make public law free to read, not to hammer a legislature's website.

## What Brendan will check

He will open the `/laws` index and a handful of `/laws/[state]` pages and compare them against `/laws?state=NY`. They should be indistinguishable but for the words.

Report per tier: which jurisdictions loaded, how many laws and sections each, what the spot check of the tree showed. Name any jurisdiction you could not get and say exactly why. Do not estimate time.
