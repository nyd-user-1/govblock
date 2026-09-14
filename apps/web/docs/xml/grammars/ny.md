# New York: the grammar

Front end: `apps/web/lib/xml/frontends/ny.ts`. Coverage: `lib/xml/coverage.generated.json`, keys `NY/laws` and `NY/texts`.

New York publishes no legislative XML. Statutes reach the corpus as a tree from the Senate's Open Legislation API (`Laws` rows carry `doc_type`, `depth` and the parent) with each section's text as "§ 1262-u. Heading. Body". Bills reach it as the printed bill, hard-wrapped at 72 columns and justified, with the drafting conventions in the capture: new matter in CAPITALS (underlined in print), omitted matter in [brackets].

The federal standard is imposed by rank (schema.md, the role convention): the USLM element for the rank, New York's own word in `role`.

## Units

| New York | USLM | Signalled by |
|---|---|---|
| Law | `title` | the `Laws` row's `law_id` (AGM, PEN, TAX …) |
| Article | `chapter role="article"` | `doc_type` ARTICLE; its text is the list of sections, read as a `toc` |
| Title (under an article) | `subchapter role="title"` | `doc_type` TITLE |
| Part | `part role="part"` | `doc_type` PART |
| Section | `section` | "§ 1262-u." opening the text; a leading `*` is a note marker, kept as `note="*"` |
| heading | `heading` | the sentence after the number, to the first full stop followed by a capital, a digit, a parenthesis or a section sign |
| Subdivision | `subsection role="subdivision"` | "1.", "A." or "(1)" opening an indented block; "1-a." is an insertion between 1 and 2 |
| Paragraph | `paragraph role="paragraph"` | "(a)" or "a." |
| Subparagraph | `subparagraph role="subparagraph"` | "(i)", read as roman when the open paragraph sequence does not expect the letter |
| Clause | `clause role="clause"` | "(A)" |
| Subclause | `subclause role="subclause"` | "(I)" |
| flush language | `continuation` | a block with no enumerator inside an open level |
| inline nesting | split | "1. (a) The …" becomes the subdivision with the paragraph as its first child |

## Bills

| Part | USLM | Signalled by |
|---|---|---|
| preface | `preface` | everything before the enacting formula: the number (`docNumber`), "Introduced by …" (`sponsor`), "AN ACT …" (`longTitle`) |
| enacting formula | `enactingFormula` | "THE PEOPLE OF THE STATE OF NEW YORK, REPRESENTED IN SENATE AND ASSEMBLY, DO ENACT AS FOLLOWS:" |
| section | `section` | "Section 1." then "§ 2.", strictly in sequence; a "§ 5." out of sequence is quoted law, not a section |
| quoted law | `quotedContent` | the blocks after a section whose instruction ends "as follows:"; inside it gaps and late starts are not faults, since a bill shows only what it amends |
| new matter | `ins` | a run of tokens in CAPITALS with at least one word of two letters or more |
| omitted matter | `del` | [brackets] |
| resolution | `resolution` with `recital` and `resolvingClause` | no enacting formula; "WHEREAS," and "RESOLVED," |

## Measured, 2026-09-14

| Source | Sampled | Clean | Coverage |
|---|---|---|---|
| statutes (`Laws`) | 60 | 53 | 97.1% |
| bills (`BillTexts`, memos excluded) | 60 | 56 | 99.4% (48 bills, 12 resolutions) |

## Known gaps

Statutes: a subdivision numbered from where a repealed one left off ("subdivision opens at 3"), gaps where a repealed unit is omitted from the text, and a handful of sections whose first subdivision is written inline after the heading in a form the split does not catch. Bills: subdivisions in quoted law whose style changes mid-run. Each is listed in the coverage file's `fallouts` with a count.
