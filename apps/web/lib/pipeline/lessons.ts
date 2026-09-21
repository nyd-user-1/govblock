// What each run from the Database dashboard taught, newest first (Brendan,
// 2026-09-20). Written after a run from what Aurora held before and after it,
// never from a loader's own "stored" count: the first run said 406 stored and
// had written them to a database nothing reads.

export type RunLesson = {
  id: string
  title: string
  /** UTC, as the box reported it. */
  when: string
  /** The one figure the run is remembered by. */
  headline: string
  outcome: "clean" | "partial" | "failed"
  /** What the box ran, a line a step. */
  ran: string[]
  /** Aurora before and after. */
  result: { label: string; before: string; after: string; diff?: string }[]
  lessons: string[]
}

export const LESSONS: RunLesson[] = [
  {
    id: "2026-09-20-publish",
    title: "After the fleet: nothing showed",
    when: "Sep 20, 23:02 UTC",
    headline: "a run now publishes",
    outcome: "partial",
    ran: [
      "Aurora held 52 of 52 jurisdictions checked and 367 new bills; the dashboard drew 51 red dots and /changelog ended at September 9",
      "POST /api/revalidate { all: true }, and select public.refresh_policy_matviews() — 21 seconds",
    ],
    result: [
      { label: "Changelog's newest Michigan action", before: "Sep 9", after: "Sep 17" },
      { label: "Changelog's newest New Jersey action", before: "Aug 28", after: "Sep 17" },
    ],
    lessons: [
      "Landing in Aurora is not the end of a run. The site reads Aurora through a cache that a loader is meant to clear when it finishes, and /changelog and /newsroom read two materialized views that only change when refreshed. The runs did neither, so a fleet that worked looked like a fleet that had not.",
      "Every run now ends with a Publishing stop: the box refreshes the views, and the board clears the read cache the first time it sees a run's done. Verified in Aurora is one check; verified on the page is the other, and only the second is what a reader sees.",
      "Production has the same cache and no box can clear it yet: the site's secret is not on a box. A scheduled run needs that call too, or production waits out the cache's hour.",
    ],
  },
  {
    id: "2026-09-20-fleet",
    title: "Fleet, all 52 jurisdictions, discover then fetch",
    when: "Sep 20, 21:46 UTC",
    headline: "52 of 52 green",
    outcome: "clean",
    ran: [
      "24 boxes, each owning its states start to finish: Congress, New York, California, Texas and Massachusetts a box each on their own feeds; 47 walked states dealt over 19 boxes",
      "23 boxes finished inside 15 minutes, every one exit 0; Congress's box went on fetching texts from the API at its own pace",
      "discovery: 22 sweeps, 20 session archives imported, 64 LegiScan queries of the month's 30,000; New York and Congress discovered from their own sources",
      "then New York again with its sync told to start from September 1: 103 bills, 46 of them new, 108 versions stored",
    ],
    result: [
      { label: "Bills", before: "2,129,048", after: "2,129,415", diff: "+367" },
      { label: "Bills with text", before: "1,931,278", after: "1,931,660", diff: "+382" },
      { label: "Documents", before: "4,395,268", after: "4,397,003", diff: "+1,735" },
      { label: "Texts holding text", before: "3,262,340", after: "3,306,370", diff: "+44,030" },
      { label: "Jurisdictions checked inside 36 hours", before: "1", after: "52", diff: "+51" },
      { label: "New Jersey", before: "92,319 bills", after: "92,459 bills", diff: "+140, 287 texts" },
    ],
    lessons: [
      "A fleet after a discovery is small. Three weeks of every legislature in the country came to 367 bills and 1,735 documents, because in September most have gone home. The first backfill's design — 24 boxes splitting one national walk by document id, texts parked in S3 for a later load — is the wrong shape for this; each box owning two or three states, discovering and then fetching them and writing straight to Aurora, finished in minutes and showed on the Volume chart as it landed.",
      "New York's sync had its window wrong. It starts from the newest action on file, but asked that of every state's bills, not New York's: the moment California and Michigan were imported up to September 19, New York's window opened on September 18 and skipped September 2 to 18. Fixed to New York's own newest, and run once from September 1 to close the gap.",
      "A box that says it found no states to walk is telling the truth: nothing new in its states after the look. That is the common case on a quiet night and it should read as green, which it now does.",
      "What is still refused after a fleet is short and specific. Pennsylvania refuses the box and takes the relay. Illinois's server answered 500 for its nine newest documents, from anywhere. New Jersey's ten 404s are printings LegiScan lists before the state publishes them; the next run picks them up.",
      "Every run so far was started by hand. Nothing here is on a schedule yet, and 44b-wake-nightly is still disabled: the next step is a nightly launch of this same fleet, with the Pennsylvania relay on a machine outside AWS.",
    ],
  },
  {
    id: "2026-09-20-us",
    title: "Congress, discover then fetch",
    when: "Sep 20, 21:38 UTC",
    headline: "+486 bills, +492 texts",
    outcome: "clean",
    ran: [
      "first, alone — discover: govinfo's eight BILLSTATUS zips, no API calls, 97 seconds; fetch: congress/sync.mjs died on its first body, 403 from www.congress.gov",
      "in the fleet — sync.mjs --days 21: 4,976 bills, 6,680 versions seen, 226 stored, 6,392 left alone because govinfo's XML is the better copy, 453 with no bill to attach to; bill-delta: 1,000 bills, 8,005 requests",
      "again with LegiScan's index ahead of govinfo — 18,470 bills to 18,956; sync: 0 unmatched; the second bill-delta ran into the API's hourly ceiling and was stopped",
      "the catch-up, once the hour had cleared — sync.mjs --since 2026-09-04: 5,499 bills, 7,011 versions seen, 265 stored, 0 unmatched, 29.9 minutes, exit 0",
    ],
    result: [
      { label: "Bills of Congress", before: "18,470", after: "18,956", diff: "+486" },
      { label: "Texts stored from congress.gov", before: "", after: "492", diff: "+492" },
      { label: "Bills holding text the site said they lacked", before: "304", after: "0" },
      { label: "Versions with no bill to attach to", before: "453", after: "0" },
      { label: "Bills refreshed with actions, cosponsors, committees", before: "", after: "1,000" },
    ],
    lessons: [
      "www.congress.gov refuses some data centre addresses: one box drew 403 on its first body, the next box did not. govinfo serves the identical file to anyone, so the sync now reads a body from govinfo once congress.gov has said 403 and does not ask it again that run.",
      "Congress's bills reach \"Bills\" from LegiScan's index like any state's. govinfo's zips fill the record around a bill but do not add one, so discovery for Congress is two steps, the index first. Without it 453 versions found no bill; with it, none.",
      "The API allows 20,000 requests an hour and the refresh of actions and cosponsors costs eight a bill. Three days after a recess was 3,136 bills; it is capped at a thousand a run. Two runs inside an hour still reached the ceiling: a night gets one Congress run.",
      "The sync resumes from its last success less a day, which is right for a night and wrong for a catch-up: a run that must reach back says so (single US --since 2026-09-04).",
      "Storing a text is not the same as the site knowing it has one. \"Bills\".text_chars is what coverage, the dashboard and the bill page count; the state loaders stamp it and the Congress sync did not, so 304 bills held text the site said they lacked. The sync stamps it at the end of every run now.",
    ],
  },
  {
    id: "2026-09-20-pa",
    title: "Pennsylvania, discover then fetch, then the relay",
    when: "Sep 20, 21:11 UTC",
    headline: "+52 bills, +53 texts",
    outcome: "partial",
    ran: [
      "discover: national-sweep.mjs --only PA — 3 LegiScan queries, one 22.8 MB archive, 98 seconds",
      "fetch: state_link walker — 53 new documents, all 53 refused: www.palegis.us dropped after five 403s",
      "again with one lane, a request every second and a half: the same five 403s",
      "relay.mjs PA from this machine: 53 PDFs parked in S3; convert PA on a box: 53 converted",
    ],
    result: [
      { label: "Pennsylvania bills", before: "53,980", after: "54,032", diff: "+52" },
      { label: "Newest action on file", before: "Aug 27", after: "Sep 18" },
      { label: "New documents fetched by the box", before: "", after: "0 of 53" },
      { label: "After the relay", before: "", after: "53 of 53", diff: "+53" },
    ],
    lessons: [
      "Pennsylvania refuses a data centre's address, at any pace. One lane and a second and a half between requests drew the same 403s as four lanes; the same link with the same User-Agent answers this machine 200. It is the address, not the manners.",
      "The relay is the way through: this machine fetches what the box was refused and parks each PDF where livingston's walker parks one it defers; a box converts them. Nothing new on the box. A site that says no in robots.txt is still never asked.",
      "A refused host is a verdict the walker never revisits, so every refused document stays refused until a relay takes it. After a fleet, the states to relay are the ones with host-dropped rows in a current session.",
    ],
  },
  {
    id: "2026-09-20-mi-oh",
    title: "Michigan and Ohio, discover then fetch",
    when: "Sep 20, 21:23 UTC",
    headline: "+97 bills, +121 texts",
    outcome: "clean",
    ran: [
      "Michigan — discover: 3 queries, 14.5 MB, 26 seconds; fetch: 86 documents, 86 stored, 33 seconds",
      "Ohio — discover: 3 queries, 15 seconds; fetch: 35 documents, 35 stored, 3 seconds",
    ],
    result: [
      { label: "Michigan bills", before: "39,157", after: "39,209", diff: "+52" },
      { label: "Michigan bills with text", before: "39,040", after: "39,092", diff: "+52" },
      { label: "Ohio bills", before: "21,094", after: "21,139", diff: "+45" },
      { label: "Ohio bills with text", before: "4,069", after: "4,096", diff: "+27" },
    ],
    lessons: [
      "This is the whole loop working: three weeks of a legislature is some fifty bills and under a hundred documents, found and fetched in about a minute on a box that took ninety seconds to start. A nightly run of every state is small.",
      "Ohio's 19 percent is its past, not its present. Every current link fetched; the 28,000 failures are sessions before 2023 on an archive host that no longer exists. Coverage of old sessions is a link-rewriting job, not a fetching one.",
      "Montana cannot be walked at all: its links are download tickets that expire, and 3,949 current-session documents hold an empty file. Montana needs a loader of its own.",
    ],
  },
  {
    id: "2026-09-20-ca",
    title: "California, discover then its own feed",
    when: "Sep 20, 21:19 UTC",
    headline: "737 versions matched",
    outcome: "clean",
    ran: [
      "first attempt — discover ended in a second: the fleet's bundle carries no LEGISCAN_API_KEY; the feed ran alone, 18,431 versions, all unchanged",
      "second attempt — discover: 3 queries, 28.8 MB, 52 seconds; fetch: ca-pubinfo, 1.28 GB, 15.3 minutes",
    ],
    result: [
      { label: "Newest action on file", before: "Aug 29", after: "Sep 19" },
      { label: "Versions filed under a made-up document id", before: "737", after: "0" },
      { label: "Versions inserted", before: "0", after: "737", diff: "+737" },
      { label: "Versions of bills Aurora does not hold", before: "158", after: "158" },
    ],
    lessons: [
      "The bundle the boxes start from was packed for walking text and holds New York's key and nothing else. A launch now sends the keys discovery needs to the same private bucket, and refuses to launch without them.",
      "Discovery changes what a feed can do. Before it, 737 of California's versions had no document to attach to and were filed under made-up ids; after it, all 737 matched real documents.",
      "The sweep had a hole. The 23 legislatures that meet all year — California, New York, Congress among them — were seeded on August 30 without a hash, and the sweep's rule skipped a seeded session forever. It would have refreshed only the legislatures that had gone home. A live seeded session is now imported once, and its hash is on file after.",
      "Looked at is not the same as changed. The dashboard's dot read the last import, so a legislature out of session went red an hour after being checked. The sweep now stamps every session it compares, and the dot reads the newer of the two.",
    ],
  },
  {
    id: "2026-09-20-ny-rerun",
    title: "New York, fetch only",
    when: "Sep 20, 20:50 UTC",
    headline: "+42,477 texts",
    outcome: "clean",
    ran: ["text-backfill.mjs --source nysenate-bulk --session 2025", "26 requests to the Senate's API, 25,398 bills, 10.1 minutes, exit 0"],
    result: [
      { label: "New York texts holding text", before: "287,375", after: "329,815", diff: "+42,440" },
      { label: "Texts holding text, every state", before: "3,262,340", after: "3,304,817", diff: "+42,477" },
      { label: "Bills", before: "2,129,048", after: "2,129,048", diff: "0" },
      { label: "A 11708", before: "no text", after: "3,150 characters" },
    ],
    lessons: [
      "A single state writes its text straight to Aurora. The run before this one inherited the fleet's S3 sink, stamped 42,645 rows and left every one empty; this run filled them.",
      "A fetch finds no bills. The Senate's API returned 99 bills Aurora does not hold and the loader could only count them as unmatched: every text loader, the states' own feeds included, fills text for bills already on file and adds none. Bills come from discovery, which had not run since September 2, the newest New York action on file.",
      "The box is ready 90 seconds after it is asked for; the ten minutes are the Senate's API, a thousand bills a request.",
    ],
  },
]
