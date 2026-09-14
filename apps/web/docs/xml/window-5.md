# Window 5: fork and amend — report

Report to the lead. Newest milestone first.

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
