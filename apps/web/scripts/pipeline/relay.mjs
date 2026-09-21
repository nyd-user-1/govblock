// A relay for legislatures that refuse a data centre's address (2026-09-20).
//
//   node scripts/pipeline/relay.mjs PA [--limit 500] [--dry-run]
//   node scripts/pipeline/launch.mjs convert PA        (then: the box turns the parked PDFs into text)
//
// Pennsylvania's www.palegis.us answers this machine 200 and answers an EC2 box
// 403 at any pace — four lanes or one lane a second and a half apart, the same
// five strikes and the host dropped, with the same identified User-Agent. The
// box cannot fetch those bills; this machine can. So it fetches them, one every
// second and a half, and parks each PDF where livingston's walker parks a PDF
// it defers (s3://livingston-bill-pdfs-…/pdf/<STATE>/<document_id>.pdf), marking
// the row `pdf-deferred: s3://…` exactly as the walker would. `--source
// pdf-batch` on a box converts them. Nothing new on the box side: the relay
// only stands in for the one request the box is refused.
//
// Only rows the walker gave up on for the host's sake are taken: `host-dropped`
// and `fetch failed`, never `robots` — a site that said no is not asked again.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const REGION = "us-east-1"
const PDF_BUCKET = "livingston-bill-pdfs-638175140432"
// livingston's own (api/_lib/polite-fetch.ts): the relay is the same reader from another address.
const UA = "Mozilla/5.0 (compatible; livingston-bill-text/1.0; legislative full-text archive; +https://github.com/nyd-user-1/livingston; contact: brendan@nysgpt.com)"

const [state, ...rest] = process.argv.slice(2)
const dry = rest.includes("--dry-run")
const limit = rest.includes("--limit") ? Number(rest[rest.indexOf("--limit") + 1]) : 500
if (!/^[A-Z]{2}$/.test(state ?? "")) {
  console.error("usage: relay.mjs XX [--limit n] [--dry-run]")
  process.exit(2)
}

const env = Object.fromEntries(
  fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n").map((l) => l.trim()).filter((l) => /^POLICY_(CLUSTER|SECRET)_ARN=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")])
)
function sql(statement) {
  for (let i = 0; i < 8; i++) {
    try {
      const out = execFileSync("aws", ["rds-data", "execute-statement", "--region", REGION, "--resource-arn", env.POLICY_CLUSTER_ARN, "--secret-arn", env.POLICY_SECRET_ARN, "--database", "policy", "--format-records-as", "JSON", "--sql", statement, "--query", "formattedRecords", "--output", "text"], { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] })
      return out.trim() && out.trim() !== "None" ? JSON.parse(out) : []
    } catch (e) {
      if (!/resuming/i.test(String(e.stderr ?? e.message))) throw e
      execFileSync("sleep", ["15"])
    }
  }
  throw new Error("Aurora is still resuming")
}

const rows = sql(
  `select t.document_id, d.state_link from "BillTexts" t join "Documents" d on d.document_id = t.document_id join "Bills" b on b.bill_id = d.bill_id
    where t.state = '${state}' and t.text is null and (t.error like 'host-dropped%' or t.error like 'fetch: fetch failed%')
      and b.session_id >= 2023 and d.document_type = 'text' order by t.document_id limit ${Math.max(1, Math.min(limit, 5000))}`
)
console.log(`${state}: ${rows.length} document(s) the box was refused`)
if (dry || !rows.length) process.exit(0)

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gb-relay-"))
let parked = 0
const failed = []
for (const [i, r] of rows.entries()) {
  const file = path.join(dir, `${r.document_id}.pdf`)
  try {
    const res = await fetch(r.state_link, { headers: { "User-Agent": UA, Accept: "*/*" }, redirect: "follow", signal: AbortSignal.timeout(60_000) })
    const body = Buffer.from(await res.arrayBuffer())
    if (!res.ok || body.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`HTTP ${res.status}, ${body.length} bytes, not a PDF`)
    fs.writeFileSync(file, body)
    const key = `pdf/${state}/${r.document_id}.pdf`
    execFileSync("aws", ["s3", "cp", file, `s3://${PDF_BUCKET}/${key}`, "--region", REGION, "--quiet", "--content-type", "application/pdf"])
    sql(`update "BillTexts" set error = 'pdf-deferred: s3://${PDF_BUCKET}/${key}', mime = 'application/pdf', fetched_at = now() where document_id = ${Number(r.document_id)} and text is null`)
    parked += 1
  } catch (e) {
    failed.push(`${r.document_id}: ${String(e.message).slice(0, 80)}`)
  }
  fs.rmSync(file, { force: true })
  if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${rows.length} · ${parked} parked`)
  await new Promise((ok) => setTimeout(ok, 1500))
}
fs.rmSync(dir, { recursive: true, force: true })
console.log(`${state}: ${parked} parked for conversion, ${failed.length} failed`)
for (const f of failed.slice(0, 10)) console.log(`  ${f}`)
