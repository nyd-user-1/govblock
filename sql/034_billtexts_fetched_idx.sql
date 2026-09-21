-- The Database dashboard's live board (2026-09-20) asks which jurisdictions'
-- texts have landed in the last few minutes, and how many a day by loader. With
-- no index on fetched_at that was a scan of 3.5M rows per poll.
create index concurrently if not exists billtexts_fetched_idx on "BillTexts" (fetched_at desc);
