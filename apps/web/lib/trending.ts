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
