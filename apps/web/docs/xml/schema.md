# Legislative XML: the address and the schema

The shared contract for every window on `feature/legislative-xml`. The
pipeline stores by the address, the library browses by it, the `/` command and
the `@` resolver parse it, and the reader's ProseMirror schema is the node list
below. Window 1 owns this file; a change to the address after the pipeline has
stored rows is a migration, so ask in a report first.

Status: the address is frozen as of 2026-09-14 05:00 EDT. The node list is v0,
taken from `uslm-2.0.17.xsd` (the schema GovInfo's own bills declare) and
checked against H.R. 6644; it is refined below as the reader is measured
against more of the corpus.

## 1. The address

### Form

USLM's referencing model is the federal profile of Akoma Ntoso's naming
convention: the same FRBR parts (Work, portion, expression date,
manifestation) written as a path. Every federal USLM document already carries
these paths in its `identifier` attributes (`/us/bill/119/hr/6644/tI/s101`,
`/us/usc/t10/s130i/a/1`), so the corpus uses USLM's form for every
jurisdiction. Federal documents keep their identifiers untouched, a
`<ref href="/us/usc/t42/s1437f">` resolves with no rewrite, and a state
document is written with the same kind of path.

```
address      = work [ portion ] [ "@" expression ] [ "." format ]
work         = "/" jurisdiction "/" kind "/" work-path
portion      = 1*( "/" segment )          ; inside the Work, USLM level path
expression   = date [ "_" stage ]         ; date is ISO 8601, YYYY-MM-DD
format       = "xml" | "html" | "md" | "txt" | "pdf" | "json"
segment      = 1*( ALPHA / DIGIT / "." / "-" )
```

Akoma Ntoso's IRI for the same thing is a rewrite, never a second key:
`/us/bill/119/hr/6644@2025-12-11_ih` is
`/akn/us/bill/119/hr-6644/eng@2025-12-11_ih`. The `/akn/` form is emitted
only where a consumer asks for Akoma Ntoso.

### Jurisdiction

| Jurisdiction | Segment |
|---|---|
| Congress, the US Code, federal law | `us` |
| A state | `us-` + the two-letter code, lower case: `us-ny`, `us-ca` |
| The District of Columbia | `us-dc` |

ISO 3166-2 subdivision codes, which is what Akoma Ntoso uses for a
subdivision. `"Bills".state` and `"Laws".state` map by lower-casing
(`NY` → `us-ny`, `US` → `us`).

### Kind

| Kind | What | Work path | Source today |
|---|---|---|---|
| `bill` | bills and resolutions of every type | `<session>/<type>/<number>` | `Bills`, `BillTexts`, `congress_text_formats` |
| `usc` | the United States Code (federal only) | `t<title>/s<section>` | `Laws` where state `US` |
| `code` | a state's codified or consolidated law | `<code>/s<section>` | `Laws` |
| `const` | a constitution | `art<article>/s<section>` | `Laws` (New York `CNS`, and the rest as found) |
| `pl` | a federal public law (USLM native) | `<congress>/<number>` | `congress_text_formats` "Public Law" |
| `law` | a state session law or chapter law (reserved, not loaded tonight) | `<session>/ch<chapter>` | none yet |

### Sessions

| Jurisdiction | Session segment | From |
|---|---|---|
| Congress | the Congress number: `119` | `congress_text_formats.congress`; `"Bills".session_id` 2025 is the 119th |
| A state, regular session | the session's first year: `2025` | `"Bills".session_id` |
| A state, special session | first year, `s`, the ordinal: `2025s1` | the ordinal in `session_title` ("2025 1st Special Session"); with no ordinal in the title, `2025s-<legiscan_session_id>` |

A session is a prefix of Works, not a Work: `/us/bill/119` is every bill of
the 119th Congress, `/us-la/bill/2024s3` every bill of Louisiana's third
special session of 2024.

### Bill type and number

`"Bills".bill_number` splits into leading letters and the rest:
`/^([A-Za-z]+)\s*(.+)$/`. The type is the letters in lower case. The number
has leading zeros stripped from each run of digits, and any character outside
`[A-Za-z0-9.-]` becomes `-`.

| `bill_number` | Address |
|---|---|
| US `HB6644` | `/us/bill/119/hr/6644` (federal types take GPO's codes: `hr`, `s`, `hjres`, `sjres`, `hconres`, `sconres`, `hres`, `sres`; LegiScan's `HB`→`hr`, `SB`→`s`, `HJR`→`hjres`, `SJR`→`sjres`, `HCR`→`hconres`, `SCR`→`sconres`, `HR`→`hres`, `SR`→`sres`) |
| NY `S07721` | `/us-ny/bill/2025/s/7721` |
| NY `A01234` | `/us-ny/bill/2025/a/1234` |
| CA `AB1` | `/us-ca/bill/2025/ab/1` |
| DC `B26-0123` | `/us-dc/bill/2025/b/26-123` |

### Expression

`@<date>` is the date the text is as of. `_<stage>` names the printing where a
jurisdiction prints a bill more than once.

| Kind | Date | Stage |
|---|---|---|
| federal bill | the printing's date (`congress_text_formats.version_date`; where that is null, as for H.R. 6644's enrolled bill, GovInfo's `dateIssued` for the package) | GPO's version code from the package id, lower case: `BILLS-119hr6644ih` → `ih`; `eh`, `rh`, `pcs`, `eah`, `eas`, `enr` |
| state bill | the printing's date (`"Documents".date`, else the BillHistory action that produced it) | the printing's name as a slug: `introduced`, `amended`, `engrossed`, `enrolled`, `chaptered`; where the legislature letters its amendments (New York `S7721A`) the letter, `a` |
| a statute section | the date the text stood: `"Laws".active_date`, else the date the source published it (the OLRC release point's date for the US Code) | none |
| a fork (window 5) | the commit's date | the commit id |

Two printings with the same date and stage take `-2`, `-3` in `document_id`
order: `@2025-03-04_amended-2`. An expression date the pipeline had to infer
is marked in `expressions`, not in the address.

### Statute sections, and portions

A section's Work path is its section number under the code:
`/us/usc/t10/s130i`, `/us-ny/code/agm/s3`. Sections are addressed flat under
the code, not under their chapter or article, because that is how USLM
addresses the US Code and because a section's number, not its place in the
outline, is what a citation names. The code segment is `"Laws".law_id` in lower
case (`AGM`, `EDN`, `T28`); the US Code's `USC10` is `t10`, and its appendix
titles `USC05A` → `t5a`.

Where a code numbers sections within a container rather than across the code
(New York's Constitution restarts at section 1 in every article; Massachusetts
restarts in every chapter), the section is addressed under that container:
`/us-ny/const/artI/s1`, `/us-ma/code/gl/ch93A/s2`. Window 3's front end
declares a code's section scope; the default is code-wide. A code-wide number
that repeats is either one Work at two expressions (Texas prints a section
twice, "text of section effective until" a date and after it) or a front end
that has the scope wrong, and the load reports it rather than guessing.

Containers are addressed by their level path from the code:
`/us-ny/code/edn/art14`, `/us/usc/t34/stI/ch101`. Level prefixes are USLM's,
as the OLRC writes them in its identifiers:

| Level | Prefix | Level | Prefix |
|---|---|---|---|
| title | `t` | division | `d` |
| subtitle | `st` | subdivision | `sd` |
| chapter | `ch` | article | `art` |
| subchapter | `sch` | subarticle | `sart` |
| part | `pt` | section | `s` |
| subpart | `spt` | rule | `r` |

`"Laws".doc_type` maps onto these (`CHAPTER` → `ch`); a doc type USLM does not
name keeps its own name lower-cased (`UNIT` → `unit`). Numbers keep the case
they are printed in (`tI`, `s1395w-4`), because Roman numerals and lettered
sections depend on it.

Below the section, levels take no prefix, as USLM writes them: the number
itself, stripped of parentheses, periods and dashes around it:
`/us/usc/t10/s130i/a/1/A`, `/us/bill/119/hr/6644/tI/s101/3/B`,
`/us-ny/code/agm/s3/1/a`. A portion in a bill keeps the bill's big levels
(`/tI/s101`), because bills print them in the identifier.

### Examples

| What | Address |
|---|---|
| H.R. 6644, the Work | `/us/bill/119/hr/6644` |
| H.R. 6644 as introduced | `/us/bill/119/hr/6644@2025-12-11_ih` |
| H.R. 6644 as enrolled, in USLM | `/us/bill/119/hr/6644@2026-07-11_enr.xml` |
| section 101 of that printing | `/us/bill/119/hr/6644/tI/s101@2026-07-11_enr` |
| Public Law 119-101 | `/us/pl/119/101` |
| 10 U.S.C. 130i | `/us/usc/t10/s130i` |
| 10 U.S.C. 130i(a)(1) as of a release point | `/us/usc/t10/s130i/a/1@2026-07-01` |
| New York Agriculture and Markets Law § 3 | `/us-ny/code/agm/s3` |
| the same section as it stood on a date | `/us-ny/code/agm/s3@2024-01-01` |
| New York Constitution, article I, § 11 | `/us-ny/const/artI/s11` |
| a New York Senate bill's amended printing | `/us-ny/bill/2025/s/7721@2025-05-01_a` |
| the 119th Congress | `/us/bill/119` |
| New York's 2025–2026 session | `/us-ny/bill/2025` |
| New York's consolidated laws | `/us-ny/code` |

### Where it is stored

The S3 key is the address with the Work as the path and the expression as the
file name, under decision 10's prefix. The Work already begins with the
jurisdiction, so it is not repeated:

```
s3://govblock-lake-638175140432/lake/v1/xml/us/bill/119/hr/6644/2025-12-11_ih.xml
s3://govblock-lake-638175140432/lake/v1/xml/us/usc/t10/s130i/2026-07-01.xml
s3://govblock-lake-638175140432/lake/v1/xml/us-ny/code/agm/s3/2024-01-01.xml
```

The object body is gzip with `Content-Encoding: gzip` and
`Content-Type: application/xml`, so the key keeps the address's `.xml`.

`expressions` carries `work` (`/us/bill/119/hr/6644`), `expression`
(`2025-12-11_ih`) and the S3 key; `work || '@' || expression` is the address.
The root element of every stored document carries the Work in its
`identifier` attribute and the expression in `<meta>` as `<docStage>` and
`<processedDate>` where USLM has them, so a document names itself without
the index.

### The `/` command

The keyboard door to the same addresses. A library slug is a name for a
prefix; the command resolves it, then lists what sits under it.

| Typed | Resolves to |
|---|---|
| `/119` | `/us/bill/119` |
| `/6644` | every Work whose bill number is 6644, any session, any jurisdiction |
| `/hr6644` | `/us/bill/*/hr/6644` |
| `/new-york-code` | `/us-ny/code` |
| `/new-york-constitution` | `/us-ny/const` |
| `/us/usc/t10/s130i` | the address itself |

Named libraries by family of law (`/arkansas-agricultural-law`) are window
4's; they resolve to sets of addresses, not to one prefix. `@` shares the
parser (`lib/xml/address.ts`) and is window 4's.

## 2. The schema

### Rules

- Node and mark names are USLM's element names, exactly. `doc` and `text` are
  ProseMirror's own and stand for USLM's document root and character data.
- A member of a USLM substitution group that shares its head's type is one
  node with an `element` attribute naming the member: `note` covers
  `sourceCredit`, `statutoryNote`, `editorialNote`, `footnote` and the rest of
  `NoteType`; the generic `level` covers any level element used where its rank
  is not allowed. The XML converter writes the member's own element back.
- Every block node carries `id`, `identifier`, `class`, `role`, `status` when
  the source has them, and `xml`: the attributes the node does not model, kept
  so XML out is lossless.
- Content expressions reject illegal nesting, and the schema never repairs.
  When the source nests a level where its rank is not allowed (a `clause`
  directly inside a `clause`), `uslmToDoc` emits USLM's own generic `level`
  with `element="clause"` and records the violation in the parse report.
  `level` is the schema's escape hatch, as `hcontainer` is Akoma Ntoso's.
- `uslmToDoc` records every element it does not know, with a count and the
  first path it was seen at. Its children are still read and its text is kept.
  Nothing is dropped silently.

### Levels

USLM's `LevelType`, in rank order. The XSD allows any level inside any level;
the reader's schema enforces rank, measured against the corpus.

| Group | Nodes | Allowed level children |
|---|---|---|
| big | `preliminary`, `title`, `subtitle`, `division`, `subdivision`, `chapter`, `subchapter`, `part`, `subpart`, `article`, `subarticle`, `compiledAct`, `courtRules`, `courtRule`, `reorganizationPlans`, `reorganizationPlan` | any big level but its own element, `section`, `level`, `appropriations` |
| primary | `section` | any small level, `level`, `appropriations` |
| small | `subsection` > `paragraph` > `subparagraph` > `clause` > `subclause` > `item` > `subitem` > `subsubitem` | any small level of lower rank (skipping is allowed: a section holds paragraphs with no subsection), `level` |
| generic | `level` | any level |

Every level's content follows the XSD's `LevelType`:

```
num? heading? subheading* toc* statement?
( content+ note*
| ( chapeau | continuation | proviso | crossHeading | note | <allowed levels> )+ )
```

### Level parts

| Node | USLM element | Content | Attributes |
|---|---|---|---|
| `num` | `num` | inline text | `value` (the bare number, "a", "101") |
| `heading` | `heading` | inline text | |
| `subheading` | `subheading` | inline text | |
| `chapeau` | `chapeau` (Akoma Ntoso `intro`) | inline text | |
| `continuation` | `continuation` (Akoma Ntoso `wrapUp`) | inline text | |
| `proviso` | `proviso` | inline text | |
| `crossHeading` | `crossHeading` | inline text | |
| `content` | `content` | `(p \| quotedContent \| table \| layout \| note)+` | |
| `p` | `p` | inline text | `implicit`: text that sat loose in a `content`, written back without `<p>` |

### Quoted amendments

| Node | USLM element | Content | Attributes |
|---|---|---|---|
| `quotedContent` | `quotedContent` | `(any level \| p \| content \| toc \| table \| note)+` | `origin` (the address quoted from, when known) |

`quotedText` is a mark (below). A `quotedContent` may hold a whole section
inside a clause; it is the one place a higher rank sits inside a lower one,
because it is quoted, not nested.

### Document

| Node | USLM element | Content |
|---|---|---|
| `doc` | the root: `bill`, `resolution`, `amendment`, `uscDoc`, `pLaw`, `statute` (`element` attribute) | `preface? (longTitle \| enactingFormula \| resolvingClause \| preamble)* toc? (any level \| content \| p \| quotedContent \| note)* (attestation \| signatures \| endorsement \| appendix)*` |
| `preface` | `preface` | `p+` |
| `longTitle` | `longTitle` | `(docTitle \| officialTitle)+` |
| `docTitle`, `officialTitle`, `enactingFormula`, `resolvingClause` | same | inline text |
| `preamble` | `preamble` | `(recital \| p)+` |
| `recital` | `recital` | inline text |
| `attestation` | `attestation` | `(p \| signatures)+` |
| `signatures` | `signatures` | `signature+` |
| `signature` | `signature` | `(name \| role \| affiliation \| signatureDate \| notation)+`, each inline text |
| `appendix` | `appendix`, `schedule` | as `doc`'s body |

`doc` attributes: `element`, `identifier` (the Work), `expression`,
`dialect` (`uslm`, `bill-dtd`, `plain-text`), `title`, and `fidelity`
(`native-xml`, `structured-html`, `plain-text`, `pdf`).

### Tables of contents, notes, tables

| Node | USLM element | Content |
|---|---|---|
| `toc` | `toc` and its substitution group (`index`, …) | `(referenceItem \| layout)+` |
| `referenceItem` | `referenceItem`, `headingItem`, `groupItem` | `(designator \| label \| target)+`, each inline text |
| `note` | `note` and `NoteType`'s substitution group | `(heading \| p \| content)+` |
| `layout` | `layout` | `(header \| row)+` |
| `header`, `row` | same | `column+` |
| `column` | `column` | inline text |
| `table` | `xhtml:table` (USLM's table module) | `caption? tr+` |
| `tr`, `th`, `td` | `xhtml:tr`, `th`, `td` | `(th \| td)+`; cells hold `p+`; `colspan`, `rowspan` |

### Inline

Marks, stacking freely (`excludes: ""` where one element nests in itself):

| Mark | USLM element | Attributes |
|---|---|---|
| `b`, `i`, `sub`, `sup` | same | |
| `ins`, `del` | same | |
| `inline`, `span` | same | `class` (`smallCaps`, …) |
| `term` | `term` | |
| `shortTitle` | `shortTitle` | `role` |
| `headingText` | `headingText` | |
| `quotedText` | `quotedText` | `origin` |
| `ref` | `ref` | `href` (an address from section 1), `idref`, `portion`, `class` |
| `date` | `date` | `date` |
| `amendingAction` | `amendingAction` | `type` (`amend`, `insert`, `delete`, `redesignate`, …) |

Inline nodes: `br` (a line break), `img` (`src`, `alt`), `footnoteRef`
(`idref`).

Not rendered, recorded as known: `meta` and its properties (read into `doc`'s
attributes), `page` and the running heads (print furniture), processing
instructions.

### The two federal dialects

GovInfo publishes enrolled bills and public laws as USLM 2 and every other
printing in the older Bill DTD (`enum`, `header`, `text`, `quoted-block`,
`external-xref`). The lead's front end `lib/xml/frontends/us.ts` normalizes the
DTD to USLM 2 names before `uslmToDoc` sees it, so both dialects render
through one path; `doc.dialect` records which one the source was. An
`external-xref` with `parsable-cite="usc/42/1437f"` becomes
`<ref href="/us/usc/t42/s1437f">`.
