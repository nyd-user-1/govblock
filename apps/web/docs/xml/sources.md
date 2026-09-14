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
