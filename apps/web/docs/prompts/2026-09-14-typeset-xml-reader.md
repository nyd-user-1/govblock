# Window 1: the Typeset reader on ProseMirror, from native USLM

Brendan, 2026-09-14. Read `2026-09-14-legislative-xml-program.md` first; it
holds the decisions, the contract, the word map and the rules. This brief is
your scope only. Verify every file pointer before trusting it.

## What this window proves

A federal bill renders in a Tiptap reader straight from its USLM, with the
hierarchy, numbering, headings, quoted amendments and cross-references intact,
beside the Plate reader on the same bill, at the same speed or better. The
mangled rendering on federal bills comes from flattening USLM to HTML and
then to Slate; this window stops flattening. State bills are not fixed here;
they wait on the pipeline window, and this reader shows them through the
plain-text fallback until then.

## Start from the parser that exists

`lib/policy/bill-uslm.ts` already parses USLM into a tag tree (`parseXml`),
knows every level from division to subsubitem, quoted blocks, tables of
contents, attestations, engrossed-amendment bodies, and `external-xref` with
its `parsable-cite`. Only `render` and `level` throw the structure away. Write
`uslmToDoc` beside `uslmToHtml`, walking the same tree into ProseMirror JSON.
Do not write a second XML parser. The fetch, `fetchUslm`, reads
`Documents.url` when it ends in `.xml`; reuse it.

## First hour

Two other windows wait on you. Within the first hour, write
`apps/web/docs/xml/schema.md` with the **address scheme** (Akoma Ntoso's
URI convention applied to this corpus: a jurisdiction, a kind, a work, an
expression date; examples for a federal bill printing, a US Code section, a
New York statute section, a session) and the node list, and commit it. The
pipeline keys its store by it; the library browses by it. Refine the rest
of the schema after.

## Scope

1. **The branch and the box.** `feature/legislative-xml` from `main` at
   29783ee. On the box, clone to `~/govblock-xml`, check the branch out
   there, run its dev server on 3002 and tunnel 3002. Record the commands in
   your report.
2. **The schema, mirroring USLM.** Tiptap nodes for USLM's element set, taken
   from the schema: the levels (title, subtitle, chapter, subchapter, part,
   subpart, division, section, subsection, paragraph, subparagraph, clause,
   subclause, item, subitem, subsubitem), `num`, `heading`, `content`,
   `chapeau` (the line over an enumerated list) and `continuation` (the
   flush language after or between the items; Akoma Ntoso's `intro` and
   `wrapUp`, and an amendment edits each on its own), `quotedContent`,
   `ref`, `note`, `toc` and its entries, tables, and the inline marks USLM
   uses. Content expressions
   reject illegal nesting; the schema never repairs. Write the schema down in
   `apps/web/docs/xml/schema.md` as the shared contract: each node, its
   USLM element, its allowed children, its attributes.
3. **`uslmToDoc`**: the tree to a ProseMirror document. Unknown elements are
   recorded, never dropped silently; the parse reports what it did not know.
4. **The plain-text fallback.** A document with no USLM behind it goes through
   `plainTextHtml`'s levels into generic paragraph and heading nodes of the
   same schema, and the page says the text came from plain text. Nothing
   renders as nothing.
5. **The view.** A seventh view in `lib/typeset/views.ts`, slug `xml`, label
   "XML", drawn by a new `components/workspace/typeset-xml-reader.tsx`, on
   the same bill routes, in the same shell, beside Typeset. The default view
   does not change. First paint: the ProseMirror document serialized to HTML
   on the server (prosemirror-model's DOMSerializer over linkedom), written
   as the HTML converter in `lib/xml/` so the pipeline window shares it, and
   cached the way `lib/typeset/document.ts` caches the snapshot, so the bill is on
   screen before any script runs; the editor takes over from the JSON.
   Store the ProseMirror JSON beside the Slate value in `typeset_documents`
   (a new column or a builder bump; migration written, not run).
6. **The parse as a job on the Data Pipeline dashboard.** On
   `components/admin/pages/database.tsx`, a tile named "USLM parse": a bill id
   in, run, and out come node counts by type, unknown elements, parse and
   serialize times, byte sizes of XML, JSON and HTML, and a link that opens
   the bill in the XML view. Runnable and observable by Brendan without a
   terminal. Server-side through a route under `app/api/typeset/`.
7. **The `/` command, stubbed.** A command palette entry that opens the corpus
   as a library by Akoma Ntoso's URI convention: `/119` a session,
   `/new-york-code`, `/new-york-constitution`, `/arkansas-agricultural-law`,
   `/6644` every bill with that number. Design the address so the pipeline
   window can store by it; a stub that resolves a session and a bill number
   is enough. Leave a seam for `@`, which is window 4's.
8. **The converters.** `lib/xml/`: the parsed IR to HTML (your first-paint
   snapshot), Markdown, plain text and XML out, one function each, with the
   `uslmToDoc` parse beside them. The pipeline imports these; scripts import
   them too, so keep them free of React and of `server-only`.
9. **Proof and numbers.** H.R. 6644 (bill 2058568, the default) and one more
   federal bill with quoted amendments. Show where the XML render is
   structurally right and the HTML render is not, with the element counts to
   back it. Measure what `docs/typeset-perf.md` measured, on the box, on the
   same bill, and write both to `apps/web/docs/xml/reader.md`.

## Not in scope

Editing, forks, amendments, citations, removing Plate, changing the default
view, the library surface (window 4), the grammars (window 3), any state
jurisdiction beyond the fallback.

## Done means

H.R. 6644 renders in the XML view from native USLM, structurally faithful,
beside the untouched Plate reader; the schema is written down; the parse tile
runs on the Data Pipeline dashboard; the fallback shows a state bill with a
note; the fidelity and performance notes are in `apps/web/docs/xml/reader.md`;
everything is committed on the branch and compiles in the branch's clone on
the box. Then hand back with the report at `apps/web/docs/xml/window-1.md`.
