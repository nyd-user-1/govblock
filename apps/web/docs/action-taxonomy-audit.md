# Legislative-action taxonomy audit

**Run 2026-09-07** against `congress_bill_actions`: 71,239 actions on 18,602
bills of the 119th Congress, 55,123 of them carrying a Library of Congress
action code, 94 distinct codes, 1,318 carrying a roll-call number.

Measured against congress.gov's own "All Legislative Actions" taxonomy, which is
kept verbatim in `docs/prompts/_congress-action-taxonomy.md`.

## Coverage: every action-type group is captured

BILLSTATUS types every action, and all ten of its type values are present:

| congress.gov group | `action_type` | actions | bills |
| --- | --- | ---: | ---: |
| Introduction and Referral | `IntroReferral` | 48,943 | 18,382 |
| Floor Consideration | `Floor` | 10,641 | 1,656 |
| Committee-Related Activity | `Committee` | 9,265 | 3,943 |
| Floor Consideration (calendar placement) | `Calendars` | 1,395 | 1,279 |
| Committee-Related Activity (discharge) | `Discharge` | 390 | 352 |
| To President | `President` | 330 | 114 |
| Became Law | `BecameLaw` | 208 | 105 |
| Resolving Differences | `ResolvingDifferences` | 42 | 11 |
| — | `NotUsed` | 15 | 10 |
| Veto Consideration | `Veto` | 10 | 2 |

Two groups in congress.gov's filter list are **not** `action_type` values, by
design of BILLSTATUS, and are held elsewhere:

- **Amendment Actions** live in `congress_amendment_actions`, keyed to
  `congress_amendments`, because an amendment is its own document with its own
  action history. Nothing is missing; it is filed under the amendment.
- **Roll Call Votes** ride on the action that produced them —
  `roll_number`, `roll_chamber`, `roll_session`, `roll_url` on 1,318 actions —
  and in full in `congress_house_votes` and `congress_senate_votes`.

**Gap.** `NotUsed` is not a congress.gov category: BILLSTATUS files codes 19500
and 20500 under it although their text reads "Resolving differences -- House
actions" / "-- Senate actions". Seventeen of the 119th's 59 resolving-differences
actions carry it. The display now reads the code before the type (below).

## Display: three stages the tracker flattened

`BillTracker` derives congress.gov's Status of Legislation from the Library's
numeric action codes. Three real stages were being lost.

1. **Failure was not a stage at all.** Codes `9000` ("Failed of passage/not
   agreed to in House", 21 actions) and `18000` (Senate, 8 actions) mapped to
   nothing, so a bill the House voted down drew the identical tracker to a bill
   still sitting in committee — Introduced reached, everything after it grey.
   H.R. 1329, voted down in the House on 2026-05-21, was one of them.
   **Fixed:** a failed rung is drawn as failed, under the name of the failure,
   and the ladder stops there.

2. **Vetoed was computed and then discarded.** `STAGE_BY_TYPE` mapped the `Veto`
   type to a "Vetoed" stage, but `ladder()` never listed "Vetoed" among the
   rungs, so the value was dropped every time. Both vetoed bills of the 119th —
   H.R. 131 and H.R. 504 — showed "To President" reached and "Became Law" grey,
   which reads as *pending* rather than *refused*.
   **Fixed:** Vetoed is the failed reading of the Became Law rung. Code `33000`
   ("Failed of passage in House over veto") reaches it too.

3. **Conference was read off the type alone**, so the seventeen actions
   BILLSTATUS mistypes as `NotUsed` were invisible. **Fixed:** codes `19500` and
   `20500` map to Conference directly; the type is the fallback.

## Deliberate flattenings, left as they are

- **Introduction and Referral is one rung.** congress.gov's own tracker does the
  same; the referral itself is on the Actions list and in the Committees block.
- **Reported / Committee discharged is not a rung.** congress.gov's tracker has
  no committee step either. The 710 reporting actions and 146 discharges are on
  the Actions list, and the Committees block names the activity.
- **Private Law is drawn as Became Law.** Code `E40000` covers both; the 119th
  has 2 private laws against ~104 public ones, and the action's own text names
  which. A rung for two bills would cost every other bill a column.

## What is not held

- **Actions before the 119th.** `congress_bill_actions` holds the 119th and
  nothing else, as the whole `congress_*` family does. A 118th-Congress bill's
  history comes off the LegiScan mirror's `History Table`, which has no action
  codes and therefore no tracker.
