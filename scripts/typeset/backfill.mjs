// Typeset documents, built ahead of the first reader, into typeset_documents.
//
//   node scripts/typeset/backfill.mjs --bill 2058568               one bill's newest version
//   node scripts/typeset/backfill.mjs --state US --session 2025   a session's bills with text
//   node scripts/typeset/backfill.mjs --state US --limit 50       the first fifty
//   node scripts/typeset/backfill.mjs --state US --dry            list what would be built
//   node scripts/typeset/backfill.mjs --state US --force          rebuild rows already stored
//
// The app builds (USLM, the HTML, Plate's deserializer, the static snapshot all
// live there); this runner picks the bills, skips the documents already stored
// under the app's current builder, and asks the app to build the rest one at a
// time through /api/typeset/documents. A document is marked stored only once
// every slice of it is written, so resume (the default) is honest: an
// interrupted run is restarted with the same command.
//
// --origin is the app to ask, http://127.0.0.1:3000 by default (the dev server,
// run on the box). Anywhere but development the route wants
// TYPESET_BACKFILL_TOKEN, read from apps/web/.env.local or the environment.
//
// Needs the table: sql/004_typeset_documents.sql.
import { env, q } from "../laws/lib/db.mjs"

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const value = (name) => {
  const at = argv.indexOf(`--${name}`)
  return at >= 0 ? argv[at + 1] : null
}

const STATE = value("state")?.toUpperCase() ?? null
const SESSION = value("session") ? Number(value("session")) : null
const BILL = value("bill") ? Number(value("bill")) : null
const LIMIT = Number(value("limit") ?? 0) || null
const DRY = flag("dry")
const FORCE = flag("force")
const ORIGIN = (value("origin") ?? process.env.TYPESET_ORIGIN ?? "http://127.0.0.1:3000").replace(/\/$/, "")
const TOKEN = process.env.TYPESET_BACKFILL_TOKEN ?? env.TYPESET_BACKFILL_TOKEN ?? null

if (!STATE && !BILL) {
  console.log("name the bills: --bill <id>, or --state <XX> [--session <id>] [--limit n]")
  process.exit(1)
}

const headers = TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}
const plural = (n, word) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`
const kb = (bytes) => `${Math.round(bytes / 1024).toLocaleString("en-US")} KB`

async function ask(path) {
  const response = await fetch(`${ORIGIN}${path}`, { headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${response.status} ${body.error ?? response.statusText}`)
  return body
}

const { builder } = await ask("/api/typeset/documents?builder=1")

// The newest version with text for each bill: the version Typeset opens.
const bills = await q(
  `select t.bill_id, max(t.document_id) as document_id
     from "BillTexts" t join "Bills" b on b.bill_id = t.bill_id
    where t.text is not null
      and ($1::text is null or b.state = $1)
      and ($2::bigint is null or b.session_id = $2)
      and ($3::bigint is null or b.bill_id = $3)
    group by t.bill_id
    order by t.bill_id
    ${LIMIT ? `limit ${LIMIT}` : ""}`,
  [STATE, SESSION, BILL]
)

let stored = new Set()
if (!FORCE && bills.length > 0) {
  try {
    const rows = await q(`select document_id from typeset_documents where builder = $1 and document_id = any($2::bigint[])`, [builder, `{${bills.map((b) => b.document_id).join(",")}}`])
    stored = new Set(rows.map((r) => Number(r.document_id)))
  } catch (error) {
    if (!DRY) throw error
    console.log(`typeset_documents is not readable (${String(error.message ?? error).slice(0, 80)}); listing every bill`)
  }
}
const todo = bills.filter((b) => !stored.has(Number(b.document_id)))

console.log(`${plural(bills.length, "bill")} with text · ${plural(stored.size, "document")} already stored under builder ${builder} · ${plural(todo.length, "document")} to build · ${ORIGIN}`)
if (DRY) {
  for (const b of todo.slice(0, 50)) console.log(`  bill ${b.bill_id} · document ${b.document_id}`)
  if (todo.length > 50) console.log(`  … and ${plural(todo.length - 50, "more")}`)
  process.exit(0)
}

let built = 0
let failed = 0
let bytes = 0
const started = Date.now()
for (const [i, b] of todo.entries()) {
  try {
    const result = await ask(`/api/typeset/documents?bill=${b.bill_id}&version=${b.document_id}`)
    if (!result.stored) throw new Error("built but not stored (is the table there?)")
    built++
    bytes += result.htmlBytes + result.valueBytes + result.snapshotBytes
    console.log(`  ${i + 1}/${todo.length} bill ${b.bill_id} · document ${b.document_id} · html ${kb(result.htmlBytes)}, value ${kb(result.valueBytes)}, snapshot ${kb(result.snapshotBytes)} · ${(result.ms / 1000).toFixed(1)} s`)
  } catch (error) {
    failed++
    console.error(`  ${i + 1}/${todo.length} bill ${b.bill_id} · document ${b.document_id} · failed: ${String(error.message ?? error).slice(0, 200)}`)
  }
}

console.log(`\n${plural(built, "document")} built and stored, ${plural(failed, "failure")}, ${kb(bytes)} before gzip, ${Math.round((Date.now() - started) / 1000)} s`)
if (failed) process.exitCode = 1
