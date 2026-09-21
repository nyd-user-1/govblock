// How each jurisdiction's bill text is fetched (Brendan, 2026-09-20), for the
// Database dashboard's overlay: who publishes it, what is taken, where the code
// is, when it runs, how it behaves, and what could be better. Every line is
// read off the livingston repo — scripts/box/text-backfill.mjs,
// scripts/box/fleet-launch.sh, ops/box/jobs.d/*.json, prompts/2026-08-29-
// native-text.md — and where a reason is not written down there, this says so
// rather than guessing. LegiScan supplies the index of bills and the link to
// each document on the legislature's own site; it never supplies the text.

export type Route = "native" | "walker" | "blocked" | "other"

export type StateSource = {
  route: Route
  /** Who publishes the text. */
  who: string
  /** What is taken, and how it arrives. */
  what: string
  /** The loader: file, and the argument that selects this path. */
  where: string
  /** The job and its cadence. */
  when: string
  /** How it behaves toward the source. */
  how: string
  /** What is known to be wrong or unfinished. */
  problems: string[]
  /** What would make it better. */
  improve: string[]
}

const LOADER = "livingston scripts/box/text-backfill.mjs"

const WALKER: StateSource = {
  route: "walker",
  who: "The legislature's own website. LegiScan's index gives each document's address there (state_link); the text is fetched from that address, not from LegiScan.",
  what: "Every printing of every bill since the 2023 session, as the HTML or PDF the legislature serves. PDFs are parked in S3 (livingston-bill-pdfs) and converted in one pass by --source pdf-batch.",
  where: `${LOADER} --source state_link --state XX (one child process per state under --all-states)`,
  when: "lv-text-walk, nightly: four hours a night (--max-seconds 14400), four states at a time, newest sessions first. lv-text-delta, nightly: the text of whatever moved in the last seven days, 1,500 documents at most.",
  how: "One connection per host. robots.txt and Crawl-delay are obeyed; a host starts at 4 lanes and ramps itself to 16 on a fleet (POLITE_AUTO_LANES). A box that dies loses nothing: what it had not fetched is still outstanding.",
  problems: ["A legislature's error page or site menu is sometimes stored as if it were the bill (Virginia: 84,630; West Virginia's newest). The XML compile rejects them; the text still needs fetching again."],
  improve: ["A per-state check that the body is a bill before it is stored, so captures never reach \"BillTexts\".", "The delta looks back seven days; after a longer outage the gap falls to the slow walk. A catch-up run with a wider window closes it."],
}

const walker = (patch: Partial<StateSource> = {}): StateSource => ({ ...WALKER, ...patch, problems: [...(patch.problems ?? []), ...WALKER.problems], improve: [...(patch.improve ?? []), ...WALKER.improve] })

const SET_ASIDE = "robots.txt is set aside for this host by Brendan's ruling of 2026-08-29 (\"all 50 minus the 3-4 where you are blocked … you go at max speed\"): a fixed 4 lanes per IP."

