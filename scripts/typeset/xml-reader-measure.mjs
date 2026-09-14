// The XML reader against the Plate reader, on the same printing, on the same
// server (window 1, 2026-09-14). For each printing: the source XML's own
// element counts, what the XML reader's schema holds, and what the Plate
// reader's HTML (lib/policy/bill-uslm.ts's uslmToHtml, served by
// /api/typeset/content) holds; then the time and bytes each takes.
//
//   node scripts/typeset/xml-reader-measure.mjs [origin] bill[:document] …
//
// Runs on the box against the branch's dev server:
//   node scripts/typeset/xml-reader-measure.mjs http://127.0.0.1:3002 2058568 2013923:-201392344

const args = process.argv.slice(2)
const origin = /^https?:/.test(args[0] ?? "") ? args.shift() : "http://127.0.0.1:3002"
const targets = args.length ? args : ["2058568"]

const count = (text, re) => (text.match(re) ?? []).length
const tags = (xml, names) => Object.fromEntries(names.map((n) => [n, count(xml, new RegExp(`<${n}[\\s>/]`, "g"))]))

async function timed(url, headers = {}) {
  const t = performance.now()
  const res = await fetch(url, { headers })
  const body = await res.text()
  return { status: res.status, ms: Math.round(performance.now() - t), bytes: Buffer.byteLength(body), body }
}

const SOURCE_TAGS = ["section", "subsection", "paragraph", "subparagraph", "clause", "subclause", "item", "subitem", "title", "subtitle", "part", "division", "text", "chapeau", "content", "continuation-text", "continuation", "after-quoted-block", "quoted-block", "quotedContent", "enum", "num", "header", "heading", "toc-entry", "referenceItem"]

for (const target of targets) {
  const [bill, version] = target.split(":")
  const q = `bill=${bill}${version ? `&version=${version}` : ""}`
  const parse = await timed(`${origin}/api/typeset/uslm-parse?${q}`)
  const p = JSON.parse(parse.body)
  if (parse.status !== 200) {
    console.log(`${target}: parse ${parse.status} ${p.error ?? ""}`)
    continue
  }
  const source = p.sourceUrl ? await (await fetch(p.sourceUrl, { headers: { "user-agent": "govblock (+https://gov.nysgpt.com)" } })).text() : ""
  const plate = await timed(`${origin}/api/typeset/content?item=article&${q}`, { "accept-encoding": "identity" })
  const html = plate.status === 200 ? JSON.parse(plate.body).html : ""
  const xmlJson = await timed(`${origin}/api/typeset/xml?${q}`, { "accept-encoding": "gzip" })
  const xmlJsonAgain = await timed(`${origin}/api/typeset/xml?${q}`, { "accept-encoding": "gzip" })
  const plateAgain = await timed(`${origin}/api/typeset/content?item=article&${q}`, { "accept-encoding": "gzip" })
  const view = (slug) => `${origin}/workspace/typeset/bill/${bill}${slug}${version ? `?version=${version}` : ""}`
  const plateCold = await timed(view(""))
  const plateWarm = await timed(view(""))
  const xmlCold = await timed(view("/xml"))
  const xmlWarm = await timed(view("/xml"))

  const htmlCounts = {
    h1: count(html, /<h1[\s>]/g), h2: count(html, /<h2[\s>]/g), h3: count(html, /<h3[\s>]/g), h4: count(html, /<h4[\s>]/g), h5: count(html, /<h5[\s>]/g), h6: count(html, /<h6[\s>]/g),
    p: count(html, /<p[\s>]/g), "p led by a bold number": count(html, /<p><strong>/g), blockquote: count(html, /<blockquote[\s>]/g), a: count(html, /<a[\s>]/g),
  }
  const n = p.report.nodes
  console.log(JSON.stringify({
    target, bill: p.bill, printing: p.version, address: `${p.work}@${p.expression}`, dialect: p.dialect, fidelity: p.fidelity,
    source: tags(source, SOURCE_TAGS),
    xmlReader: { levels: Object.fromEntries(["title", "subtitle", "part", "division", "section", "subsection", "paragraph", "subparagraph", "clause", "subclause", "item", "subitem", "level"].map((k) => [k, n[k] ?? 0])), num: n.num ?? 0, heading: n.heading ?? 0, chapeau: n.chapeau ?? 0, continuation: n.continuation ?? 0, content: n.content ?? 0, p: n.p ?? 0, quotedContent: n.quotedContent ?? 0, referenceItem: n.referenceItem ?? 0, refs: p.report.marks.ref ?? 0, unknown: p.report.unknown, violations: p.report.violations },
    plateHtml: htmlCounts,
    build: p.timings,
    bytes: { source: p.bytes.source, xmlJson: p.bytes.json, xmlJsonGzip: xmlJson.bytes, xmlHtml: p.bytes.html, plateHtml: Buffer.byteLength(html), plateJsonGzip: plateAgain.bytes },
    routes: { xmlJson: `${xmlJson.ms} ms, then ${xmlJsonAgain.ms} ms`, plateContent: `${plate.ms} ms, then ${plateAgain.ms} ms` },
    pages: { typeset: `${plateCold.status} ${plateCold.ms} ms / ${plateWarm.ms} ms, ${plateWarm.bytes} B`, xml: `${xmlCold.status} ${xmlCold.ms} ms / ${xmlWarm.ms} ms, ${xmlWarm.bytes} B` },
  }, null, 1))
}
