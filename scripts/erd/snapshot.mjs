// The policy database's shape, for /erd. Reads information_schema and the
// catalog over the RDS Data API (the same credentials the loaders use) and
// writes apps/web/lib/erd/schema.generated.json, which the page renders. Run
// it again whenever a table is added or a column changes:
//
//   node scripts/erd/snapshot.mjs
//
// Row counts are Postgres's own estimate (n_live_tup), not a count(*): close
// enough for a diagram, and free on a 90M-row table.
import { writeFileSync } from "node:fs"
import { join } from "node:path"

import { q, WEB } from "../laws/lib/db.mjs"

const OUT = join(WEB, "lib/erd/schema.generated.json")
const SCHEMAS = "('pg_catalog','information_schema')"

const TYPE = `case
  when data_type='character varying' then 'varchar('||coalesce(character_maximum_length::text,'')||')'
  when data_type='character' then 'char('||coalesce(character_maximum_length::text,'')||')'
  when data_type='numeric' and numeric_precision is not null then 'numeric('||numeric_precision||','||coalesce(numeric_scale,0)||')'
  when data_type='timestamp without time zone' then 'timestamp'
  when data_type='timestamp with time zone' then 'timestamptz'
  when data_type='ARRAY' then regexp_replace(udt_name,'^_','')||'[]'
  when data_type='USER-DEFINED' then udt_name
  else data_type end`

const tables = await q(`select table_schema s, table_name t, table_type k from information_schema.tables where table_schema not in ${SCHEMAS} order by 1,2`)
const columns = await q(`select table_schema s, table_name t, column_name c, ${TYPE} ty, is_nullable n, column_default d, ordinal_position o from information_schema.columns where table_schema not in ${SCHEMAS} order by 1,2,7`)
const matviews = await q(`select n.nspname s, c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='m' order by 1,2`)
const matviewColumns = await q(`select n.nspname s, c.relname t, a.attname c, format_type(a.atttypid,a.atttypmod) ty, case when a.attnotnull then 'NO' else 'YES' end n, a.attnum o from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped where c.relkind='m' order by 1,2,6`)
const constraints = await q(`select tc.table_schema s, tc.table_name t, tc.constraint_name n, tc.constraint_type k,
    string_agg(kcu.column_name, ',' order by kcu.ordinal_position) cols,
    min(ccu.table_schema) rs, min(ccu.table_name) rt, string_agg(distinct ccu.column_name, ',') rcols
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema
  left join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and tc.constraint_type='FOREIGN KEY'
  where tc.table_schema not in ${SCHEMAS} and tc.constraint_type in ('PRIMARY KEY','FOREIGN KEY','UNIQUE')
  group by 1,2,3,4 order by 1,2,4,3`)
const stats = await q(`select schemaname s, relname t, n_live_tup n, pg_total_relation_size(relid) b from pg_stat_all_tables where schemaname not in ${SCHEMAS}`)
const indexes = await q(`select schemaname s, tablename t, indexname n, indexdef d from pg_indexes where schemaname not in ${SCHEMAS} order by 1,2,3`)

const key = (s, t) => `${s}.${t}`
const byTable = new Map()
const add = (s, t, kind) => {
  const k = key(s, t)
  if (!byTable.has(k)) byTable.set(k, { schema: s, name: t, kind, rows: null, bytes: null, columns: [], pk: [], uniques: [], fks: [], indexes: [] })
  return byTable.get(k)
}
for (const r of tables) add(r.s, r.t, r.k === "VIEW" ? "view" : "table")
for (const r of matviews) add(r.s, r.t, "matview")
for (const r of [...columns, ...matviewColumns]) add(r.s, r.t).columns.push({ name: r.c, type: r.ty, nullable: r.n === "YES", default: r.d ?? null })
for (const r of constraints) {
  const t = byTable.get(key(r.s, r.t))
  if (!t) continue
  const cols = r.cols.split(",")
  if (r.k === "PRIMARY KEY") t.pk = cols
  else if (r.k === "UNIQUE") t.uniques.push(cols)
  else t.fks.push({ name: r.n, columns: cols, refSchema: r.rs, refTable: r.rt, refColumns: r.rcols.split(",") })
}
for (const r of stats) {
  const t = byTable.get(key(r.s, r.t))
  if (t) Object.assign(t, { rows: Number(r.n), bytes: Number(r.b) })
}
for (const r of indexes) byTable.get(key(r.s, r.t))?.indexes.push({ name: r.n, definition: r.d })

const out = {
  generatedAt: new Date().toISOString(),
  database: "policy",
  tables: [...byTable.values()].sort((a, b) => a.schema.localeCompare(b.schema) || a.name.localeCompare(b.name)),
}
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n")
console.log(`${out.tables.length} relations → ${OUT}`)
