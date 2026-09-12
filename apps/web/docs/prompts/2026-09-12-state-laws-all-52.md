# The standing law of all 52 jurisdictions

Brendan, 2026-09-12: finish the job. Every state's statutes, plus DC and the US
Code, in the `Laws` table on Aurora, each one browsable at `/laws/<state>` with
no further front-end work. There is no acceptable outcome short of all 52, and
there is no politeness budget: the laws belong to the citizens, and the only
limit on how they are taken is the law itself. This conversation has been had
in full; do not re-open whether, only how fast.

## Where it stands

Loaded (rows in `Laws`, tree intact, page draws): **US** (57 titles), **CA**
(30 codes), **NY** (137 laws — the reference), **DC** (54 titles), **MA** (611
of 701 chapters; the run was one request per section and was interrupted —
finish it with `--resume`, which is the default). Everything else is open.

The framework is built and proven on five different source shapes:

- `scripts/laws/load.mjs` — one runner. `--list`, `--state XX`, `--dry`,
  `--law ID`, `--force`, `--limit N`. Owns ordering, the tree, one transaction
  per law, resume, the summary. Read it first, whole.
- `scripts/laws/adapters/*.mjs` — one adapter per source shape (`us`, `ca`,
  `dc`, `ma`, `ny`). An adapter yields laws in document order and nothing else.
  States that share a publisher share an adapter. Start every new state by
  copying the adapter whose source looks most like it.
- `scripts/laws/lib/` — `db.mjs` (RDS Data API batch upsert, 40 rows / 450 KB
  a call; date columns through `cast(:p as date)` because batch typeHints are
  ignored), `fetch.mjs` (the polite fetcher and the `UA`), `remote-zip.mjs`,
  `text.mjs` (wrapping dropped, paragraphs kept), `xml.mjs`.
- `apps/web/docs/state-law-sources.md` — the ledger: publisher, format, vendor
  in front, status, and the shape every row must land in. **Update the row for
  every state you touch, the moment its status changes.** The table's column
  contract is in that file; do not invent columns.
- Env: `POLICY_CLUSTER_ARN`, `POLICY_SECRET_ARN`, `POLICY_DATABASE=policy`,
  `AWS_REGION`, `NYS_LEGISLATION_API_KEY` in `apps/web/.env.local`. Run the
  loader with `node --env-file=apps/web/.env.local scripts/laws/load.mjs …`.

## The box

Do not run the loads on Brendan's Mac. Use **govblock-dev**, EC2
`i-0b5e3556a1fa8f1d4` (us-east-1, t4g.xlarge, 8 GB swap), reached only through
SSM: `ssh govblock-dev` (Host entry in `~/.ssh/config`, ProxyCommand over
`aws ssm start-session`), or `aws ssm send-command`. The repo is at
`/home/ec2-user/govblock` and its `apps/web/.env.local` came from
`s3://govblock-lake-638175140432/dev-box/env.local` — re-copy it if the local
one changes. Its instance role can read the Aurora secret and call the Data
API. It stops itself at 09:00 UTC every night (`govblock-stop.timer`); a load
that must run past that either disables the timer for the night
(`sudo systemctl stop govblock-stop.timer`, and re-enable it after) or runs on
a fleet box that terminates itself when done. Its public IP changes on every
start; SSM does not care. Sync code to it with rsync over ssh; pull data from
it never — the data goes to Aurora, and originals to S3.

For a source that is millions of small requests, launch a small fleet of
`t4g.medium` from the doctrine rather than crawling for days on one box:
**read `/Code/scripts/FLEET-DOCTRINE.md` and `/Code/forge/docs/LESSONS.md`
before touching a fleet.** The dev server (`govblock-dev.service`) is running
on the box; leave it, or stop it for the night if a load needs the memory.

## Posture

The laws belong to the citizens. Every statute in this list is a public
document that a state publishes for its people, and the job is to have every
one of them, whole, in the table. Within the law, do whatever it takes: shard,
parallelise, run fleets, add compute, take three routes to the same code at
once and keep whichever lands first. No Mr. Nice Guy. A host that answers is
a host to be drained at the rate it can bear; a host that will not answer is a
problem to be routed around, not respected.

What "within the law" means here, and it is the whole of the limit:

- Public documents only, taken as published. Nothing behind a login is
  touched, no credential is borrowed, no paywall is broken, no captcha is
  solved by a machine, no rate limit that a host states in a contract we
  agreed to (an API key's terms) is exceeded.
- We say who we are. UA `Mozilla/5.0 (compatible; GovBlock/1.0;
  +https://gov.nysgpt.com; brendan@nysgpt.com)`. Some hosts 403 anything
  that does not begin with `Mozilla/`; send that prefix everywhere.
- A vendor's editorial layer (LexisNexis and Westlaw annotations, headnotes,
  case notes) is theirs; the statute text, numbering and the state's headings
  are not, and are taken. Say which vendor sat in front in the ledger.

Everything else is ours to decide, and the decision is speed:

1. **Per-host concurrency is found, not assumed.** Start at 8 in flight per
   host, climb while the host answers 200, back off only on 429/503/timeouts,
   and log the ceiling you found in the ledger so the next run starts there.
   One request per host per second was a courtesy from another project; it is
   not this project's rule.
