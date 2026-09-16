// The program's to-do list (Brendan, 2026-09-14), read by the Database
// dashboard's To Do card and by the windows on the branch. A window that
// finishes its brief pulls the first open item here, sets `status` to
// "claimed" with its name, commits this file by path, and runs the item's
// prompt as its next brief; when done it sets "done". A window over 60% of
// its context does not claim; it says so in its report and the lead opens a
// new window with the prompt. Brendan launches any item by hand by copying
// the prompt from the card.

export type TodoStatus = "open" | "claimed" | "done"

export type TodoItem = {
  id: string
  title: string
  status: TodoStatus
  claimedBy?: string
  /** The kick-off prompt, verbatim, for a fresh window. */
  prompt: string
}

const PROGRAM = "Read apps/web/docs/prompts/2026-09-14-legislative-xml-program.md whole"
const RULES =
  "Commit to feature/typeset-flip by path, never git add -A, never main, pull --rebase before pushing. The branch's dev server is on the box at ~/govblock-xml, port 3002, tunnelled to localhost:3002. Ask Brendan before any production-database action beyond additive DDL under sql/."

export const TODO: TodoItem[] = [
  {
    id: "va-refetch",
    title: "Virginia: fetch the 84,630 bills the scraper stored as error pages",
    status: "claimed",
    claimedBy: "window-4",
    prompt: `${PROGRAM}, then apps/web/docs/prompts/2026-09-14-acquisition.md whole; this item is its part 1, Virginia. Plan, then build. 84,630 of Virginia's stored bill texts are its legislature's error page; the pipeline removed their rows and logged each as a fall-out naming a re-fetch. Rank LegiScan's state_link against Virginia's LIS on a sample of fifty, run the winner over the 84,630 one request at a time under nohup with a log, write the texts through the existing loaders' shape into "BillTexts" (never a delete, never a random-order sample), then start the pipeline box govblock-xml (i-09c2fbf8624d91bdf), queue Virginia's bills from /workspace/dashboard/ingestion, and stop the box when the queue empties. ${RULES} Report to apps/web/docs/xml/window-7.md at every milestone.`,
  },
  {
    id: "ca-captures",
    title: "California: count and re-fetch the printings stored as leginfo web pages",
    status: "claimed",
    claimedBy: "window-4",
    prompt: `${PROGRAM}, then apps/web/docs/prompts/2026-09-14-acquisition.md whole; this item is its part 3, California. Plan, then build. For a share of California printings the stored text is leginfo.legislature.ca.gov's page, navigation and script, not the bill. Count them with the test the pipeline already uses for a body that is mostly script (scripts/xml/worker.mjs), re-fetch them from the clean feed the pipeline now ranks first, write them through the existing loaders' shape into "BillTexts", then queue California's bills from /workspace/dashboard/ingestion with "Again, if built" on the pipeline box, and stop the box after. Until the re-fetch lands, the reader's plain-text fallback says when a stored text is a captured web page rather than rendering it (components/workspace/typeset-xml-reader.tsx; one line, third person). ${RULES} Report to apps/web/docs/xml/window-7.md at every milestone.`,
  },
  {
    id: "window-6",
    title: "Window 6: the @ resolver, citations, decorations and the in-context view",
    status: "done",
    claimedBy: "window-6b",
    prompt: `${PROGRAM}, then apps/web/docs/prompts/2026-09-14-citations-and-context.md whole, then apps/web/docs/xml/schema.md, the storage section of window-2.md, and window-5.md for the engine. Plan, then build. Windows 4 and 5 are done: the library and the Work-by-address load at /workspace/typeset/work/<address> (window 4), the fork, editor and amendment engine at lib/typeset/amend.ts (window 5). Resolve every ref node to a Work in the corpus through the address scheme, decorate the reader, and build the in-context view the brief describes. ${RULES} Report to apps/web/docs/xml/window-6.md at every milestone.`,
  },
  {
    id: "window-7",
    title: "Window 7: acquisition — Virginia, the orphaned S3 objects, California",
    status: "claimed",
    claimedBy: "window-6b",
    prompt: `${PROGRAM}, then apps/web/docs/prompts/2026-09-14-acquisition.md whole, then the sections of apps/web/docs/xml/window-2.md it names. Plan, then build. If the Virginia and California items on the Database dashboard's To Do are already claimed or done, skip those parts and do the orphan reconcile alone: list lake/v1/xml/ against expressions.s3_key, report count and bytes by jurisdiction as a dry run, then delete the difference from the Mac's credentials (the pipeline box's role cannot delete). The pipeline box govblock-xml (i-09c2fbf8624d91bdf) is stopped; start it for the compiles and stop it after. "BillTexts" is written only through the existing loaders' shape, never deleted from, never sampled by random order. ${RULES} Report to apps/web/docs/xml/window-7.md at every milestone.`,
  },
  {
    id: "window-8",
    title: "Window 8: grammars, round two — the seventeen coverage lines under 80%",
    status: "done",
    claimedBy: "window-8-grammar",
    prompt: `${PROGRAM} ("The compiler" especially), then apps/web/docs/prompts/2026-09-14-grammars-and-compiler.md, then apps/web/docs/prompts/2026-09-14-grammars-round-two.md whole, then apps/web/docs/xml/window-3.md and sources.md. Plan, then build. Coverage is the parser's score: the share of a stored document's text the state's front end placed into USLM elements, not how much law is held. First aggregate the state front ends' report.notes into xml_fallouts so the Compiler page shows why a state is low; then take the seventeen lines largest corpus first, derive each grammar from the stored corpus sampled through "Bills" or "Laws" (never "BillTexts" by random order), measure with scripts/xml/coverage.mjs before and after, one jurisdiction per commit with the numbers in the message, to 90% or a written reason. Never touch lib/xml/frontends/federal.ts or the schema. Rebuilds queue from the Ingestion page and need the pipeline box running. ${RULES} Report to apps/web/docs/xml/window-8.md at every milestone with the seventeen-line table, start and current.`,
  },
  {
    id: "clips-gemini",
    title: "Clips: cut clips and transcripts through Gemini, the way autoclip.dev does (not tonight)",
    status: "open",
    prompt: `How autoclip.dev does it: there's no public repo. Their FAQ says:
- Google Gemini analyzes the video.
- Speech-to-text gives word-level timing.
- It all runs on their servers, taking about 5 minutes and producing roughly 9 vertical MP4s per video.

Gemini's API accepts a YouTube link directly and Google fetches the video on its own side, so YouTube's block on AWS never applies. That's almost certainly the trick. Making MP4s means they also download the video, likely through paid proxies. We don't need that part, because our clips play in YouTube's own player.

Our version:
- Cost: a free Gemini API key from Google AI Studio, no card, created on the Google account you choose. Gemini reads the YouTube link and returns both the moments and a timestamped transcript. Clipping and the transcript page both work that way.
- Catch 1: Gemini needs about a minute or two on an hour-long hearing, longer than Amplify's 30-second limit. The call would have to run as a background job while the page checks back.
- Catch 2: on the free tier, Google may use the requests to improve its products.`,
  },
  {
    id: "calendar-forward",
    title: "Calendar: every committee meeting and hearing ahead, from congress.gov, on /calendar and everywhere a schedule shows",
    status: "open",
    prompt: `Brendan, 2026-09-16: the forward schedule is already ours to have. congress.gov's API lists committee meetings and hearings before they happen, so /calendar should carry every committee's upcoming meetings — and it does in one place and not in others. First find every surface that shows a schedule (/calendar, the calendar card in the right rails, committee pages, a member's page, the home page) and write down which read congress_committee_meetings / congress_hearings forward of today and which only show what already happened. Then make them one source: the upcoming meetings table, loaded nightly, read through the cache in lib/policy/db.ts, never on page load. Congress first; the states that publish schedules after. Raised while looking at GDELT's "dates mentioned in the article", which is the press guessing at what congress.gov already publishes.`,
  },
]
