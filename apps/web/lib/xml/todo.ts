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
  "Commit to feature/legislative-xml by path, never git add -A, never main, pull --rebase before pushing. The branch's dev server is on the box at ~/govblock-xml, port 3002, tunnelled to localhost:3002. Ask Brendan before any production-database action beyond additive DDL under sql/."

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
    status: "claimed",
    claimedBy: "window-6b",
    prompt: `${PROGRAM}, then apps/web/docs/prompts/2026-09-14-citations-and-context.md whole, then apps/web/docs/xml/schema.md, the storage section of window-2.md, and window-5.md for the engine. Plan, then build. Windows 4 and 5 are done: the library and the Work-by-address load at /workspace/typeset/work/<address> (window 4), the fork, editor and amendment engine at lib/typeset/amend.ts (window 5). Resolve every ref node to a Work in the corpus through the address scheme, decorate the reader, and build the in-context view the brief describes. ${RULES} Report to apps/web/docs/xml/window-6.md at every milestone.`,
  },
  {
    id: "window-7",
    title: "Window 7: acquisition — Virginia, the orphaned S3 objects, California",
    status: "open",
    prompt: `${PROGRAM}, then apps/web/docs/prompts/2026-09-14-acquisition.md whole, then the sections of apps/web/docs/xml/window-2.md it names. Plan, then build. If the Virginia and California items on the Database dashboard's To Do are already claimed or done, skip those parts and do the orphan reconcile alone: list lake/v1/xml/ against expressions.s3_key, report count and bytes by jurisdiction as a dry run, then delete the difference from the Mac's credentials (the pipeline box's role cannot delete). The pipeline box govblock-xml (i-09c2fbf8624d91bdf) is stopped; start it for the compiles and stop it after. "BillTexts" is written only through the existing loaders' shape, never deleted from, never sampled by random order. ${RULES} Report to apps/web/docs/xml/window-7.md at every milestone.`,
  },
  {
    id: "window-8",
    title: "Window 8: grammars, round two — the seventeen coverage lines under 80%",
    status: "claimed",
    claimedBy: "window-8-grammar",
    prompt: `${PROGRAM} ("The compiler" especially), then apps/web/docs/prompts/2026-09-14-grammars-and-compiler.md, then apps/web/docs/prompts/2026-09-14-grammars-round-two.md whole, then apps/web/docs/xml/window-3.md and sources.md. Plan, then build. Coverage is the parser's score: the share of a stored document's text the state's front end placed into USLM elements, not how much law is held. First aggregate the state front ends' report.notes into xml_fallouts so the Compiler page shows why a state is low; then take the seventeen lines largest corpus first, derive each grammar from the stored corpus sampled through "Bills" or "Laws" (never "BillTexts" by random order), measure with scripts/xml/coverage.mjs before and after, one jurisdiction per commit with the numbers in the message, to 90% or a written reason. Never touch lib/xml/frontends/federal.ts or the schema. Rebuilds queue from the Ingestion page and need the pipeline box running. ${RULES} Report to apps/web/docs/xml/window-8.md at every milestone with the seventeen-line table, start and current.`,
  },
]
