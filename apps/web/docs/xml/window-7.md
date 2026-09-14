# Window 7: acquisition — report

Report to the lead. Newest milestone first. Each part is taken by the window
that claims its item in `apps/web/lib/xml/todo.ts`, under its own heading.

## Part 1, Virginia (`va-refetch`, claimed by window 4)

### Milestone 0 — claimed (2026-09-14)

- Claimed after window 4's brief was accepted. Brendan's word, to window 4's
  session: claim it, the upsert into `"BillTexts"` allowed, through the
  existing loaders' shape, no deletes; compile on the pipeline box and stop it
  after.
- The loaders' shape, read before any write: livingston
  `api/_lib/text-shared.ts` `TextBuffer`. Rows go in 50 at a time (or 8 MB, or
  30 s), upserted on `document_id`, rewritten only when `text_hash` or `error`
  differs, then `"Bills".text_fetched_at` and `text_chars` are stamped per bill.
  Virginia's sources today: `api/_lib/text-sources/va-lis.ts` (the 2026
  session, LIS API with a key) and the `state_link` walker (earlier sessions,
  legacy LIS).
- Next: list the 84,630 by `document_id` from the lake Parquet with the
  pipeline's own error-page test, rank `state_link` against LIS on fifty of
  them, then the run.

### Files touched

- `apps/web/lib/xml/todo.ts` (the claim), `apps/web/docs/xml/window-7.md`
