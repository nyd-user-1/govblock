// Run the Reporter over a desk and file what it writes.
//
//   node scripts/news/brief.mjs --states NY,VT          this week on two desks
//   node scripts/news/brief.mjs --states NY --phrase "open primaries"
//   node scripts/news/brief.mjs --all                   every desk with none today
//   node scripts/news/brief.mjs --states NY --dry       run it, file nothing
//
// The briefing is written by the Reporter running the same loop the browser
// drives on /briefing — a round per request against /api/agents/chat, tools
// run server-side, the conversation carried back and forth (lib/agents/loop.ts
// explains why it is a round per request and not a server-side loop).
//
// This is that loop with a script in the browser's place, which is what a
// scheduled nightly briefing needs: no reader has to press a button for the
// desk to have something on it in the morning.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const has = (name) => args.includes(`--${name}`)
const BASE = (flag("base") || "http://localhost:3000").replace(/\/$/, "")
const DRY = has("dry")
const PHRASE = flag("phrase") || ""
const MAX_ROUNDS = Math.max(1, Number(flag("rounds")) || 18)

const STATE_NAMES = {
  US: "Congress", AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** One desk: drive the loop to the end, then file what came out. */
async function brief(code) {
  const desk = STATE_NAMES[code]
  const began = Date.now()
  const text = PHRASE
    ? `Write the briefing on "${PHRASE}" for the ${desk} desk. Read the record for what it says about "${PHRASE}" — bills and their actions, roll calls, hearings, committees, the members behind it — and the press on it, then write.`
    : `Write this week's briefing for the ${desk} desk. Read the record — what was introduced, what moved, how the chamber voted, what was heard, who sponsored and who broke ranks — and the press on all of it, then write.`

  let carry = null
  // Everything it wrote, and — separately — what it wrote after its last tool
  // call. The second is the briefing; the first is the model talking itself
  // through the work ("Good, now let me open the key bills…"), which is not
  // for the reader.
  let prose = ""
  let answer = ""
  const sources = []
  const seen = new Set()
  let rounds = 0
  let usd = 0
  let model = ""
  let calls = 0

  while (rounds < MAX_ROUNDS) {
    rounds++
    const response = await fetch(`${BASE}/api/agents/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        carry
          ? { agent: "reporter", jurisdiction: code, state: carry }
          : { agent: "reporter", jurisdiction: code, turns: [{ role: "user", text }] }
      ),
      signal: AbortSignal.timeout(180000),
    })
    if (!response.ok || !response.body) throw new Error(`chat ${response.status}`)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let done = false
    let roundText = 0
    for (;;) {
      const { done: finished, value } = await reader.read()
      if (finished) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const raw of lines) {
        if (!raw.trim()) continue
        let event
        try {
          event = JSON.parse(raw)
        } catch {
          continue
        }
        if (event.t === "text") {
          if (prose && roundText === 0) prose += "\n\n"
          if (answer && roundText === 0) answer += "\n\n"
          roundText++
          prose += event.v
          answer += event.v
        } else if (event.t === "open") model = event.label ?? model
        else if (event.t === "tool") {
          calls++
          answer = ""
        }
        else if (event.t === "tool_result") {
          for (const s of event.sources ?? []) {
            if (seen.has(s.url)) continue
            seen.add(s.url)
            sources.push(s)
          }
        } else if (event.t === "state") {
          carry = { messages: event.messages }
          done = Boolean(event.done)
        } else if (event.t === "done") usd += event.usd ?? 0
        else if (event.t === "error") throw new Error(event.message)
      }
    }
    if (done) break
  }

  const seconds = Math.round((Date.now() - began) / 1000)
  // The same trim the page applies.
  let content = (answer.trim() || prose.trim())
  const rule = content.slice(0, 600).search(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/m)
  if (rule >= 0) content = content.slice(content.indexOf("\n", rule) + 1).trim()
  content = content
    .split(/\n/)
    .filter((line, i) => !(i < 2 && /^(good[.,]|okay[.,]|right[.,]|now |let me |i (now )?have|i'?ll |here is|here'?s )/i.test(line.trim())))
    .join("\n")
    .trim()
  let filed = false
  if (!DRY && content.length >= 40) {
    const reply = await fetch(`${BASE}/api/news/brief`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        state: code,
        phrase: PHRASE || undefined,
        content,
        sources,
        model,
        usd,
      }),
    }).then((r) => r.json())
    filed = Boolean(reply.brief)
  }
  return { code, desk, rounds, calls, sources: sources.length, chars: content.length, usd, seconds, filed }
}

const codes = has("all")
  ? Object.keys(STATE_NAMES)
  : (flag("states") || "NY").split(",").map((x) => x.trim().toUpperCase()).filter((c) => STATE_NAMES[c])

console.log(`${codes.length} desk${codes.length === 1 ? "" : "s"}${PHRASE ? ` on "${PHRASE}"` : ""}${DRY ? " (filing nothing)" : ""}\n`)
let spent = 0
for (const code of codes) {
  try {
    const r = await brief(code)
    spent += r.usd
    console.log(
      `${r.code.padEnd(3)} ${r.desk.padEnd(22)} ${String(r.rounds).padStart(2)} rounds · ${String(r.calls).padStart(2)} calls · ` +
        `${String(r.sources).padStart(3)} sources · ${String(r.chars).padStart(4)} chars · $${r.usd.toFixed(3)} · ${r.seconds}s${r.filed ? " · filed" : ""}`
    )
  } catch (error) {
    console.log(`${code.padEnd(3)} ${String(error.message ?? error).slice(0, 120)}`)
  }
  await sleep(1000)
}
console.log(`\n$${spent.toFixed(2)} across ${codes.length} desk${codes.length === 1 ? "" : "s"}`)
