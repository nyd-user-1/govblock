# Utah — bills

Profile: `PROFILES.UT` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic front end. Derived 2026-09-14 (window 8) from fifty printings drawn through `"Bills"` across every session, checked on a second fifty held back from the derivation (28 of 28 real printings clean; 22 refusal pages).

## The surface

**Half the stored printings are not bills.** 17,570 of the 36,096 printings stored at the end of the first pass are a firewall's refusal, 122 characters: "The requested URL was rejected. Please consult with your administrator. Your support ID is: …". They report as `error-page`, fall out of the pipeline asking for a re-fetch, and stay out of the measured mean. The re-fetch is with window-4-va-ca.

The rest are the Legislature's printed bill as text:

```
     02-05 09:17  1st Sub. (Buff) H.B. 274
 1  Water Amendments
                        2025 GENERAL SESSION
 3     LONG TITLE
 8  ▸ provides circumstances of when a municipality may set different water rates …
29     Be it enacted by the Legislature of the state of Utah:
30  Section 1. Section 10-8-22 is amended to read:
31  10-8-22 . Water rates.
32     (1) As used in this section:
33  (a) "Designated water service area" means …
                                    -4-
```

| Unit | Signalled by | USLM |
|---|---|---|
| margin number | every line, straight through the bill | stripped |
| running head and foot | the printing's date and time with the bill: "02-05 09:17 1st Sub. (Buff) H.B. 274", "02-24-22 6:46 PM 3rd Sub. (Ivory) S.B. 169" | dropped |
| page number | "-4-" | dropped |
| bar code | "*SB0169S03*" | dropped |
| bill number against the right margin | "1st Sub. H.B. 274", "S.B. 194" | dropped |
| filing stamp | "LEGISLATIVE GENERAL COUNSEL", "Approved for Filing: …" | dropped |
| long title, provisions, sections affected | "LONG TITLE", "General Description:", "Highlighted Provisions:", "Utah Code Sections Affected:" | `preface` |
| enacting formula | "Be it enacted by the Legislature of the state of Utah:" | `enactingFormula` |
| bill section | "Section 1." | `section` |
| quoted law | after "is amended to read:", "is enacted to read:", "is renumbered and amended to read:" | `quotedContent` |
| quoted Utah Code section | "10-8-22 . Water rates." (a space before the full stop from 2025), "63A-16-104. Duties of division." | `section`, `heading` |
| subsection | (1) (2) (3) | `subsection` |
| paragraph | (a) (b) (c) | `paragraph` |
| subparagraph | (i) (ii) (iii) | `subparagraph` |
| sub-subparagraph | (A) (B) (C) | `clause` |
| struck matter | "[and]", "[, "retail ]" | `del` |

Every unit opens its own line, so an enumerator at a line's head opens a block whatever the line before ended with ("…; and" then "(ii) …").

## Measured

`scripts/xml/coverage.mjs UT --source texts --sample 100`: 64.7% before, with the refusal pages counted as bills; **100.0%** after, over the 39 real printings (35 clean; 61 refusal pages held out). Stored at the end of the first pass: 66.3%, over 36,096 printings of which 17,570 were refusals.

## Known gaps

- Inserted matter is underlined in the PDF and the capture loses the underline, so new text reads as current law beside its `del`.
- A struck enumerator in front of its replacement ("[(b)] (c) provide …") does not open a block, so that unit joins the one before it.
