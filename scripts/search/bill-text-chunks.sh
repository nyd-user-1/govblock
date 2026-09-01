#!/usr/bin/env bash
# govblock · scripts/search/bill-text-chunks.sh
#
# Populates "BillTextChunks" (see the .sql beside this file for why it exists).
#
#   . ~/.govblock/aurora.env && bash scripts/search/bill-text-chunks.sh [batch]
#
# Batched by document rather than run as one statement, for three reasons: a
# single transaction over 1.91 GB of detoasted text would hold a snapshot long
# enough to stall any CREATE INDEX CONCURRENTLY running beside it (measured on
# this cluster: 73 of one build's 83 seconds were spent waiting on exactly that);
# a failure halfway would lose the whole pass; and progress is visible.
#
# Restartable: `on conflict do nothing`, so a re-run costs the read and skips the
# write. Chunks overlap by 1,000 characters, including with the generated
# column's own first megabyte, so a phrase that straddles a boundary is still
# found on one side of it.
set -euo pipefail
: "${AURORA_POLICY_URL:?run: . ~/.govblock/aurora.env}"

BATCH="${1:-40}"
FIRST=1           # the whole document: search_tsv phrase-matches only its own first ~110 KB
STRIDE=79000      # 80,000-character chunks, overlapping by 1,000
LEN=80000
#
# 80,000 and not 800,000, which is what the first build used and what the sizing
# assumed. A tsvector stores lexeme positions in 14 bits: anything past **16,383**
# is clamped to 16,383, and phrase search (the `<->` a quoted query compiles to)
# reads those positions. In an 800,000-character chunk of legislative text —
# ~126,000 tokens — everything after roughly the first 110 KB collapses to the
# same position and stops matching as a phrase. Measured on Ohio HB96, the same
# literal string in two chunks:
#
#   chunk  4 (phrase at +681,376)   words match: t   phrase match: f
#   chunk 10 (phrase at  +11,386)   words match: t   phrase match: t
#
# Word queries were unaffected — the lexeme is there either way — so this fails
# only for quoted searches, and only silently. 100,000 characters measures at
# 15,744 tokens on the densest document we hold, 4% under the ceiling; 80,000
# leaves 23%, which is the margin worth paying ~6x the row count for. Bytes are
# almost unchanged: the same text, more rows.

psql -q -At "$AURORA_POLICY_URL" -c \
  'select count(*) from "BillTexts" where chars > 1000000' \
  | xargs -I{} echo "bill-text-chunks: {} documents over the limit"

while :; do
  moved=$(psql -q -At "$AURORA_POLICY_URL" -v ON_ERROR_STOP=1 <<SQL
with todo as (
  select t.document_id
    from "BillTexts" t
   where t.chars > 1000000
     and not exists (select 1 from "BillTextChunks" c where c.document_id = t.document_id)
   order by t.document_id
   limit $BATCH
),
ins as (
  insert into "BillTextChunks" (document_id, chunk_no, bill_id, state, session_id, tsv)
  select t.document_id, g.k, t.bill_id, t.state, t.session_id,
         to_tsvector('english', substr(t.text, $FIRST + g.k * $STRIDE, $LEN))
    from "BillTexts" t
    join todo using (document_id)
    cross join lateral generate_series(
      0, ceil((t.chars - ($FIRST - 1))::numeric / $STRIDE)::int - 1
    ) as g(k)
  on conflict (document_id, chunk_no) do nothing
  returning 1
)
select count(*) from ins;
SQL
)
  [ "${moved:-0}" -gt 0 ] || break
  done_docs=$(psql -q -At "$AURORA_POLICY_URL" -c 'select count(distinct document_id) from "BillTextChunks"')
  echo "bill-text-chunks: +$moved chunks · $done_docs documents done · $(date -u +%H:%M:%SZ)"
done

# A quoted heredoc, not -c: bash does not escape a single quote by doubling it,
# so '' inside a '-c' argument closes and reopens the quote and the table name
# arrives as an identifier rather than a string. That is how this line first
# shipped, and it errored with "function pg_total_relation_size("BillTextChunks")
# does not exist" after a twenty-minute build had already succeeded.
psql "$AURORA_POLICY_URL" <<'SQL'
analyze "BillTextChunks";
select count(distinct document_id) as documents,
       count(*) as chunks,
       avg(pg_column_size(tsv))::int as avg_tsv_bytes,
       pg_size_pretty(pg_table_size('"BillTextChunks"'::regclass)) as table,
       pg_size_pretty(pg_indexes_size('"BillTextChunks"'::regclass)) as index,
       pg_size_pretty(pg_total_relation_size('"BillTextChunks"'::regclass)) as total
  from "BillTextChunks";
SQL
