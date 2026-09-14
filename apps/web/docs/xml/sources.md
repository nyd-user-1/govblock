# Sources and fidelity, by jurisdiction

The acquisition review (program brief, decision 6). Tier is measured: the coverage line in `apps/web/lib/xml/coverage.generated.json`, or "not yet measured". Native XML is best; structured HTML or an API tree next; plain text; PDF worst. Front ends land in `apps/web/lib/xml/frontends/`; a jurisdiction without one parses as plain text at the lowest tier.

| Jurisdiction | Source of record | Native XML | Front end | Coverage | Next step up |
|---|---|---|---|---|---|
| US, bills | GovInfo BILLS packages (Bill DTD, USLM 2 for enrolled and public laws), 113th Congress on | yes, 2013 on | `us.ts` | 99.5% | before 2013 there is no XML; plain text stays the tier |
| US, code | OLRC release point, USLM 2 | yes | `us.ts` | pass-through | keep the XML at ingest instead of flattening to `Laws.text` |
| NY, statutes | Senate Open Legislation API (tree + text) | no | `ny.ts` | 97.1% | none needed for structure; the API is first party |
| NY, bills | Senate Open Legislation text (via LegiScan) | no | `ny.ts` | 99.4% | the Senate API also serves bill text with the marks; same grammar |
| every other state | LegiScan captures (HTML and PDF as text), the state adapters under `scripts/laws/adapters/` for statutes | varies | plain text | not yet measured | derive each grammar from the corpus, in order of corpus size (below) |

The order of the remaining front ends is the order of corpus size, measured in `apps/web/docs/xml/window-3.md`.

## Measured coverage, 2026-09-14

From `apps/web/lib/xml/coverage.generated.json`, the Compiler page's source. Bills are sampled through `Bills` (sponsor memos excluded); statutes through `Laws`.

| Jurisdiction | Source | Sampled | Clean | Coverage | Top fall-out |
|---|---|---|---|---|---|
| Minnesota (MN) | bills | 16 | 16 | 100.0% | — |
| Hawaii (HI) | bills | 16 | 15 | 99.9% | unmatched enumerator · 1 |
| Maryland (MD) | bills | 16 | 15 | 99.8% | subsection d after N · 1 |
| Arizona (AZ) | bills | 16 | 15 | 99.5% | unmatched enumerator · 2 |
| Congress and the United States Code (US) | bills, native XML | 60 | 51 | 99.5% | — |
| New York (NY) | bills | 60 | 56 | 99.4% | subdivision opens at N · 4 |
| California (CA) | bills | 24 | 20 | 99.2% | subsection j after N · 5 |
| Iowa (IA) | bills | 16 | 7 | 98.6% | subsection opens at N · 12 |
| New York (NY) | statutes | 50 | 42 | 97.8% | paragraph opens at b · 3 |
| West Virginia (WV) | bills | 16 | 1 | 97.6% | no sections · 15 |
| Texas (TX) | bills | 24 | 21 | 96.9% | subsection N after N · 9 |
| New Jersey (NJ) | bills | 24 | 11 | 96.8% | paragraph opens at N · 9 |
| Mississippi (MS) | bills | 16 | 10 | 96.7% | unmatched enumerator · 4 |
| South Carolina (SC) | bills | 16 | 9 | 95.2% | paragraph opens at C · 3 |
| Tennessee (TN) | bills | 16 | 11 | 94.3% | subsection N after N · 8 |
| Pennsylvania (PA) | bills | 24 | 12 | 94.0% | paragraph N after N · 7 |
| Washington (WA) | bills | 16 | 5 | 93.7% | unmatched enumerator · 33 |
| Missouri (MO) | bills | 16 | 0 | 92.4% | no sections · 13 |
| Indiana (IN) | bills | 16 | 5 | 92.0% | subsection N after N · 12 |
| Georgia (GA) | bills | 16 | 7 | 91.8% | subsection opens at H · 9 |
| Alabama (AL) | bills | 16 | 6 | 90.9% | subsection opens at b · 5 |
| Michigan (MI) | bills | 16 | 4 | 90.3% | no enacting formula · 12 |
| North Carolina (NC) | bills | 16 | 0 | 88.8% | no enacting formula · 16 |
| Connecticut (CT) | bills | 16 | 1 | 88.7% | no sections · 9 |
| Ohio (OH) | bills | 16 | 6 | 86.7% | subsection N after N · 9 |
| Florida (FL) | bills | 16 | 1 | 84.7% | no sections · 14 |
| Oregon (OR) | bills | 16 | 1 | 84.7% | paragraph opens at N · 15 |
| Louisiana (LA) | bills | 16 | 9 | 84.3% | paragraph N after N · 4 |
| Kentucky (KY) | bills | 16 | 1 | 82.1% | no sections · 15 |
| Virginia (VA) | bills | 16 | 3 | 77.4% | no sections · 13 |
| Massachusetts (MA) | bills | 24 | 4 | 73.7% | no sections · 14 |
| Illinois (IL) | bills | 24 | 12 | 70.3% | no sections · 8 |
| Oklahoma (OK) | bills | 16 | 1 | 69.8% | paragraph a after N · 9 |
