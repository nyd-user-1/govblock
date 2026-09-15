# Oregon — statutes

Profile: `PROFILES.OR` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic statute parser. Derived 2026-09-14 (window 8) from fifty sections drawn through `"Laws"`, checked on a second fifty held back from the derivation (97.3%, 43 of 50 clean). The number read "Oregon" before this was the history-note stubs: 43% of the Oregon Revised Statutes' 60,136 sections are a number and a bracket.

## The surface

The Legislative Counsel's chapter files (`scripts/laws/adapters/or.mjs`): the loader writes each section as its number and catchline, a blank line, and the words.

```
166.660 Unlawful paramilitary activity

(1) A person commits the crime of unlawful paramilitary activity if the person:

(a) Exhibits, displays or demonstrates …

(2)(a) Nothing in this section makes unlawful …
```

| Unit | Signalled by | USLM |
|---|---|---|
| section | "166.660" opening the first block | `section`, `num` |
| catchline | the rest of the first block, whatever its length or verbs | `heading` |
| repealed or renumbered section | the number alone, then "[1985 c.347 §3; repealed by 1993 c.792 §55]" | `section` with the bracket as `content` |
| subsection | (1) (2) (3) | `subsection` |
| paragraph | (a) (b) (c) | `paragraph` |
| subparagraph | (A) (B) (C) | `subparagraph` |
| sub-subparagraph | (i) (ii) (iii) | `clause` |
| units of several ranks on one line | "(2)(a) Nothing …", "(3)(a)(A) At the election …" | each at its rank |
| history | "[2003 c.675 §55; 2011 c.553 §2]" closing the last block | in the text |
| Legislative Counsel's note | "Note: 536.605 was enacted into law by the Legislative Assembly but was not added to …" closing the section | `note` |
| later operative text | after a note saying the amendments "become operative January 1, 2027", the section again from "109.206. (1) …" | `level role="later version"` |

## Measured

`scripts/xml/coverage.mjs OR --source laws --sample 100`: 76.7% before (46 clean; every stub read "no number at the start" on a block of two), **98.8%** after (95 of 100 clean). Stored at the end of the first pass: 77.9%.

## Known gaps

- The loader cuts a catchline at its first full stop, so "Application of Deficit Reduction Act of 1984 (P.L. 98-369) …" keeps "(P.L" as its heading and starts the body at "98-369)". A loader fix, not a grammar one.
- A chapter's group heading ("(Death Sentence)", "MISCELLANEOUS PRIVATE FOREST ACCORD PROVISIONS") lands at the end of the section before it, as the loader reads the file.
- Forms quoted inside a section ("Notice of Extended Payment Provision … (1) Progress payments no later than _____ days") number from (1) again and read as out of sequence.
