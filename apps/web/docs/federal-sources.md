# Federal sources of truth

**Established 2026-09-07.** For the `US` jurisdiction, **congress.gov and govinfo
are primary** for bills, texts, actions, members, committees and votes. LegiScan
is a **supplement**, refreshed from its Sunday bulk dataset, read only for fields
congress.gov and govinfo do not carry.

## Why the switch

We began ingesting legislation from LegiScan before we held congress.gov and
govinfo API keys. LegiScan renumbers every jurisdiction into one universal
scheme, and that scheme collides with the one Congress actually uses:

| LegiScan | congress.gov | reads |
| --- | --- | --- |
| `HB1` | `HR` 1 | H.R. 1 |
| `HR1` | `HRES` 1 | H.Res. 1 |
| `SB1` | `S` 1 | S. 1 |
| `SR1` | `SRES` 1 | S.Res. 1 |
| `HJR`/`SJR` | `HJRES`/`SJRES` | H.J.Res. / S.J.Res. |
| `HCR`/`SCR` | `HCONRES`/`SCONRES` | H.Con.Res. / S.Con.Res. |

H.R. 155 is the Let America Vote Act; H.Res. 155 is a Ukraine measure. A reader
who typed the citation congress.gov prints — and that every news story quotes —
was handed a different document under the number they asked for.

The titles diverge too. LegiScan's row for US `HB1` in 2025-2026 was titled
"FEHB Protection Act of 2025", which is a short title congress.gov files for
*one subtitle* of H.R. 1, not the reconciliation act itself. congress.gov gives
the popular title ("One Big Beautiful Bill Act") and the official title, and its
latest action runs days ahead of the mirror's.

Verified 2026-09-07: `congress_bills` holds 18,607 rows for the 119th, its
counts match congress.gov to within a few sync-lag rows, and where both hold a
bill the `bill_number` agrees on every one of the 18,470 linked rows.

## What congress.gov is primary for

`congress_bills` and the `congress_*` family are read first for a US bill's
identity, title, popular title, policy area, introduced date and latest action.
The switch happens in three places, each carrying a comment back to this file:

- `lib/policy/congress.ts` — the two schemes, in one module the browser can read.
  `billCitation`, `citationOf`, `congressCitation`, `congressOf`, `congressKey`.
  Everything that prints, parses or joins a federal bill number reads these.
- `lib/policy/queries.ts` — `getBill` left-joins `congress_bills` and coalesces
  title, description, latest action and citation. This is the bill page's read.
- `lib/policy/db-queries.ts` — `getUsBill` resolves a typed citation through
  `congress_bills` first; `getBills` coalesces the latest action; `getBill`
  carries the citation. This is the API and the agent tools' read.

`fmtBill(number, state)` is the single formatter: pass the jurisdiction and a
federal number prints as congress.gov prints it.

## What LegiScan is still the record for

- **The 50 states.** LegiScan is the only source we hold, and its universal
  scheme is not in conflict there.
- **Congresses before the 119th.** `congress_bills` holds the 119th and nothing
  else, so a 118th-Congress bill answers from the mirror, its citation
  translated from the prefix rather than read off a congress.gov row.
- **Bill text, roll calls, subjects, calendar and same-as** for federal bills,
  where the mirror carries rows congress.gov's API does not expose the same way.
- **`bill_id`.** Every surface, URL and foreign key in the app is keyed on
  LegiScan's `bill_id`, and stays that way. `congress_bills.bill_id` is the
  adapter: congress.gov identity on one side, our id on the other. A bill
  congress.gov holds and the mirror has not picked up yet answers from
  `congress_bills` alone, through `getCongressOnlyBill`.

## Federal lobbying

`LobbyingBills` is re-keyed onto congress.gov identity: a stored generated
`congress_key` computed from the filing's own citation, so the join needs no
mirror in the path. See `sql/002_lobbying_congress_key.sql`, which carries the
audit that preceded it, and `lib/policy/lobbying-queries.ts`.

## Roll-call votes

**The House.** congress.gov's `/v3/house-vote` endpoint is the source, and it
answers four congresses: the 116th (954 votes), 117th (998), 118th (1,241) and
119th (657). `congress_house_votes` holds the 119th complete — roll 1 to 362 in
the first session and 1 to 295 in the second, contiguous, every one with its
positions — and **nothing** of the 116th through the 118th. That is 3,193 House
roll calls and roughly 1.4 million positions we could have and do not; the
backfill belongs beside the nightly harvest that writes the table, not in a
page.

**The Senate.** congress.gov publishes no Senate vote endpoint at all. The
Senate's own XML is the only machine-readable record:

- list: `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_<congress>_<session>.xml`
- vote: `https://www.senate.gov/legislative/LIS/roll_call_votes/vote<congress><session>/vote_<congress>_<session>_<nnnnn>.xml`

Loaded by `scripts/senate-votes/load.mjs` into `congress_senate_votes` and
`congress_senate_vote_positions`: 890 votes of the 119th, 88,988 positions, every
one matched to a bioguide and a `people_id`. A vote on an amendment names the
amendment as its document and the bill it amends in the amendment block, so the
loader reads `amendment_to_document_number` to key it — without that, 24 of the
Senate's 44 votes on H.R. 1 had no bill.

## Legislative actions

Audited against congress.gov's own taxonomy in `action-taxonomy-audit.md`.
