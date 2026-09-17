// What the ranked-choice ballot files hold, before the loader trusts them:
// every header, and every value in a rank column that is not a candidate.
//
//   node scripts/elections/survey.mjs > /tmp/rcv-survey.json

import { createRequire } from "node:module"
import { rows } from "./csv.mjs"

const require = createRequire(import.meta.url)
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3")

const BUCKET = "govblock-lake-638175140432"
const PREFIX = "lake/v1/elections/rcv-ballots/"
const s3 = new S3Client({ region: "us-east-1" })

const keys = []
for (let token; ; ) {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX, ContinuationToken: token }))
  for (const o of r.Contents ?? []) if (o.Key.endsWith(".csv")) keys.push(o.Key)
  if (!r.IsTruncated) break
  token = r.NextContinuationToken
}

const headers = new Map()
const markers = new Map()
const files = []
for (const key of keys) {
  const body = (await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))).Body
  let header = null
  let rankCols = []
  const values = new Map()
  let ballots = 0
  for await (const row of rows(body)) {
    if (!header) {
      header = row
      rankCols = header.map((h, i) => (/^rank\d+$/i.test(h) ? i : -1)).filter((i) => i >= 0)
      const shape = header.filter((h) => !/^rank\d+$/i.test(h)).join("|") + ` +${rankCols.length} ranks`
      headers.set(shape, (headers.get(shape) ?? 0) + 1)
      continue
    }
    if (row.length === 1 && row[0] === "") continue
    ballots++
    for (const i of rankCols) values.set(row[i], (values.get(row[i]) ?? 0) + 1)
  }
  const candidates = []
  for (const [v, n] of values) {
    if (/^(skipped|overvote|undervote|writein|write-in|blank|)$/i.test(v) || /^[a-z_ -]+$/.test(v)) markers.set(v, (markers.get(v) ?? 0) + n)
    else candidates.push(v)
  }
  files.push({ file: key.slice(PREFIX.length), ballots, ranks: rankCols.length, candidates: candidates.length })
  process.stderr.write(".")
}

console.log(JSON.stringify({ files: files.length, ballots: files.reduce((s, f) => s + f.ballots, 0), headers: [...headers], markers: [...markers].sort((a, b) => b[1] - a[1]), largest: [...files].sort((a, b) => b.ballots - a.ballots).slice(0, 8), mostCandidates: [...files].sort((a, b) => b.candidates - a.candidates).slice(0, 8) }, null, 1))
