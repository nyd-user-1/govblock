// The per-bill panel's examples, read ahead so /gdelt shows them filled rather
// than asking a reader to wait on GDELT's five-minute pacing. Same two calls the
// live route makes; a refusal waits and tries again, three times at most.
//
//   node scripts/gdelt/bill-examples.mjs

import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"

const OUT = new URL("../../apps/web/lib/data/gdelt-bill-examples.json", import.meta.url)
const PHRASES = ["CLARITY Act", "AI Kill Switch Act", "SAVE America Act", "ranked choice voting"]
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
const sleep = (s) => execFileSync("sleep", [String(s)])
const day = (stamp) => `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`

function ask(params) {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?${new URLSearchParams({ format: "json", ...params })}`
  for (let attempt = 1; attempt <= 3; attempt++) {
    let out = ""
    try {
      out = execFileSync("curl", ["-s", "--max-time", "120", "-A", UA, url], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
    } catch {}
    if (out.trim().startsWith("{")) return JSON.parse(out)
    console.log(`  refused (${params.mode}), attempt ${attempt}; waiting`)
    sleep(300)
  }
  return null
}

const examples = {}
for (const phrase of PHRASES) {
  const query = `"${phrase}" sourcecountry:US`
  const volume = ask({ query, mode: "timelinevolraw", timespan: "12m" })
  sleep(300)
  const list = ask({ query, mode: "artlist", maxrecords: "40", sort: "datedesc", timespan: "3m" })
  sleep(300)
  const rows = volume?.timeline?.[0]?.data ?? []
  examples[phrase] = {
    phrase,
    readAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    total: rows.reduce((n, p) => n + p.value, 0),
    curve: rows.map((p) => ({ date: day(p.date), articles: p.value, share: p.norm ? (p.value / p.norm) * 100 : 0 })),
    articles: (list?.articles ?? []).slice(0, 20).map((a) => ({ url: a.url, title: a.title, domain: a.domain, date: day(a.seendate), image: a.socialimage || null })),
  }
  writeFileSync(OUT, JSON.stringify(examples))
  console.log(`${phrase}: ${examples[phrase].total} articles over the year, ${examples[phrase].articles.length} listed`)
}
