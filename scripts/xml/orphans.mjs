// Orphaned objects under lake/v1/xml/ (window 6b for window 7, 2026-09-14): objects no
// `expressions` row names. A rebuild that re-addressed a printing removed the old row but
// left its object, because the pipeline box's role cannot delete. A dry run only: it lists,
// counts and writes the keys; it deletes nothing.
//
//   node scripts/xml/orphans.mjs [--out logs/orphans-<stamp>.tsv]
//
// The pipeline may be writing while this runs, so the bucket is listed first and the index
// read after; an object modified in the hour before the listing began is counted apart as
// recent, never as an orphan. Index rows whose object is missing are counted too.
import { createWriteStream, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { createRequire } from "node:module"

import { q } from "../laws/lib/db.mjs"

const require = createRequire(import.meta.url)
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3")

const BUCKET = "govblock-lake-638175140432"
const PREFIX = "lake/v1/xml/"
const RECENT_MS = 60 * 60 * 1000
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : null
}
const started = new Date()
const out = arg("--out") ?? `logs/orphans-${started.toISOString().replace(/[:.]/g, "-")}.tsv`
const log = (...parts) => console.log(new Date().toISOString(), ...parts)

const s3 = new S3Client({ region: "us-east-1" })
const jurisdictionOf = (key) => key.slice(PREFIX.length).split("/")[0] || "?"

// 1. The bucket.
const objects = new Map()
let token
let pages = 0
do {
  const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX, ContinuationToken: token, MaxKeys: 1000 }))
  for (const o of page.Contents ?? []) objects.set(o.Key, { bytes: o.Size ?? 0, modified: o.LastModified?.getTime() ?? 0 })
  token = page.IsTruncated ? page.NextContinuationToken : undefined
  if (++pages % 200 === 0) log(`listed ${objects.size.toLocaleString()} objects`)
} while (token)
log(`listed ${objects.size.toLocaleString()} objects in ${pages} pages`)

// 2. The index, paged by id.
const indexed = new Set()
let after = 0
for (;;) {
  const rows = await q(`select id, s3_key from expressions where id > $1 order by id limit 5000`, [after])
  for (const r of rows) if (r.s3_key) indexed.add(r.s3_key)
  if (rows.length < 5000) break
  after = rows[rows.length - 1].id
  if (indexed.size % 200000 < 5000) log(`read ${indexed.size.toLocaleString()} index keys`)
}
log(`read ${indexed.size.toLocaleString()} index keys`)

// 3. The difference, by jurisdiction.
const by = new Map()
const row = (j) => {
  if (!by.has(j)) by.set(j, { objects: 0, bytes: 0, orphans: 0, orphanBytes: 0, recent: 0, recentBytes: 0, missing: 0 })
  return by.get(j)
}
mkdirSync(dirname(out), { recursive: true })
const file = createWriteStream(out)
file.write("key\tbytes\tmodified\n")
const cutoff = started.getTime() - RECENT_MS
for (const [key, o] of objects) {
  const r = row(jurisdictionOf(key))
  r.objects++
  r.bytes += o.bytes
  if (indexed.has(key)) continue
  if (o.modified >= cutoff) {
    r.recent++
    r.recentBytes += o.bytes
    continue
  }
  r.orphans++
  r.orphanBytes += o.bytes
  file.write(`${key}\t${o.bytes}\t${new Date(o.modified).toISOString()}\n`)
}
for (const key of indexed) if (!objects.has(key)) row(jurisdictionOf(key)).missing++
await new Promise((resolve) => file.end(resolve))

const mb = (n) => (n / 1048576).toFixed(1)
const total = { objects: 0, bytes: 0, orphans: 0, orphanBytes: 0, recent: 0, recentBytes: 0, missing: 0 }
console.log("\n| Jurisdiction | Objects | Orphans | Orphan MB | Recent, not counted | Index rows without an object |")
console.log("|---|---:|---:|---:|---:|---:|")
for (const [j, r] of [...by].sort((a, b) => b[1].orphans - a[1].orphans || a[0].localeCompare(b[0]))) {
  for (const k of Object.keys(total)) total[k] += r[k]
  if (r.orphans || r.recent || r.missing) console.log(`| ${j} | ${r.objects.toLocaleString()} | ${r.orphans.toLocaleString()} | ${mb(r.orphanBytes)} | ${r.recent.toLocaleString()} | ${r.missing.toLocaleString()} |`)
}
console.log(`| **All** | ${total.objects.toLocaleString()} | ${total.orphans.toLocaleString()} | ${mb(total.orphanBytes)} | ${total.recent.toLocaleString()} | ${total.missing.toLocaleString()} |`)
log(`orphan keys written to ${out}; nothing deleted`)
