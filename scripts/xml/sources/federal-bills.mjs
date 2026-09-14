// Federal bills, a Congress at a time, from GovInfo's bulk data: one zip per
// Congress, session and bill type, holding every printing as the XML GPO
// published (the Bill DTD for most, USLM for a few). These are the same zips
// livingston's api/bill-text.ts read to fill "BillTexts" with their tags
// stripped; reading them again is how the tags come back. GovInfo publishes
// bill XML from the 113th Congress (2013) on.
import { createRequire } from "node:module"

import { q } from "../../laws/lib/db.mjs"
import { congressOf, federalBillWork } from "../lib/address.mjs"

const require = createRequire(import.meta.url)
const { Unzip, UnzipInflate } = require("fflate")

const BULK = "https://www.govinfo.gov/bulkdata/BILLS"
const TYPES = ["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"]
const PREFIX = { hr: "HB", s: "SB", hjres: "HJR", sjres: "SJR", hconres: "HCR", sconres: "SCR", hres: "HR", sres: "SR" }
const LABEL = { hr: "H.R.", s: "S.", hjres: "H.J.Res.", sjres: "S.J.Res.", hconres: "H.Con.Res.", sconres: "S.Con.Res.", hres: "H.Res.", sres: "S.Res." }
// livingston's order, which makes "BillTexts".document_id = -(bill_id·100 + slot + 1).
const VERSION_CODES = ["as", "ash", "ath", "ats", "cdh", "cds", "cph", "cps", "eah", "eas", "ech", "eh", "enr", "eph", "es", "fah", "fph", "fps", "hdh", "hds", "ih", "iph", "ips", "is", "lth", "lts", "oph", "ops", "pap", "pcs", "pp", "pwah", "rah", "ras", "rch", "rcs", "rdh", "rds", "reah", "renr", "res", "rfh", "rfs", "rh", "rih", "ris", "rs", "rth", "rts", "sas", "sc"]
export const FIRST_CONGRESS_WITH_XML = 113

const UA = "govblock-xml/1.0 (+https://gov.nysgpt.com; brendan@nysgpt.com)"

/** Every "Bills" row of a federal session: bill_number → bill_id. */
async function billIds(year) {
  const out = new Map()
  let after = 0
  for (;;) {
    const rows = await q(`select bill_id, bill_number from "Bills" where state = 'US' and session_id = $1 and bill_id > $2 order by bill_id limit 5000`, [year, after])
    for (const r of rows) out.set(String(r.bill_number).toUpperCase(), Number(r.bill_id))
    if (rows.length < 5000) break
    after = rows[rows.length - 1].bill_id
  }
  return out
}

async function unzipAll(bytes) {
  const files = []
  const unzip = new Unzip()
  unzip.register(UnzipInflate)
  unzip.onfile = (file) => {
    const chunks = []
    file.ondata = (err, data, final) => {
      if (err) return
      chunks.push(data)
      if (final) files.push({ name: file.name, body: Buffer.concat(chunks).toString("utf8") })
    }
    file.start()
  }
  const STEP = 1 << 16
  for (let i = 0; i < bytes.length; i += STEP) unzip.push(bytes.subarray(i, Math.min(i + STEP, bytes.length)), i + STEP >= bytes.length)
  return files
}

/**
 * The job's documents. `unit` is the session year ('2025'). Yields tasks for
 * the controller; `log` reports each zip.
 */
export async function* federalBills({ unit, log }) {
  const year = Number(unit)
  const congress = congressOf(year)
  if (congress < FIRST_CONGRESS_WITH_XML) throw Object.assign(new Error(`GovInfo publishes no bill XML before the ${FIRST_CONGRESS_WITH_XML}th Congress`), { blocked: true })
  const ids = await billIds(year)
  log(`${ids.size.toLocaleString()} bills on file for the ${congress}th Congress`)

  for (const session of [1, 2]) {
    for (const type of TYPES) {
      const url = `${BULK}/${congress}/${session}/${type}/BILLS-${congress}-${session}-${type}.zip`
      const t0 = Date.now()
      let response
      for (let attempt = 0; ; attempt++) {
        response = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(600_000) }).catch((e) => ({ ok: false, status: String(e?.message ?? e) }))
        if (response.ok || response.status === 404 || attempt >= 3) break
        await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)))
      }
      if (response.status === 404) {
        log(`· ${congress}/${session}/${type}: none published`)
        continue
      }
      if (!response.ok) {
        yield { fallout: { stage: "source", reason: `GovInfo ${response.status}`, detail: url, sourceRef: url } }
        continue
      }
      const files = await unzipAll(new Uint8Array(await response.arrayBuffer()))
      log(`· ${congress}/${session}/${type}: ${files.length.toLocaleString()} printings in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
      yield { count: files.length }

      for (const f of files) {
        const m = /BILLS-(\d+)([a-z]+?)(\d+)([a-z]+)\.xml$/i.exec(f.name)
        if (!m) continue
        const [, c, t, n, version] = m
        const stage = version.toLowerCase()
        const work = federalBillWork(c, t, n)
        const billId = ids.get(`${PREFIX[t.toLowerCase()]}${Number(n)}`)
        const slot = VERSION_CODES.indexOf(stage)
        const pkg = `BILLS-${c}${t}${n}${version}`
        yield {
          work,
          unit: stage,
          session: String(congress),
          label: `${LABEL[t.toLowerCase()] ?? t.toUpperCase()} ${Number(n)}`,
          sourceUrl: `https://www.govinfo.gov/content/pkg/${pkg}/xml/${pkg}.xml`,
          sourceRef: billId && slot >= 0 ? `BillTexts:${-(billId * 100 + slot + 1)}` : `govinfo:${pkg}`,
          frontEnd: "US",
          source: { kind: "xml", body: f.body, url: `${url}#${f.name}` },
          info: { kind: "bill", root: "bill", stage, number: `${LABEL[t.toLowerCase()] ?? t.toUpperCase()} ${Number(n)}`, publisher: "United States Government Publishing Office", fidelity: "native-xml", preferDocDate: true, docDateBasis: "printed" },
        }
      }
    }
  }
}
