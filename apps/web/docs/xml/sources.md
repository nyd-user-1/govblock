# Sources and fidelity, by jurisdiction

The acquisition review (program brief, decision 6). Tier is measured: the coverage line in `apps/web/lib/xml/coverage.generated.json`, or "not yet measured". Native XML is best; structured HTML or an API tree next; plain text; PDF worst. Front ends land in `apps/web/lib/xml/frontends/`; a jurisdiction without one parses as plain text at the lowest tier.

| Jurisdiction | Source of record | Native XML | Front end | Coverage | Next step up |
|---|---|---|---|---|---|
| US, bills | GovInfo BILLS packages (Bill DTD, USLM 2 for enrolled and public laws), 113th Congress on | yes, 2013 on | `us.ts` | 99.5% | before 2013 there is no XML; plain text stays the tier |
| US, code | OLRC release point, USLM 2 | yes | `us.ts` | pass-through | keep the XML at ingest instead of flattening to `Laws.text` |
| NY, statutes | Senate Open Legislation API (tree + text) | no | `ny.ts` | 97.1% | none needed for structure; the API is first party |
| NY, bills | Senate Open Legislation API, first party (livingston `lv-bills-sync`) | no | `ny.ts` | 99.4% | the Senate API also serves bill text with the marks; same grammar |
| every other state | the legislature's own site or feed, fetched by livingston's worker-box loaders (`~/Code/livingston/ops/box/jobs.d/`: the `state_link` walker for 47 sites; native feeds for CA pubinfo, TX FTP, MA and OH APIs, VA LIS); LegiScan gives the bill index and the link, never the text (corrected 2026-09-20). The state adapters under `scripts/laws/adapters/` for statutes | varies | plain text | not yet measured | derive each grammar from the corpus, in order of corpus size (below) |

The order of the remaining front ends is the order of corpus size, measured in `apps/web/docs/xml/window-3.md`.

## Measured coverage, 2026-09-14

From `apps/web/lib/xml/coverage.generated.json`, the Compiler page's source. Bills are sampled through `Bills` (sponsor memos excluded); statutes through `Laws`. Never sample `BillTexts` by random order over the Data API: five such statements pinned the cluster for forty minutes on the night of 2026-09-14.

| Jurisdiction | Source | Sampled | Clean | Coverage | Top fall-out |
|---|---|---|---|---|---|
| California (CA) | bills | 10 | 10 | 100.0% | — |
| Minnesota (MN) | bills | 16 | 16 | 100.0% | — |
| Texas (TX) | bills | 10 | 10 | 100.0% | — |
| Hawaii (HI) | bills | 16 | 15 | 99.9% | unmatched enumerator · 1 |
| Maryland (MD) | bills | 16 | 15 | 99.8% | subsection d after N · 1 |
| Arizona (AZ) | statutes | 12 | 11 | 99.6% | subsection opens at B · 1 |
| Ohio (OH) | bills | 16 | 15 | 99.6% | subsection opens at H · 1 |
| Arizona (AZ) | bills | 16 | 15 | 99.5% | unmatched enumerator · 2 |
| Congress and the United States Code (US) | bills, native XML | 60 | 51 | 99.5% | — |
| New York (NY) | bills | 60 | 56 | 99.4% | subdivision opens at N · 4 |
| Pennsylvania (PA) | statutes | 12 | 11 | 99.0% | subsection j after N · 1 |
| Florida (FL) | statutes | 12 | 10 | 99.0% | paragraph b after N · 1 |
| Iowa (IA) | bills | 16 | 7 | 98.6% | subsection opens at N · 12 |
| Alabama (AL) | statutes | 12 | 11 | 98.6% | subsection N after N · 2 |
| Texas (TX) | statutes | 12 | 11 | 98.5% | subsection opens at b · 1 |
| California (CA) | statutes | 12 | 10 | 97.9% | subsection j after N · 1 |
| West Virginia (WV) | bills | 16 | 1 | 97.6% | no sections · 15 |
| Arkansas (AR) | statutes | 12 | 10 | 97.4% | paragraph opens at B · 2 |
| New Jersey (NJ) | bills | 16 | 6 | 97.1% | subsection opens at b · 17 |
| Mississippi (MS) | bills | 16 | 10 | 96.7% | unmatched enumerator · 4 |
| Michigan (MI) | bills | 12 | 4 | 96.5% | subsection opens at N · 11 |
| New York (NY) | statutes | 30 | 25 | 96.0% | subdivision N after N · 7 |
| Ohio (OH) | statutes | 12 | 9 | 95.9% | subsection J after N · 1 |
| Pennsylvania (PA) | bills | 16 | 7 | 95.3% | subsection N after N · 11 |
| South Carolina (SC) | bills | 16 | 9 | 95.2% | paragraph opens at C · 3 |
| Georgia (GA) | statutes | 12 | 8 | 94.8% | subsection opens at N · 2 |
| Tennessee (TN) | bills | 16 | 11 | 94.3% | subsection N after N · 8 |
| Washington (WA) | bills | 16 | 5 | 93.7% | unmatched enumerator · 33 |
| Oregon (OR) | bills | 12 | 3 | 92.5% | subsection opens at N · 9 |
| Missouri (MO) | bills | 16 | 0 | 92.4% | no sections · 13 |
| Indiana (IN) | bills | 16 | 5 | 92.0% | subsection N after N · 12 |
| Georgia (GA) | bills | 16 | 7 | 91.8% | subsection opens at H · 9 |
| Illinois (IL) | statutes | 12 | 7 | 91.1% | no number at the start · 4 |
| Alabama (AL) | bills | 16 | 6 | 90.9% | subsection opens at b · 5 |
| North Carolina (NC) | bills | 12 | 2 | 89.5% | no sections · 4 |
| Florida (FL) | bills | 16 | 4 | 88.6% | no sections · 5 |
| Connecticut (CT) | bills | 16 | 3 | 88.1% | no sections · 12 |
| Louisiana (LA) | bills | 16 | 5 | 87.0% | no sections · 5 |
| Oklahoma (OK) | bills | 16 | 3 | 85.8% | paragraph opens at N · 8 |
| Kentucky (KY) | bills | 8 | 0 | 84.9% | no sections · 6 |
| Massachusetts (MA) | bills | 16 | 5 | 82.4% | no sections · 9 |
| Illinois (IL) | bills | 16 | 8 | 82.0% | no sections · 6 |
| Virginia (VA) | bills | 16 | 0 | 77.5% | no sections · 13 |
