// A wire brief for every desk, so none of them is bare.
//
//   node scripts/news/starter.mjs                every desk with nothing today
//   node scripts/news/starter.mjs --states MS,WY  two of them
//   node scripts/news/starter.mjs --concurrency 4
//
// This is not the briefing. The Reporter's briefing reads the whole record
// through its tools and costs about half a dollar and a minute a desk; this
// reads only the press already crawled into news_stories and calls the model
// once, at about two cents. It exists so that a reader who opens a desk before
// anyone has paid for the real one still has something to read, and it is
// superseded the moment a Reporter briefing is filed the same day.
const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const BASE = (flag("base") || "http://localhost:3000").replace(/\/$/, "")
const CONCURRENCY = Math.max(1, Number(flag("concurrency")) || 3)

const STATES = "US AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ")
const codes = flag("states")
  ? flag("states").split(",").map((x) => x.trim().toUpperCase()).filter((c) => STATES.includes(c))
  : STATES

async function one(code) {
  const began = Date.now()
  const r = await fetch(`${BASE}/api/news/starter`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state: code }),
    signal: AbortSignal.timeout(150000),
  })
  const j = await r.json().catch(() => ({}))
  const seconds = Math.round((Date.now() - began) / 1000)
  if (j.error) return { code, note: j.error, usd: 0, seconds }
  if (!j.brief) return { code, note: j.reason ?? "nothing on file", usd: 0, seconds }
  return {
    code,
    note: j.fresh ? `${j.brief.content.length} chars` : "already had one today",
    usd: j.fresh ? (j.brief.usd ?? 0) : 0,
    seconds,
  }
}

const queue = [...codes]
let spent = 0
let written = 0
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (;;) {
      const code = queue.shift()
      if (!code) return
      try {
        const r = await one(code)
        spent += r.usd
        if (r.usd) written++
        console.log(`${r.code.padEnd(3)} ${r.note.padEnd(28)} $${r.usd.toFixed(3)} · ${r.seconds}s`)
      } catch (error) {
        console.log(`${code.padEnd(3)} ${String(error.message ?? error).slice(0, 90)}`)
      }
    }
  })
)
console.log(`\n${written} written, $${spent.toFixed(2)}`)