2. **Shard across boxes.** A source that is a hundred thousand pages is a
   fleet job: `t4g.medium` boxes from the doctrine (`/Code/scripts/FLEET-DOCTRINE.md`,
   `/Code/forge/docs/LESSONS.md`), one shard each, self-terminating, writing
   originals to S3 and rows to Aurora. Ten boxes cost about thirty-four cents
   an hour. Spend it.
3. **Take every route at once.** Bulk file, per-page HTML, the state's XML or
   API, the Wayback CDX index for a host that has gone dark, a sibling
   publisher's copy of the same code (Justia, LII, Open States, the LRC
   printers) as a cross-check and as a fallback. Whichever completes first and
   reconciles wins; the others confirm it.
4. **A host that refuses AWS is run from somewhere else, honestly.** Missouri
   blocks AWS ranges; run it from the Mac, from a different cloud, from a
   residential connection with the same identifying UA. Not a rotating proxy
   pool pretending to be a thousand browsers, which is the one thing that
   reads as evasion; one honest client from an address the host serves.
5. **Scanned PDFs get OCR at scale, not a shrug.** Montana, Minnesota
   archives, parts of Arkansas: Textract on the originals in S3, or tesseract
   on the fleet, and mark the row as OCR so a reader knows.
6. **Keys are asked for the same hour they are found to be needed**, and the
   HTML route is built in parallel while the key is in the mail. Waiting is
   not a state.
7. **Originals to S3 first**, `s3://govblock-lake-638175140432/laws/<state>/…`,
   so a re-parse never re-fetches and a host that dies tomorrow costs nothing.
8. **One transaction per law; resume by default.** A law with rows on file is
   a law that finished. Never a half-written law.
9. **Verify on the site.** A state is done when `/laws/<state>` on the box
   draws the tree, a section reads as prose, the outline walks, search finds a
   phrase, and the crumbs climb. Brendan checks in his own browser on
   `localhost:3001`; do not run headless against his Mac.

Operational facts that will bite (each one already has):

- Data API ceilings: 1 MB per response, a statement timeout that kills a
  `count(*)` over the whole table (query per state), batch typeHints ignored
  (cast dates in SQL), Aurora pauses at 0 ACU so a session's first call is
  slow, not down. Raise the Aurora max ACU for the night if writes queue.
- Do not ALTER when nothing is missing; no schema work under a running load.
- Env drift on boxes: a job that stopped overnight is a stale key or a moved
  host until proven otherwise. Read the log before assuming.
- Kill patterns: never `pkill -f` with a pattern that appears in your own ssh
  command; never a kill and a relaunch in one ssh command; tmux and `run-job`
  drop a prefixed env, so put `env VAR=… node …` inside the command.
- No subagents in this window. One context, inline. An eleven-agent fan-out
  once burned Brendan's whole usage window. Parallelism is boxes and
  processes, not Claude windows.
- Report in numbers. Brendan reads every character. One line per state as it
  lands, one block per night.
- No commits or pushes unless Brendan says so; a push to `main` deploys the
  site. Data never goes through git.

## Keys and doors already opened

- **VA** — API registration at `lis.virginia.gov/apiregistration`; Brendan
  applied. Ask him for the key before building VA; build around HTML if it is
  not here yet.
- **IN** — MyIGA key requested (`apitoken.request@iga.in.gov`). Same.
- **PA, AZ, FL** — emails sent for bulk access; until answered, PA and FL have
  HTML/XML per title on the open web, AZ per section.
- **TX** — `statutes.capitol.texas.gov` is an Angular shell now; its API must
  be found from the network tab, or the statutes taken from the Legislative
  Council's bulk files. Do not scrape the shell.
- **WA** — the Code Reviser's bulk page moved; find the new address rather
  than crawl 30,000 pages.

## Order of work

1. Finish **MA** (`--state MA`, resume) tonight on the box; it is 90 done.
2. The bulk-file states next, largest first, one adapter each and shared where
   the publisher is shared: **TX, FL, WA, VA, OH, PA, IL, MI, NJ, NC, GA, AZ,
   TN, IN, MN, WI, CO, MD, MO, CT, OR, KY, LA, SC, OK, AL, IA, KS, UT, NV,
   AR, MS, NE, NM, WV, ID, HI, NH, ME, MT, RI, DE, SD, ND, AK, VT, WY**.
   Run several at once: while a fleet drains one bulk state, build the next
   adapter. Never skip one because it is hard; a hard one gets a row saying
   exactly what was tried and a second route started the same day.
3. Every state: adapter → `--dry --law <one>` to check the tree → `--state XX`
   on the box under `nohup` with a log in `~/logs/laws-XX.log` → verify at
   `/laws/XX` → ledger row → report one line.

## Report format

One line per state as it lands:

```
TX · 28 codes · 91,412 sections · 47 min · snapshot 2025-09-01 · bulk zip via S3
```

And one block when you stop for the night: loaded / running / blocked, each
with the state codes, nothing else. The ledger doc is the durable record.
