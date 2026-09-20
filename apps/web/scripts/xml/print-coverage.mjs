// How much of each jurisdiction's newest bills the XML pipeline prints (Brendan,
// 2026-09-20): for each state's N most recently acted-on bills, whether the code
// block came from the stored XML, fell back to the state's stored text, or had
// nothing to print. The list of states to rebuild is the ones with no "xml".
// Needs the dev server. Run from apps/web:  node apps/web/scripts/xml/print-coverage.mjs [per-state]
const PER = Number(process.argv[2] ?? 6)
const base = process.env.COVERAGE_ORIGIN ?? "http://localhost:3000"
const STATES = "US AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ")
const tally = new Map(STATES.map((s) => [s, { xml: 0, text: 0, none: 0 }]))
for (let i = 0; i < STATES.length; i += 6) {
  const groups = await (await fetch(`${base}/api/policy/stream?states=${STATES.slice(i, i + 6).join(",")}&limit=${PER}`)).json()
  for (const g of Array.isArray(groups) ? groups : []) {
    const ids = g.bills.map((b) => b.bill_id)
    if (!ids.length) continue
    const sources = await (await fetch(`${base}/api/policy/bill-texts?sources=1&ids=${ids.join(",")}`)).json()
    for (const id of ids) tally.get(g.state)[sources[String(id)] ?? "none"]++
  }
}
const rows = [...tally].map(([state, t]) => ({ state, ...t }))
const line = (r) => `${r.state.padEnd(3)} xml ${String(r.xml).padStart(2)}  text ${String(r.text).padStart(2)}  none ${String(r.none).padStart(2)}`
console.log(`newest ${PER} bills per jurisdiction\n`)
console.log("ALL XML:      " + rows.filter((r) => r.xml && !r.text).map((r) => r.state).join(" "))
console.log("MIXED:        " + rows.filter((r) => r.xml && r.text).map((r) => r.state).join(" "))
console.log("NO XML:       " + rows.filter((r) => !r.xml && r.text).map((r) => r.state).join(" "))
console.log("NOTHING:      " + rows.filter((r) => !r.xml && !r.text).map((r) => r.state).join(" ") + "\n")
for (const r of rows) console.log(line(r))
const sum = rows.reduce((a, r) => ({ xml: a.xml + r.xml, text: a.text + r.text, none: a.none + r.none }), { xml: 0, text: 0, none: 0 })
console.log(`\ntotal  xml ${sum.xml}  text ${sum.text}  none ${sum.none}`)