export const STATE_SOURCES: Record<string, StateSource> = {
  US: {
    route: "native",
    who: "The Government Publishing Office (GovInfo BILLS packages) and the Library of Congress (congress.gov API).",
    what: "Every printing of every bill from the 113th Congress on, as native XML, plus the CRS summaries (govinfo-billsum).",
    where: `${LOADER} --source govinfo / govinfo-billsum; the bill record itself through livingston's Congress job (ops/box/jobs.d/dp-congress.json)`,
    when: "Nightly on the worker box.",
    how: "Bulk zips, unchanged printings skipped by source hash.",
    problems: ["Before 2013 there is no XML; plain text is the ceiling for the 111th and 112th."],
    improve: ["The dashboard's play button does not run Congress yet: it is a different loader from the states'."],
  },
  NY: {
    route: "native",
    who: "The New York State Senate's Open Legislation API (legislation.nysenate.gov).",
    what: "Bill text and status for both chambers, 1,000 bills a request in bulk.",
    where: `${LOADER} --source nysenate-bulk (text); api/bills-sync.ts through lv-bills-sync (status)`,
    when: "lv-bills-sync nightly; text through the nightly delta.",
    how: "An API with a key; no crawling.",
    problems: ["Sponsor rows are written without a sponsor type, so views that ask for the primary sponsor (sponsor_type_id = 1) find none: 82 rows since 2026-08-15.", "Assembly Rules Committee bills (the A 11000 series) arrive with no chamber on the row."],
    improve: ["Set sponsor_type_id from the API's sponsor order in the loader, and backfill the blanks."],
  },
  CA: {
    route: "native",
    who: "The California Legislature's bulk downloads (downloads.leginfo.legislature.ca.gov).",
    what: "pubinfo_<year>.zip: the whole session database, the bill text in BILL_VERSION_TBL's bill_xml column. About 1.1 GB a session; daily delta zips Monday to Saturday.",
    where: `${LOADER} --source ca-pubinfo --session 2025`,
    when: "The session zip refreshes weekly at the same address; the text_hash upsert makes a re-run cheap.",
    how: "Four requests to one host. The zip is streamed to disk and parsed from disk; it does not fit in memory.",
    problems: ["leginfo.legislature.ca.gov refuses the walker by robots.txt (7,117 refusal rows), so state_link copies are web pages of menus and script; the pipeline prefers pubinfo wherever both exist.", "408 newer printings were found that pubinfo's 2025 rows did not yet hold (window 7)."],
    improve: ["Read the daily delta zips instead of the whole session each time."],
  },
  TX: {
    route: "native",
    who: "The Texas Legislature's anonymous FTP mirror (ftp.legis.state.tx.us).",
    what: "Every bill text as HTML, by session: /bills/<session>/billtext/html/.",
    where: `${LOADER} --source tx-ftp --all-sessions --ftp-connections 2`,
    when: "On demand and in the nightly delta.",
    how: "Two FTP connections.",
    problems: ["Texas's action lines are form-style (\"E Effective on . . . . . .\"), and some are stored with the date missing."],
    improve: [],
  },
  MA: {
    route: "native",
    who: "The Massachusetts General Court's REST API (malegislature.gov/api).",
    what: "JSON with DocumentText inline, per document.",
    where: `${LOADER} --source ma-api --batch 2000 --api-parallel 12`,
    when: "On demand and in the nightly delta.",
    how: "Twelve parallel API reads.",
    problems: ["The docket header arrives as one run-on line, which is what a block prints when the XML is rejected."],
    improve: [],
  },
  VA: {
    route: "native",
    who: "Virginia's Legislative Information System: the LIS API for the current session (a key, VA_LIS_API_KEY), legacy LIS pages through state_link for earlier ones.",
    what: "Bill text per printing.",
    where: `${LOADER} --source va-lis --batch 2000 --api-parallel 8; govblock scripts/xml/va-refetch.mjs for the re-fetch`,
    when: "On demand.",
    how: "Eight parallel API reads; the legacy pages one request at a time.",
    problems: ["84,630 stored texts (74%) were the legislature's error page; the re-fetch is window 7's job."],
    improve: [],
  },
  OH: walker({
    who: "The Ohio General Assembly. Its open JSON API (search-prod.lis.state.oh.us) is what govblock's /live reads; the text loader has no Ohio source of its own and walks the legislature's pages.",
    problems: ["The host fails the walker's TLS chain check; livingston carries ops/box/state-ca-bundle.pem for it."],
    improve: ["A native loader against the JSON API, as the 2026-08-29 native-text brief planned."],
  }),
  NJ: walker({ when: "Left out of livingston's nightly walk (--skip-states NJ): a dedicated job owned the host during the first backfill. A run from this board walks it like any other state; the fleet of 2026-09-20 found 140 new bills and stored 287 documents.", problems: ["LegiScan lists a printing before pub.njleg.gov has published it: 10 new links answered 404 on 2026-09-20."] }),
  IL: walker({ when: "Walked nightly, and by a fleet from this board.", problems: ["www.ilga.gov answered 500 for its 9 newest documents on 2026-09-20, from a box and from a laptop alike: the state's server, not a refusal."] }),
  TN: walker({ how: `${SET_ASIDE} Tennessee was the first host treated this way.`, when: "Walked nightly, and by a fleet from this board." }),
  OK: walker({ how: SET_ASIDE }),
  HI: walker({ how: SET_ASIDE }),
  CO: walker({ how: SET_ASIDE, problems: ["21,303 Colorado PDFs were parked in S3 on 2026-08-30 and none had been converted when window 7 looked."], improve: ["Run --source pdf-batch for Colorado."] }),
  PA: { ...walker(), route: "blocked", how: "www.palegis.us answers an AWS address 403 at any pace (2026-09-20: four lanes, then one lane a second and a half apart, the same five strikes). So the box discovers, and this machine fetches what the box was refused: scripts/pipeline/relay.mjs PA parks each PDF in S3 where the walker parks one it defers, and `launch.mjs convert PA` turns them into text on a box.", problems: ["The legislature's host blocks AWS address ranges, so a run from a box alone discovers Pennsylvania's bills and fetches none of them."], improve: ["Run the relay after every Pennsylvania discovery, from a schedule on a machine outside AWS.", "Or find a bulk or API source."] },
  MT: walker({ problems: ["Montana's links are download tickets (docs.legmt.gov/download-ticket?ticketId=…) that expire: 3,949 documents of the 2025 session hold an empty file, and sessions before it answer 404. The walker cannot fetch Montana."], improve: ["A loader of its own against the legislature's bill API, as Virginia and Massachusetts have."] }),
  GA: { ...walker(), route: "blocked", problems: ["The legislature's host blocks AWS address ranges; the launcher's note says it needs a human."], improve: ["Fetch from a non-AWS address, or find a bulk or API source."] },
}

export const sourceOf = (state: string): StateSource => STATE_SOURCES[state.toUpperCase()] ?? walker()

export const ROUTE_LABEL: Record<Route, string> = { native: "Own feed", walker: "Walked", blocked: "Blocked", other: "Other" }
