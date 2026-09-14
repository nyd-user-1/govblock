# The XML reader: fidelity and performance

Window 1, 2026-09-14. The XML view (`/workspace/typeset/bill/{id}/xml`) against
the Typeset view on the same printing, on the same server: the branch's dev
server in `~/govblock-xml` on the box, port 3002. Numbers from
`scripts/typeset/xml-reader-measure.mjs` and `/api/typeset/uslm-parse`.

## H.R. 6644, the House amendment

`/us/bill/119/hr/6644@2026-05-20_eah`, the printing Typeset opens by default.
Bill DTD, 561 KB.

### Structure

| | Source XML | XML reader | Typeset (Plate) HTML |
|---|---|---|---|
| titles | 12 | 12 `title` | 69 `h2`, shared with sections |
| sections | 67 | 67 `section` | (in the 69 `h2`) |
| subsections | 245 | 245 `subsection` | 204 `h3` |
| paragraphs | 548 | 548 `paragraph` | 259 `h4` |
| subparagraphs | 603 | 603 `subparagraph` | 147 `h5` |
| clauses, subclauses, items | 388, 114, 27 | 388 `clause`, 114 `subclause`, 27 `item` | 109 `h6`, all three ranks at one level |
| levels with no heading | 1,215 | typed levels with a `num` | 1,216 paragraphs led by a bold number |
| chapeaux | (first `text` of 379 levels with children) | 379 `chapeau` | ordinary paragraphs |
| quoted amendments | 90 `quoted-block` | 90 `quotedContent` | 90 `blockquote` |
| text closing a quotation ("; and") | 90 `after-quoted-block` | 90 `continuation` | **0: dropped** |
| table of contents entries | 73 | 73 `referenceItem` | paragraphs |
| citations | 250 | 250 `ref`, `href` in the address scheme | 238 links |
| rank violations | | 0 | |
| unknown elements | | 1 (`engrossed-amendment-form`, drawn as the preface) | |

Where the Typeset HTML is structurally wrong, and the XML view is not:

- **Level type is gone.** A heading's rank in the HTML is the level's
  nominal depth plus how deep it sits in quotations, capped at `h6`
  (`lib/policy/bill-uslm.ts`, `LEVEL`). A subsection inside a quoted
  amendment and a paragraph of the bill's own are both `h4`; clauses,
  subclauses and items are all `h6`. The XML view keeps each element's type,
  and the schema refuses a clause inside a clause.
- **Levels without a heading become paragraphs.** 1,216 of the HTML's 1,906
  paragraphs are a level whose number was set in bold at the front of its
  text; nothing marks where that level ends or what it holds. In the XML view
  each is a level node holding its own children.
- **The words that close a quotation are dropped.** `uslmToHtml` renders
  `after-quoted-block` as an empty string, so the 90 `”; and` and `”.` that end
  each quoted amendment are missing from the Typeset page. The XML view
  keeps all 90.
- **Chapeau and continuation are not distinguishable from content.** An
  amendment edits the introductory line over a list separately from the list;
  the HTML has no way to say which paragraph that is. The XML view has 379
  `chapeau` nodes and 90 `continuation` nodes.
- **Citations become outside links only where Cornell or congress.gov can be
  guessed.** The XML view carries every `ref` as an address
  (`/us/usc/t42/s1437f`) and links the ones with an official page; the `@`
  resolver will serve the rest in Typeset.

### Time and bytes

| | XML view | Typeset view |
|---|---|---|
| build on the server | front end 41 ms, `uslmToDoc` 145 ms, HTML 307 ms (GovInfo fetch cached) | — (stored in `typeset_documents`; 1.3–1.8 s to build, typeset-perf) |
| document route, first / after | `/api/typeset/xml` 1,266 ms / 71 ms | `/api/typeset/content` 5,336 ms / 81 ms |
| payload | 1.06 MB JSON, 159 KB gzipped | 357 KB HTML JSON, parsed in the browser into Slate |
| first-paint markup | 1.06 MB HTML | 1.1 MB snapshot |
| page, warm (three and two requests) | 593, 291, 274 ms; 2.60 MB | 285, 658 ms; 2.83 MB |

The page is the same speed as Typeset's warm and 230 KB smaller, with the
document on screen from the server's HTML before any script runs.

JSON and HTML were 1.84 MB and 1.23 MB in the first build: every node carried
its unset attributes, and each level's identifier and GPO's random ids were
written twice. `docToJson` leaves unset attributes out, and the HTML writes the
identifier once, as the element's `id`.

## H.R. 2289, as reported in the House

`/us/bill/119/hr/2289@2026-04-15_rh`, the American Broadband Deployment Act:
a bill made of amendments to existing law. Bill DTD, 160 KB.

