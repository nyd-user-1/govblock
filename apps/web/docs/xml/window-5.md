# Window 5: fork and amend — report

Report to the lead. Newest milestone first.

## Milestone 1 — the engine, tested on published law (2026-09-14)

### Built

`apps/web/lib/typeset/amend.ts`, pure functions over the reader's schema:

- **`diffDocs(base, fork)`.** Children are matched by `identifier`, then by
  element and number, with the longest increasing run of keyed matches as
  anchors. Unkeyed children pair by exact text, then by type and likeness
  between the anchors. Inside a changed text block the diff is word by word.
  Each hunk comes out as one strike and one insertion, and a stretch of bare
  punctuation between two changes goes into the change. Positions are the
  base's and the fork's own, so the redline lands where the words are.
  Marks are not compared: formatting is not an amendment.
- **`instructions(diff, citation)`** in the jurisdiction's convention
  (`CONVENTIONS`):
  - **Federal, a bill's own form:** "In section 102(a), strike “18” and
    insert “12”."; "In section 102(b)— (1) strike paragraph (5); and (2)
    redesignate paragraphs (6), (7), and (8) as paragraphs (5), (6), and (7),
    respectively."; "In section 102, add at the end the following:" with the
    quoted subsection. A subsection more than half rewritten becomes "Strike
    section 102(f) and insert the following:".
  - **Federal, the codified form:** "Section 130i(b)(1)(D) of title 10,
    United States Code, is amended by striking “exercise” and inserting
    “assume”."; ", in the heading, by striking"; "by inserting “promptly”
    after “Defense may”". An anchor or struck phrase grows a word at a time
    until it appears once in its part, else it takes "the second place it
    appears".
  - **New York:** "Section 1. Subdivision 1 of section 16 of the agriculture
    and markets law is amended to read as follows:" with the subdivision
    restated, new matter as insert runs (underscored) and omitted matter as
    delete runs (bracketed in text: `products, [aquaculture, ]and`).
    "…Subdivision 2-c … is REPEALED and subdivision 2-d is renumbered
    subdivision 2-c."; "…is amended by adding a new subdivision 2-h to read
    as follows:". Several changes become "Section 1.", "§ 2." in the order of
    the law, each at the smallest unit that holds it.
  - **Every other state** takes New York's shape ("Section 1.", "Sec. 2.")
    until it gets its own row. Page-and-line instructions need the printing's
    page and line markers, which `uslmToDoc` skips today, so no row uses them.
- **`marked(diff)`**: the redline as specs over the base: `strike` and
  `insert` inside text blocks, `strike-block` and `insert-block` for whole
  units. The Fork view turns them into decorations. **`clean(diff)`**: the
  fork.
- **`conflicts(a, b, form)`**. Under strike and insert, two amendments
  conflict where they change the same words or insert at the same place.
  Under read as follows, they conflict where they restate the same unit.
  Either way the pair is refused with the rule: text already amended is not
  open to a second amendment except by a substitute, and once both are
  enacted the later in time prevails.

### Verified

`node --test scripts/typeset/amend.test.mjs`: **18 of 18 pass** in 0.34 s.
The cases run on N.Y. Agric. & Mkts. Law § 16, H.R. 6644 § 102 as enrolled,
and 10 U.S.C. 130i, including a fork of a portion (130i(b)(1) alone, cited
through (b) from its address). All three are read from their stored
Expressions in S3 and committed as fixtures under `scripts/typeset/fixtures/`.
Bounded type check on the engine and the rename files: 0 diagnostics.

### `sql/011` ran

On aurora-2525 at Brendan's word, 10 statements, each under 200 ms, as
milestone 0 describes.

### Files

`apps/web/lib/typeset/amend.ts`, `scripts/typeset/amend.test.mjs`,
`scripts/typeset/amend-entry.ts`, `scripts/typeset/fixtures/*`,
`apps/web/docs/xml/window-5.md`.

## Milestone 0 — the plan, the migration, My Files (2026-09-14)

### Plan

1. **The engine**, `lib/typeset/amend.ts`, pure functions over trees of the
   reader's schema (`lib/xml/schema.ts`), no React, no `@/` imports, so a
   script bundles it:
   - `diffDocs(base, fork)`: node-level first, children matched by
     `identifier` (then element and number, then text), then word-level inside
     each changed text block. Never lines.
   - `instructions(diff, citation)`: the amendment in the jurisdiction's
     convention, from a small table: federal "strike … and insert …" (a
     bill's own form, "In section 101(a), strike …", and the codified form,
     "Section 130i(a) of title 10, United States Code, is amended by striking
     …"); New York "is amended to read as follows:" with new matter
     underscored and omitted matter in brackets, "is REPEALED", "by adding a
     new subdivision"; the rest of the states on New York's form until each
     gets its own row.
   - `marked(diff)`: the redline in place, as decoration specs over the base
     (inline strikes, inserted words and levels as widgets), never marks in
     the document. `clean(diff)`: the fork's text as law would read.
   - `conflicts(a, b)`: two amendments to one base touching the same unit
     are refused, with the rule that decides between them.
   - Tests in `scripts/typeset/amend.test.mjs` (`node --test`) on N.Y. Agric.
     & Mkts. Law § 16 and a section of H.R. 6644 as enrolled, both read from
     their stored Expressions.
2. **Storage**, `sql/011_forks_work.sql`: a fork names a Work address and the
   dated base it came from; a commit holds the fork's document (the
   ProseMirror JSON of the USLM schema, gzipped). The write paths in
   `app/api/policy/forks` and `app/api/policy/commits`.
3. **The Fork view**, `/workspace/typeset/fork/<forkId>`: the Tiptap editor on
   the same schema, editable, under a Tiptap sibling of the toolbar; the
   amendment instructions beside it; Edit | Redline over the dated base. The
   bill route's `fork` slug forks the printing and opens it.
4. **The fork action** from the XML reader: fork the printing, or the
   section or subsection under the pointer, into My Files.
5. **The official record shows no forks**: the proposed-versions rendering in
   `bill-changes.tsx` removed.
6. **My Files**: the rename as window 4's table sets it.

Built against window 4's `lib/typeset/expression-document.ts` and
`/workspace/typeset/work/<address>` (the lead's names), which this window
does not write.

### `sql/011_forks_work.sql`

Written. What it does:

- `"Forks"` gains `work` (the forked address, a section or a portion of one),
  `base_work` and `base_expression` (the stored Expression it was read from),
  `kind` and `label`, and an index on `(owner, work)`.
- `"Forks".bill_id` drops `not null`, so a fork of a statute needs no bill.
  That is the one constraint relaxation; no data changes.
- `"Commits"` gains `doc_gz`, `doc_bytes` and `doc_schema`. `text` stays and is
  written as the document's plain text, so the existing readers keep working.

### My Files

`ROOT_FOLDERS` and the designer crumb say My Files; the folder's heads are
Copied from and Created; the path segment is `my-files` with `forks` parsed as
an alias; entitlements treat both alike.

### Files touched

`apps/web/docs/xml/window-5.md`, `sql/011_forks_work.sql`,
`apps/web/lib/create/path.ts`, `apps/web/lib/workspace/path.ts`,
`apps/web/lib/entitlements.ts`, `apps/web/components/create/designer.tsx`,
`apps/web/components/create/folder-view.tsx`,
`apps/web/components/create/file-view.tsx` (a comment).
