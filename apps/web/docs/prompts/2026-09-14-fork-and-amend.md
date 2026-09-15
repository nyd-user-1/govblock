# Window 5: fork a published statute, edit it, get the amendment and the redline

Brendan, 2026-09-14. Read `2026-09-14-legislative-xml-program.md` first, then
window 1's schema in `apps/web/docs/xml/schema.md` and window 2's storage.
This brief is your scope only. Runs after windows 1 and 2 report done; the Forks folder is My Files by then (window 4).

## The fork model, exactly

A reader forks a published statute unit, a section or subsection of a state
code or the US Code, or a bill's printing, into their own Forks folder. The
fork is theirs. It is edited in the Tiptap editor on the USLM schema. The
official record never lists a reader's fork or commit; BillHistory and the
printings are the record, full stop. The first model, a reader's commits
shown under the bill's official versions, is gone and not coming back.
Today's Duplicate to edit in `components/create/file-view.tsx`, the Forks and
Commits tables and their routes, and `bill-edit.tsx`'s commit dialog are the
seed. `bill-changes.tsx` still draws "proposed versions" under official
versions with a toggle to hide them: remove that rendering.

## The engine

The reader edits the fork as a document; the engine derives the amendment.
That is how this codebase already works (the edit page commits an edited
copy), now made structure-aware:

- **The diff** is between two USLM-shaped trees: the fork's Expression and
  the dated base Expression it was forked from (`expressionAt`). Node-level,
  then text-level within a node. Never a line diff; a legal amendment is an
  instruction against a hierarchy. `lib/policy/line-diff.ts` and
  `bill-compare.ts` stay for printings; they are not this.
- **The amendment instructions** come out of the diff in the jurisdiction's
  convention: New York's new matter underlined and omitted matter in
  brackets; the federal "strike … and insert …" form; page-and-line form
  where a jurisdiction uses it. The convention is a per-jurisdiction table,
  small at first.
- **Two renderings from one source:** the marked version (the redline in
  place, strike and insert as ProseMirror decorations over the base, never
  marks written into the document) and the clean version.
- **Commits** hold the fork's Expression as USLM-shaped JSON, not plain text:
  a migration for `Commits` (written, not run) and the write path in
  `app/api/policy/commits/route.ts`. Each commit is a DocHistory entry with
  its parent Expression, so a fork written in March diffs against March.
- **Conflicts** between competing amendments to one base resolve by
  legislative rules, not a merge. Design it; a first version may refuse and
  say why.

## Scope

1. The fork action from the XML reader: fork this section, this subsection,
   this printing, into My Files, from the dated base. Widen `Forks` from a
   bill id to a Work address by migration (Brendan, 2026-09-14: yes).
2. The editor: the same Tiptap schema, editable, with the toolbar the views
   share (`components/workspace/typeset-toolbar.tsx` is the Plate one; make
   its Tiptap sibling, same buttons where they mean something for law).
3. The engine as `lib/typeset/amend.ts`: diff, instructions, marked, clean,
   each a pure function over trees, with tests on H.R. 6644 and one New York
   section.
4. The Fork view (`lib/typeset/views.ts`, slug `fork`) rebuilt on it: the
   editor, then the amendment instructions and the redline in place.
5. Removal of the proposed-versions rendering in `bill-changes.tsx`.

## Not in scope

Citations and `@`, the in-context statute tabs, public proposals, removing
Plate.

## Done means

A reader forks a section of New York law from the XML reader, edits it,
and sees correct instructions in the New York convention and a redline in
place against the dated base; the same on a federal bill in the federal
form; commits store structured Expressions; the official record shows no
forks. Committed on the branch. Report at `apps/web/docs/xml/window-5.md`.
