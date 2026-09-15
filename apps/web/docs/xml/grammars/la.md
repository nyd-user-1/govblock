# Louisiana — statutes

Profile: `PROFILES.LA` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic statute parser. Derived 2026-09-14 (window 8) from fifty sections drawn through `"Laws"` across the Revised Statutes and the codes, checked on a second fifty held back from the derivation (98.9%, 46 of 50 clean).

## The surface

The Legislature's document pages (`scripts/laws/adapters/la.mjs`), one section each, as text: the citation alone, the section mark and catchline, the law, the history.

```
RS 24:513.3

§513.3. Audit reports; gaming regulator audits; review of gaming facilities

A. The legislature hereby recognizes that …

B.(1) In order to fulfill the duties imposed upon him …

(2) "Gaming industry regulators", as used herein, shall mean …

Acts 1995, No. 1315, §1, eff. July 1, 1995; Acts 2001, No. 1102, §5.
```

| Unit | Signalled by | USLM |
|---|---|---|
| section | "RS 24:513.3" alone in the first block; the code prefix (RS, CC, CCP, CCRP, CE, CHC, CONST) is removed | `section`, `num` |
| catchline | the next block, its "§513.3." or "Art." restatement removed | `heading` |
| subsection | A. B. C. | `subsection` |
| paragraph | (1) (2) (3) | `paragraph` |
| subparagraph | (a) (b) (c) | `subparagraph` |
| clause | (i) (ii) (iii) | `clause` |
| a subsection and its first paragraph on one line | "B.(1) In order to …", with no space | each at its rank |
| history | "Acts 1968, No. 232, §2. Amended by …", "Added by Acts …", "Redesignated …" closing the section | `sourceCredit` |

## Measured

`scripts/xml/coverage.mjs LA --source laws --sample 100`: 70.8% before (0 clean: the code prefix and the citation alone on its line failed the number test on every section), **99.5%** after (97 of 100 clean). Stored at the end of the first pass: 71.7%.

## Known gaps

- A chapter heading the Legislature sets inside a section ("PART I. SOIL AND WATER CONSERVATION DISTRICTS") reads as an unmatched enumerator.
- A footnote after the history ("1Abolished May 1, 1996. See R.S. 27:31(A)(2).") keeps the history in the body, since the credit is read from the section's last blocks.
