// Draft a FormSpec's `fields` from a PDF: every AcroForm field with its name,
// type, page, rectangle, the on-value read from its appearance dictionary, and
// the nearest printed label to its left or above from the text layer.
//
//   node scripts/forms/draft-spec.mjs public/forms/OCFS-6025.pdf > fields.json
//   node scripts/forms/draft-spec.mjs public/forms/LDSS-2921.pdf --guesses ~/Code/livingston/.research/2921-field-map.json
//
// This is GSA pdf-filler's /fields and pdffiller's generateFDFTemplate, done
// once per PDF. It prints JSON; the spec's `map`, `fixups` and `blank` are
// authored against it. With --guesses, a livingston field-map's label guesses
// (~70% right) stand in for the text-layer search, which they were made from.

import { readFileSync } from "node:fs"
import { PDFDocument, PDFName } from "pdf-lib"
import { extractText, getDocumentProxy } from "unpdf"

const args = process.argv.slice(2)
const src = args.find((a) => !a.startsWith("--"))
const guessesPath = args.includes("--guesses") ? args[args.indexOf("--guesses") + 1] : null
if (!src) {
  console.error("usage: node scripts/forms/draft-spec.mjs <pdf> [--guesses field-map.json]")
  process.exit(1)
}

const bytes = readFileSync(src)
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
const pages = doc.getPages()

const pageOf = (widget) => {
  for (let i = 0; i < pages.length; i += 1) {
    const annots = pages[i].node.Annots()
    if (!annots) continue
    for (let j = 0; j < annots.size(); j += 1) if (annots.lookup(j) === widget.dict) return i + 1
  }
  return 0
}

/** The export value of a checkbox or radio kid: the /AP /N key that is not Off. */
function onValueOf(widget) {
  const ap = widget.dict.lookup(PDFName.of("AP"))
  const n = ap?.lookup(PDFName.of("N"))
  if (!n?.keys) return undefined
  const keys = n.keys().map((k) => k.decodeText?.() ?? String(k).replace(/^\//, ""))
  return keys.find((k) => k !== "Off")
}

// Positioned text per page, for the label search. unpdf gives text items with
// their transform; x,y are PDF points, origin bottom-left, as the widgets are.
let items = new Map()
if (!guessesPath) {
  const proxy = await getDocumentProxy(new Uint8Array(bytes))
  for (let p = 1; p <= proxy.numPages; p += 1) {
    const page = await proxy.getPage(p)
    const content = await page.getTextContent()
    items.set(
      p,
      content.items
        .filter((it) => it.str && it.str.trim())
        .map((it) => ({ s: it.str.trim(), x: it.transform[4], y: it.transform[5], w: it.width, h: it.height }))
    )
  }
  await extractText(new Uint8Array(bytes)).catch(() => null)
}

const guesses = guessesPath ? JSON.parse(readFileSync(guessesPath, "utf8")) : null
const guessByName = new Map()
if (guesses) for (const f of [...guesses.text, ...guesses.checkbox]) guessByName.set(f.name, f.guess ?? f.label ?? "")

/** The printed string just left of the box on the same line, else just above it. */
function nearestLabel(page, r) {
  const list = items.get(page) ?? []
  const sameLine = list
    .filter((it) => Math.abs(it.y - r.y) <= Math.max(4, r.height * 0.8) && it.x + it.w <= r.x + 2 && r.x - (it.x + it.w) < 160)
    .sort((a, b) => b.x - a.x)
  if (sameLine.length) return { label: sameLine[0].s, from: "left" }
  const above = list
    .filter((it) => it.y > r.y + r.height - 2 && it.y - (r.y + r.height) < 14 && it.x < r.x + r.width && it.x + it.w > r.x - 2)
    .sort((a, b) => a.y - b.y)
  if (above.length) return { label: above[0].s, from: "above" }
  const inside = list.filter((it) => it.x >= r.x - 1 && it.x <= r.x + r.width && it.y >= r.y - 1 && it.y <= r.y + r.height)
  if (inside.length) return { label: inside.map((i) => i.s).join(" "), from: "inside" }
  return { label: "", from: "" }
}

const fields = []
for (const field of doc.getForm().getFields()) {
  const cls = field.constructor.name
  const type = cls === "PDFTextField" ? "text" : cls === "PDFCheckBox" ? "check" : cls === "PDFRadioGroup" ? "radio" : cls === "PDFDropdown" || cls === "PDFOptionList" ? "choice" : "text"
  for (const widget of field.acroField.getWidgets()) {
    const r = widget.getRectangle()
    const page = pageOf(widget)
    const rect = [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10)
    const entry = { name: field.getName(), type, page, rect }
    if (type === "check" || type === "radio") entry.onValue = onValueOf(widget) ?? "Yes"
    const label = guesses ? guessByName.get(field.getName()) : nearestLabel(page, r).label
    if (label) entry.label = label
    fields.push(entry)
  }
}

fields.sort((a, b) => a.page - b.page || b.rect[1] - a.rect[1] || a.rect[0] - b.rect[0])
process.stdout.write("[\n" + fields.map((f) => JSON.stringify(f)).join(",\n") + "\n]\n")
console.error(`${fields.length} fields on ${pages.length} pages`)
