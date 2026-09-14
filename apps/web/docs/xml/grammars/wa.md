# Washington — statutes

Profile: `PROFILES.WA` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic statute parser. Derived 2026-09-14 (window 8) from fifty sections drawn through `"Laws"`, checked on a second fifty held back from the derivation (99.4%, 46 of 50 clean).

## The surface

The Code Reviser's section pages (`scripts/laws/adapters/wa.mjs`): the loader writes each section as its citation and catchline, a blank line, and the page's words.

```
RCW 18.165.270 Application of administrative procedure act to acts of the director.

The director, in implementing and administering the provisions of this chapter, shall act …

[ 1991 c 328 s 27.]

Notes:

Effective dates—1998 c 292: See RCW 11.11.903.
```

| Unit | Signalled by | USLM |
|---|---|---|
| section | "RCW 11.68.110" opening the first block (the citation prefix is removed) | `section`, `num` |
| catchline | the rest of the first block, whatever its length or verbs | `heading` |
| subsection | (1) (2) (3) | `subsection` |
| paragraph | (a) (b) (c) | `paragraph` |
| subparagraph | (i) (ii) (iii) | `subparagraph` |
| units of several ranks on one line | "(a)(i) The personal representative …" | each at its rank |
| session laws | "[ 2021 c 140 s 4014; 2016 c 202 s 8. Prior: 1984 c 149 s 11 …]" | `sourceCredit` |
| Reviser's notes | "Notes:" and each block after it ("Application—2021 c 140 ss 4003-4017 …: See note following RCW 11.48.130.") | `notes` of `note` |

## Measured

`scripts/xml/coverage.mjs WA --source laws --sample 100`: 79.8% before (0 clean: every section read "no number at the start" on the "RCW" prefix), **98.8%** after (91 of 100 clean). Stored at the end of the first pass: 78.7%.

## Known gaps

- Forms quoted inside a section ("NOTICE OF FILING OF DECLARATION OF COMPLETION OF PROBATE …") and definitions sections that restart their numbering read as out of sequence: nine of a hundred sections carry one "subsection N after N".
- Units listed inline in one sentence ("the following: (i) Personal representative …; (ii) lawyer …") stay in the sentence.
