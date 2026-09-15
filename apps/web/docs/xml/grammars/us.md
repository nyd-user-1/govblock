# United States: the federal grammar

Front end: `apps/web/lib/xml/frontends/us.ts`. Coverage: `lib/xml/coverage.generated.json`, key `US/documents`.

## Dialects

| Dialect | Where it comes from | What the front end does |
|---|---|---|
| `uslm` | the US Code by title from the OLRC release point; enrolled bills and public laws in GovInfo's newer packages | passes through; every element checked against the USLM vocabulary |
| `bill-dtd` | GovInfo's BILLS collection, most printings of the 113th Congress on | renamed element by element to USLM's names (`lib/xml/uslm-elements.ts`, `DTD_TO_USLM`) |
| `text` | every printing before the 113th Congress (2013); LegiScan's captures | the plain-text front end, lowest tier |

## Units

| Unit | USLM | Signalled by |
|---|---|---|
| title … subsubitem | the same names | USLM level elements; in the Bill DTD the same names carrying `<enum>` and `<header>` |
| number | `num` | `<num>` or `<enum>` |
| heading | `heading` | `<heading>` or `<header>` |
| chapeau | `chapeau` | `<chapeau>`; in the Bill DTD, the first `<text>` of a level that goes on to child levels |
| content | `content` | `<content>`; any other `<text>` |
| continuation | `continuation` | `<continuation>`, `<continuation-text>`, `<after-quoted-block>` |
| quoted law | `quotedContent` | `<quotedContent>` or `<quoted-block>` |
| reference | `ref` | `<ref>`; `<external-xref parsable-cite>` and `<internal-xref idref>`, with `href` rewritten to the address scheme (`usc/42/1437f` → `/us/usc/t42/s1437f`) |
| new and omitted matter | `ins`, `del` | `<added-phrase>`, `<deleted-phrase>` |

## Measured

Sixty live GovInfo documents, 2026-09-14: 99.5% coverage, 51 of 60 fully clean, 58 Bill DTD and 2 native USLM. The pipeline's own run over 3,000 H.R. printings: 99.93%.

## Known gaps

Elements the vocabulary did not know on the sample, since added: the metadata wrapper, the inline amendment marks, `constitution-article`, `header-in-text`, `fraction`, `calendar`, `action-instruction`, `associated-doc`, and the USLM meta elements `citableAs`, `publicPrivate`, `enrolledDateline`. Anything new shows up in the coverage file's `unknown` and is added the same way.