| | Source XML | XML reader | Typeset HTML |
|---|---|---|---|
| sections | 18 | 18 | 18 `h2` |
| subsections … subitems | 46, 101, 129, 116, 80, 26, 15 | each typed | 25 `h3`, 52 `h4`, 40 `h5`, 121 `h6` |
| levels with no heading | 279 | typed levels | 280 paragraphs led by a bold number |
| chapeaux | | 115 | — |
| quoted amendments, closings | 13, 13 | 13 `quotedContent`, 13 `continuation` | 13 `blockquote`, **0 closings** |
| rank violations | | 0 | |
| order notes | | 1: the amended long title printed after the body, read as a paragraph where it stands | |

Build: front end 7 ms, `uslmToDoc` 23 ms, HTML 85 ms. Page warm: XML 709 ms,
Typeset 630 ms; 889 KB and 875 KB.

## Enrolled bill, USLM 2

H.R. 6644's enrolled bill (`BILLS-119hr6644enr`, 1.08 MB of native USLM)
through the same path: 72 sections, 285 subsections, 684 paragraphs, 762
subparagraphs, 454 clauses, 117 subclauses, 33 items, 439 chapeaux, 88 quoted
amendments, 541 `amendingAction`s and 917 `inline` runs carried as marks, 0
rank violations. Front end 47 ms, `uslmToDoc` 111 ms.

The Typeset reader cannot draw this printing from its XML at all:
`uslmToHtml` looks for the Bill DTD's `legis-body` and returns nothing for
USLM 2's `main`, so an enrolled bill or a public law opens in Typeset from its
stored plain text. Checked with the old and the new parser (below): both
return nothing.

## One parser

`lib/policy/bill-uslm.ts` now reads XML with `lib/xml/ir.ts`'s parser, which
decodes entities as it parses, and no longer decodes a second time. The
Typeset HTML is byte-identical before and after on H.R. 6644 as introduced
(138,516 bytes) and as amended by the House (355,106), H.R. 2289 as reported
(102,003), and the enrolled bill (nothing, both times).

## A state bill: the fallback

New York A11559 (bill 2152620) has no XML. Through the New York front end it
reads as 810 paragraphs with 37 `ins` and 2 `del` marks; through the
plain-text front end, as 152 generic levels with their numbers and 144
headings. Either way the page draws it and the line over the document says the
levels were read from plain text.

The stored text of that printing is the Assembly's web page, navigation and
all ("Skip to main content", "Javascript must be enabled"), not the bill. That
is the source, not the reader, and it belongs to the pipeline's acquisition
review for New York.

## Texas and California, on the state front ends

Against `4d4e888`, the front ends the pipeline stores with. Each printing's
stored text through its state's front end, `uslmToDoc`, and both round trips
(the compact JSON through `Node.fromJSON`; the first-paint HTML through the
schema's parse rules). Run as a script on the box: these states are outside
the free scope, so the page needs an entitled reader.

| Printing | Coverage | What the reader holds | Refused | Violations | Round trips |
|---|---|---|---|---|---|
| TX H.B. 18, enrolled, `/us-tx/bill/2025s2/hb/18` | 80% | 3 sections, 9 subsections, 7 paragraphs, 7 subparagraphs, 8 continuations; `enactingFormula` | nothing | 0 | exact, exact |
| TX H.R. 128, enrolled | 100% | `resolvingClause`, 27 p, 3 `del` (the struck "[or]", "[the]", "[of $500]") | nothing | 0 | exact, exact |
| CA A.B. 1607, enrolled, `/us-ca/bill/2025/ab/1607` | 100% | 2 sections, 11 subsections, 7 paragraphs, 7 subparagraphs; `enactingFormula` | nothing | 0 | exact, exact |
| CA A.B. 2052, enrolled | 85% | 2 sections, 22 subsections, 10 paragraphs, 7 continuations; `longTitle`, `enactingFormula` | nothing | 0 | exact, exact |
| CA S.B. 908, enrolled (`state_link`) | 96% | 48 p: the stored text is leginfo's web page | nothing | 0 | exact, exact |

Build under 8 ms for the front end and under 8 ms for `uslmToDoc` on each.

What the state front ends still get wrong, on these printings at `4d4e888`:
none of the three amending bills has a `quotedContent`. The instruction
and the first quoted line share one block ("…to read as follows: SUBCHAPTER
G. PROHIBITED ACTIONS…", "…is amended to read: 76000.5.") or the instruction
is a `continuation` followed by the section number as another ("1050."), and
the amended Code's subdivisions are drawn as the bill section's own. The
California enacting formula is split mid-phrase: "The people of the State of
California" stays in the preface and "do enact as follows:" is the formula.

## Not measured here

- **Cold load to readable and editor mount in the browser.** typeset-perf
  drove headless Chromium on the Mac; the box has no browser, and the Mac
  runs no local build. The reader records it on its root instead:
  `[data-xml-reader]` carries `data-json-ms` (JSON fetched and parsed) and
  `data-mount-ms` (the Tiptap editor holding the document), from the
  component's first render. Read them in devtools.
- **Keystroke latency.** The XML view is read-only tonight.
