# The GovBlock research recipe

How a GovBlock research report is made, so the result does not depend on who
makes it or how the session goes. Written 2026-09-18 from the Clerk's
open-primaries report (`lib/agents/featured.ts`, the 2026-09-07 thread and its
recorded run) and from what failed in the first `/research` reports, which
counted rows and called it research.

A report is judged against this recipe. When one disappoints, the fix is a
named lever below, not a rewrite by feel.

---

## 1. What a report is

A report answers **one question a reader would pay to have answered**, with an
answer the record could have made come out the other way. It reads documents,
not just rows; it sorts what it reads by stated rules; it goes outside the
database when the answer is outside it, and says so; it covers the whole
population in scope, not a sample; and it ends with the method and the gaps.

A report is **not** a profile of a table. "4.3% of PDFs are fillable" is a
statistic. "How many forms stand between a New Yorker and SNAP" is a question.

## 2. The stages

The Clerk's run, generalised. Every report goes through all eight, in order.
Each stage has an output that the next stage consumes; each is recorded in the
report's working notes (section 6) so a report can be re-run or audited.

| # | Stage | The Clerk's step | Output |
|---|---|---|---|
| 1 | **Question** | the request | One question, one sentence, with stakes; the falsifiable core ("did the money line up with the votes?"); the population in scope. |
| 2 | **Coverage** | `coverage` | What the record holds for the population: tables, years, jurisdictions, row counts, and what it does not hold. Written down before any finding. |
| 3 | **Gather** | `search_bills` | Every candidate unit (bill, member, filing, race) pulled with a stated, reproducible query. Over-collect; stage 4 narrows. |
| 4 | **Read and classify** | `classify` | Each unit read (title, summary, text, filing description) and sorted by a written **codebook** into categories that carry meaning (widen / narrow / set aside). The counts of each, and the set-asides with the reason. |
| 5 | **Verify** | `verify` | The load-bearing facts checked against the primary source, one by one: every enactment, every headline number, every named person's vote. A figure that cannot be verified is cut or marked. |
| 6 | **Outside the record** | `congress_gov`, `web_search` | Whatever the answer needs that the database lacks, from named outside sources, cited inline. Conflicting figures are carried side by side and reconciled explicitly, never silently picked. |
| 7 | **Synthesis** | the report text | A thesis in two or three findings, then the sections that support them. Every sentence that states a number is computed from, or checked against, stages 3–6. |
| 8 | **Publish** | `render_pdf`, `deliver_report` | The page on `/research` (numbered layout), its charts in the chart studio, and a card on `/research`. |

Stages 3–5 are where the first `/research` reports failed: they gathered and
went straight to synthesis, with no reading, no codebook and no verification.

## 3. The shape on the page

The numbered layout (`/research/party-line-votes` is the reference):

1. **Headline**: newspaper voice, accurately framed, ideally carrying a number. Not a provocation.
2. **Deck**: one sentence, the population and the question.
3. **Key takeaways**: two to four findings, each a full sentence with its number. The thesis lives here.
4. **Numbered sections**, plain subject titles, no leading "The", no hedges. Each opens with its finding, then the evidence: a chart where the pattern is visual, a table where there are columns.
5. **The whole population in a table** somewhere (every state, every member, every bill that passed) so a reader can find their own case.
6. **Money**, when money is in the question: named payers, named amounts, the source per figure.
7. **Method and gaps**: the query, the codebook, what was verified, what was outside the record and where it came from, what the record lacks.

Voice: third person throughout, never the model's name (the agent is the
Clerk, the publisher GovBlock), no stat tiles, facts forward. See the
`report-voice` memory.

## 4. The levers

When a report needs to change, change one of these and re-run from the stage
it belongs to. Each lever has a default.

| Lever | Stage | What it controls | Default |
|---|---|---|---|
| **Question** | 1 | What is being asked and of whom | One sentence with a yes/no core |
| **Scope** | 1–2 | Population: jurisdictions, years, chambers, cycles | Everything the record holds for the question |
| **Gather rule** | 3 | The query that pulls candidates | Written out in Method; over-collects |
| **Codebook** | 4 | Categories and the rule for each; what is set aside | Stated in Method with counts per category |
| **Reading depth** | 4 | Titles → summaries → full text / filing descriptions | Summaries; full text for anything that passed or is named |
| **Verification bar** | 5 | Which facts must be checked at the primary source | Every enactment, every headline number, every named person |
| **Outside sources** | 6 | Which sources may be used, and the reconciliation rule | Primary sources first (FEC, congress.gov, the Clerks, the legislature); reporting for context, cited |
| **Thresholds** | 4, 7 | Cut-offs that change counts (a "close" race, a "big" donor) | Stated in Method; one number each |
| **Thesis strength** | 7 | How far the synthesis may go beyond the numbers | Only what the numbers carry; correlation called correlation |
| **Length** | 7 | Sections, tables, charts | 4–7 sections, 2–4 charts, one full-population table |
| **Refresh** | 8 | Live recount or a dated snapshot | Live recount daily for record figures; outside figures dated |

## 5. Checks before publishing

- Does the headline answer the question, and is it true in every jurisdiction the page covers?
- Is there a sentence in the takeaways that the record could have contradicted?
- Was anything read, not only counted? Where is the codebook?
- Is every named person's vote or money verified against the primary source?
- Is every outside figure cited next to where it is used?
- Is there a number in the prose that is not computed or checked (a "most", a "nine of ten", a "four days")? Compute it or cut it.
- Would the Method section let someone else reproduce the counts?

## 6. Working notes

Each report keeps its stage outputs beside its code, in
`apps/web/lib/reports/<slug>.ts` (the queries, the codebook as data, the
verified facts with their sources) and in the page's Method section. Adjusting
a lever means editing that stage's entry there and re-running.

## 7. The queue

Proposed 2026-09-18, in order:

1. What did $113 million in crypto money buy? (FEC, roll calls, lobbying)
2. Who wrote the One Big Beautiful Bill? (lobbying descriptions against the enacted sections)
3. Copy-and-paste lawmaking: where model bills became law (model bills against state bill text)
4. Where bills go to die (committees, sponsors, votes across 50 states)
5. The primary is the election (primaries, turnout, incumbents lost)
6. The paperwork wall (forms mapped to the programs they gate)
