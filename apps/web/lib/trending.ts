// What the country is legislating about (Brendan, 2026-09-22: a reader who has
// not signed in has no recent searches, so the bar shows trending instead).
//
// How the list was arrived at, so it can be made again. "Trending" here is
// reach before volume: a phrase counts if it turns up in bill titles across
// most of the 52 jurisdictions, and among those, the one with more bills
// behind it ranks higher. A phrase in 4,000 bills in one state is a local
// fight; one in 50 legislatures at once is the thing the country is arguing
// about. Measured over every bill titled in a session of 2025 or later —
// 267,357 of them — with a single pass counting, per candidate phrase, the
// bills whose title carries it and the jurisdictions those bills come from:
//
//   select count(*) filter (where title ilike '%artificial intelligence%'),
//          count(distinct state) filter (where title ilike '%artificial intelligence%')
//   from "Bills" where session_id >= 2025 and title is not null
//
// Frozen here rather than asked for on every load: the root reads nothing from
// the database (lib/policy/db.ts's rule), and this moves over a session, not
// over an hour. Run the pass again when the sessions turn over.
//
// The candidates were a policy vocabulary of forty phrases; these eight are
// what survived, each in at least 49 jurisdictions, with near-duplicates
// dropped ("healthcare" behind "health care", "affordable housing" behind
// "housing"). Brendan's own guess — that artificial intelligence would be
// trending across all fifty states — measured at 50 of 52.

export type Trending = { term: string; /** Jurisdictions whose bills carry it. */ places: number; /** Bills whose title carries it. */ bills: number }

export const TRENDING: Trending[] = [
  { term: "housing", places: 52, bills: 4070 },
  { term: "health care", places: 52, bills: 2904 },
  { term: "firearm", places: 52, bills: 2118 },
  { term: "elections", places: 52, bills: 1868 },
  { term: "property tax", places: 51, bills: 2374 },
  { term: "mental health", places: 51, bills: 1949 },
  { term: "child care", places: 49, bills: 1147 },
  { term: "artificial intelligence", places: 50, bills: 837 },
]

/** When the pass above was last run, for the line under the heading. */
export const TRENDING_AS_OF = "2026-09-22"

// Where a subject is actually being legislated (Brendan, 2026-09-22), for the
// cards under the root's search bar. The eight above are reach — a phrase in
// most of the 52. These sixteen are the opposite question: which one
// legislature is arguing about a thing far past its share.
//
// How they were arrived at. One pass over the same 267,357 bills titled in a
// session of 2025 or later, counting fifty candidate phrases per jurisdiction
// in a single scan, plus each jurisdiction's own total:
//
//   select state, count(*)::int as total,
//          count(*) filter (where title ilike '%coal%')::int as p0, ...
//   from "Bills" where session_id >= 2025 and title is not null group by 1
//
// Ranking on the raw count only found the biggest legislature: New York came
// top for 26 of the 50, because New York files the most bills, not because the
// fights are in New York. So a place is ranked on lift — the share of its own
// bills carrying the phrase against the national share — with a floor of 20
// bills so a card is never built on a handful, and at most two cards to a
// jurisdiction so the flags vary. That is what puts coal in West Virginia at
// 12.8x and wildfire in California at 11x.
//
//   term                place  bills   national  places   lift
//   coal                   WV     33        121      24   12.8x
//   wildfire               CA     65        313      24   11.0x
//   zoning                 NC     37        580      49    7.3x
//   tribal                 WA     26        300      31    6.8x
//   charter school         IA     79        791      47    6.3x
//   oil and gas            OK     35        172      23    5.9x
//   property tax           KS     73       2374      51    5.5x
//   tourism                HI    109        545      44    5.2x
//   eminent domain         TX     61        267      40    5.0x
//   homelessness           HI     47        255      42    4.8x
//   nursing home           CT     29        319      34    4.5x
//   cannabis               ME     38        969      44    4.3x
//   human trafficking      NJ     69        468      47    3.6x
//   agriculture            OK    155       1237      50    3.6x
//   fentanyl               US     51        201      38    3.6x
//   abortion               AZ     27        506      47    3.5x
//
// Two phrases were checked again with word-anchored matching, because a
// substring caught the wrong word: `mining` was counting "determining" — 327 of
// its 496 — and fell out of the list entirely, and `coal` was counting
// "coalition". The anchored pass is what picked the places; West Virginia leads
// coal on 33 bills strictly counted, which is why it is here at all.
//
// The number on a card is the number the page will print beside the results,
// though, so it is the search's own — the same `ilike` the bar runs. For
// fifteen of the sixteen the two readings are the same figure; coal reads 38
// rather than 33 because the search finds "coalition" too. A card that promised
// a count its own search would not show is the bug this list exists to avoid,
// so where they differ the search wins. Checked card by card against
// /api/policy/search on 2026-09-22.

export type TrendingPlace = {
  term: string
  /** The jurisdiction arguing about it hardest, as a two-letter code. */
  place: string
  /** Bills in that jurisdiction whose title carries the term. */
  bills: number
}

export const TRENDING_PLACES: TrendingPlace[] = [
  { term: "coal", place: "WV", bills: 38 },
  { term: "wildfire", place: "CA", bills: 65 },
  { term: "zoning", place: "NC", bills: 37 },
  { term: "tribal", place: "WA", bills: 26 },
  { term: "charter school", place: "IA", bills: 79 },
  { term: "oil and gas", place: "OK", bills: 35 },
  { term: "property tax", place: "KS", bills: 73 },
  { term: "tourism", place: "HI", bills: 109 },
  { term: "eminent domain", place: "TX", bills: 61 },
  { term: "homelessness", place: "HI", bills: 47 },
  { term: "nursing home", place: "CT", bills: 29 },
  { term: "cannabis", place: "ME", bills: 38 },
  { term: "human trafficking", place: "NJ", bills: 69 },
  { term: "agriculture", place: "OK", bills: 155 },
  { term: "fentanyl", place: "US", bills: 51 },
  { term: "abortion", place: "AZ", bills: 27 },
]
