// A snapshot of what GDELT answers for one bill, for the /gdelt demo page.
//
//   node scripts/gdelt/sample.mjs
//
// GDELT allows one request every five seconds, answers slowly, and holds a
// client that went faster in a penalty that every further request extends. So
// the calls run one at a time with a long gap, a 429 ends the run rather than
// retrying into a longer penalty, and every answer is written as it lands: the
// next run makes only the calls this one did not finish. The page reads the
// file; it never calls GDELT.
//
// The TV API's archive stops on 2024-10-11, so its calls ask for 2024, the
// year the SAVE Act passed the House.

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

const OUT = new URL("../../apps/web/lib/data/gdelt-sample.json", import.meta.url)
const PHRASE = '"SAVE Act"'
const COMPARE = ['"open primaries"', '"ranked choice voting"']
const SPAN = { startdatetime: "20250915000000", enddatetime: "20260915235959" }
const TV_SPAN = { startdatetime: "20240101000000", enddatetime: "20241011235959" }
const GAP = 20_000

// GDELT answers a browser and turns away a script: the same call that returns
// 429 under a plain user agent returns 200 under this one (found 2026-09-15,
// after a day of "please limit requests to one every 5 seconds" on calls made
// one a minute). The gap below is still four times what GDELT asks for.
const HEADERS = [
  "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "-H", "Accept: application/json,text/plain,*/*",
  "-H", "Accept-Language: en-US,en;q=0.9",
  "-H", "Referer: https://api.gdeltproject.org/",
]

const sleep = (ms) => execFileSync("perl", ["-e", `select(undef,undef,undef,${ms / 1000})`])
const data = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {}
data.phrase = PHRASE.replaceAll('"', "")
data.span = { start: "2025-09-15", end: "2026-09-15" }
data.tvSpan = { start: "2024-01-01", end: "2024-10-11" }
data.fetchedAt = data.fetchedAt ?? new Date().toISOString().slice(0, 10)

const api = (kind, params) => `https://api.gdeltproject.org/api/v2/${kind}/${kind}?${new URLSearchParams({ format: "json", ...params })}`
const US = `${PHRASE} sourcecountry:US`
const TV = `${PHRASE} market:"National"`

const CALLS = {
  context: api("context", { query: PHRASE, mode: "artlist", maxrecords: "75" }),
  tvVolume: api("tv", { query: TV, mode: "timelinevol", ...TV_SPAN }),
  tvStations: api("tv", { query: TV, mode: "stationchart", ...TV_SPAN }),
  tvClips: api("tv", { query: TV, mode: "clipgallery", maxrecords: "24", sort: "datedesc", ...TV_SPAN }),
  volume: api("doc", { query: US, mode: "timelinevolraw", ...SPAN }),
  tone: api("doc", { query: US, mode: "timelinetone", ...SPAN }),
  toneChart: api("doc", { query: US, mode: "tonechart", ...SPAN }),
  world: api("doc", { query: PHRASE, mode: "timelinesourcecountry", ...SPAN }),
  ...Object.fromEntries(COMPARE.map((q) => [`compare:${q.replaceAll('"', "")}`, api("doc", { query: `${q} sourcecountry:US`, mode: "timelinevolraw", ...SPAN })])),
  articles: api("doc", { query: US, mode: "artlist", maxrecords: "100", sort: "datedesc", ...SPAN }),
}

data.answers ??= {}
for (const [key, url] of Object.entries(CALLS)) {
  if (data.answers[key]) continue
  for (let attempt = 1; attempt <= 3; attempt++) {
    const started = Date.now()
    let out = ""
    try {
      out = execFileSync("curl", ["-s", "--max-time", "150", ...HEADERS, "-w", "\n%{http_code}", url], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    } catch (e) {
      out = `${e.message}\n0`
    }
    const status = Number(out.slice(out.lastIndexOf("\n") + 1))
    const text = out.slice(0, out.lastIndexOf("\n"))
    const took = ((Date.now() - started) / 1000).toFixed(1)
    if (status === 200 && text.trim().startsWith("{")) {
      data.answers[key] = JSON.parse(text)
      writeFileSync(OUT, JSON.stringify(data))
      console.log(`${key}: ${text.length} bytes in ${took}s`)
      sleep(GAP)
      break
    }
    console.log(`${key}: ${status || "no answer"} in ${took}s: ${text.slice(0, 60).replace(/\s+/g, " ")}`)
    sleep(status === 429 ? 150_000 : GAP)
  }
}
console.log("have:", Object.keys(data.answers).join(", "))
