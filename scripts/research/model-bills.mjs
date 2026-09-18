// Copy-and-paste lawmaking: where ALEC's model bills turn up in state bills.
// Research recipe report #3 (2026-09-18), stages 3–5 (gather, classify,
// verify), run once and written to a dated data file the page reads:
//
//   node scripts/research/model-bills.mjs
//
// For each model act, its short title ("may be cited as the X Act", else its
// title) is searched as a phrase in every state bill's text (BillTexts, the
// full-text index). A title match is then confirmed against three sentences
// of the model's body, ten words each, taken at 30, 50 and 70 percent of the
// way through: a bill whose text carries one of them is a copy; a title match
// alone is a namesake. Generic titles (fewer than three distinctive words) are
// skipped.

import { writeFileSync } from "node:fs"
import { q } from "../laws/lib/db.mjs"

// The shared db helper sends every value as text, so arrays go as Postgres literals.
const arr = (xs) => `{${xs.map((x) => `"${String(x).replace(/(["\\])/g, "\\$1")}"`).join(",")}}`

const OUT = new URL("../../apps/web/lib/reports/data/model-bill-matches.json", import.meta.url)
const STOP = new Set("a an and the of to for in on act resolution state this by with or from at as be policy model".split(" "))

// A page at a time: the Data API answers at most a megabyte, and the texts are several.
const ids = (await q(`select model_id from "ModelBills" where source = 'alec' and text is not null and type = 'Model Policy' order by model_id`)).map((r) => r.model_id)
const models = []
for (let i = 0; i < ids.length; i += 60) {
  models.push(...(await q(`select model_id, title, year, issue, type, status, text, url from "ModelBills" where model_id = any($1::text[])`, [arr(ids.slice(i, i + 60))])))
}

function shortTitle(m) {
  const cited = m.text.match(/may be cited as (?:the )?[“"']?([A-Z][^”"'.\n]{5,90}?(?:Act|Law))/)
  return (cited ? cited[1] : m.title).replace(/\s+/g, " ").trim()
}
function phrases(text) {
  const words = text.replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean)
  return [0.3, 0.5, 0.7].map((f) => words.slice(Math.floor(words.length * f), Math.floor(words.length * f) + 10).join(" ")).filter((p) => p.split(" ").length === 10)
}
const distinctive = (t) => t.toLowerCase().split(/\W+/).filter((w) => w && !STOP.has(w)).length >= 3

const todo = models.map((m) => ({ ...m, short: shortTitle(m) })).filter((m) => distinctive(m.short))
console.log(`${models.length} model policies, ${todo.length} with distinctive titles`)

const results = []
let done = 0
async function one(m) {
  try {
    const hits = await q(
      `select b.bill_id, b.state, b.bill_number, b.session_title, b.status, b.status_desc, left(b.title, 160) as title
         from "BillTexts" t join "Bills" b using (bill_id) where t.search_tsv @@ phraseto_tsquery('english', $1) group by 1,2,3,4,5,6,7`,
      [m.short]
    )
    let confirmed = new Set()
    if (hits.length) {
      const ids = hits.map((h) => Number(h.bill_id))
      for (const p of phrases(m.text)) {
        const c = await q(`select distinct bill_id from "BillTexts" where bill_id = any($1::bigint[]) and search_tsv @@ phraseto_tsquery('english', $2)`, [arr(ids), p])
        c.forEach((r) => confirmed.add(Number(r.bill_id)))
      }
    }
    results.push({ model_id: m.model_id, title: m.title, short: m.short, year: m.year, issue: m.issue, status: m.status, url: m.url, hits: hits.map((h) => ({ bill_id: Number(h.bill_id), state: h.state, bill_number: h.bill_number, session: h.session_title, status: Number(h.status), status_desc: h.status_desc, title: h.title, copy: confirmed.has(Number(h.bill_id)) })) })
  } catch (e) {
    results.push({ model_id: m.model_id, title: m.title, short: m.short, error: String(e.message).slice(0, 120), hits: [] })
  }
  done++
  if (done % 25 === 0) {
    console.log(`${done}/${todo.length}`)
    writeFileSync(OUT, JSON.stringify({ built: new Date().toISOString().slice(0, 10), models: models.length, searched: todo.length, results }, null, 0))
  }
}
const queue = [...todo]
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await one(queue.shift()) }))
writeFileSync(OUT, JSON.stringify({ built: new Date().toISOString().slice(0, 10), models: models.length, searched: todo.length, results }, null, 0))
console.log(`done: ${results.length} models, ${results.reduce((a, r) => a + r.hits.length, 0)} bills, ${results.reduce((a, r) => a + r.hits.filter((h) => h.copy).length, 0)} copies`)
