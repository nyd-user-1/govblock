// Render every page of a fillable PDF with each field outlined and numbered,
// so a map can be built by sight: find the box beside the printed label, read
// its number, look the name up in the legend.
//
//   node scripts/forms/annotate.mjs public/forms/LDSS-2921.pdf <outdir> [dpi]
//
// Writes <outdir>/annotated.pdf, <outdir>/page-N.png (via pdftoppm) and
// <outdir>/legend.txt: one line per field — page, number, name, type, rect.
// Ported from livingston's .research/annotate.mjs (which stamped detected
// checkbox glyphs) to draw the AcroForm the PDF actually carries.

import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { PDFDocument, PDFName, rgb, StandardFonts } from "pdf-lib"

const [, , src, out = "annotated", dpiArg = "110"] = process.argv
if (!src) {
  console.error("usage: node scripts/forms/annotate.mjs <pdf> <outdir> [dpi]")
  process.exit(1)
}
mkdirSync(out, { recursive: true })

const doc = await PDFDocument.load(readFileSync(src), { ignoreEncryption: true })
const font = await doc.embedFont(StandardFonts.HelveticaBold)
const pages = doc.getPages()
const form = doc.getForm()

// Which page a widget is on: the page whose /Annots holds it.
const pageOf = (widget) => {
  const ref = widget.dict
  for (let i = 0; i < pages.length; i += 1) {
    const annots = pages[i].node.Annots()
    if (!annots) continue
    for (let j = 0; j < annots.size(); j += 1) if (annots.lookup(j) === ref) return i + 1
  }
  return 0
}

const legend = []
const perPage = new Map()
for (const field of form.getFields()) {
  const type = field.constructor.name.replace("PDF", "").replace("Field", "").toLowerCase()
  for (const widget of field.acroField.getWidgets()) {
    const page = pageOf(widget)
    const r = widget.getRectangle()
    const n = (perPage.get(page) ?? 0) + 1
    perPage.set(page, n)
    legend.push({ page, n, name: field.getName(), type, x: r.x, y: r.y, w: r.width, h: r.height })
    const p = pages[page - 1]
    if (!p) continue
    const check = type.startsWith("check") || type.startsWith("radio")
    p.drawRectangle({ x: r.x, y: r.y, width: r.width, height: r.height, borderColor: check ? rgb(0.85, 0.1, 0.1) : rgb(0.1, 0.4, 0.9), borderWidth: 0.6, opacity: 0.9 })
    const label = String(n)
    const size = check ? 4.5 : 5
    p.drawText(label, { x: r.x + 1, y: r.y + Math.max(1, r.height - size - 1), size, font, color: check ? rgb(0.85, 0.1, 0.1) : rgb(0.1, 0.4, 0.9) })
  }
}

// Widgets carry no /F flag change here; the outline is on the page itself so
// a rasteriser without form rendering still shows it.
doc.catalog.getOrCreateAcroForm?.()
const acro = doc.catalog.lookup(PDFName.of("AcroForm"))
if (acro) acro.set(PDFName.of("NeedAppearances"), doc.context.obj(false))

const pdfOut = join(out, "annotated.pdf")
writeFileSync(pdfOut, await doc.save())
writeFileSync(
  join(out, "legend.txt"),
  legend
    .sort((a, b) => a.page - b.page || a.n - b.n)
    .map((f) => `p${f.page} #${f.n} ${f.name} ${f.type} [${[f.x, f.y, f.w, f.h].map((v) => Math.round(v)).join(",")}]`)
    .join("\n")
)
execFileSync("/opt/homebrew/bin/pdftoppm", ["-r", dpiArg, "-png", pdfOut, join(out, "page")])
console.log(`${legend.length} widgets on ${pages.length} pages → ${out}/page-N.png, legend.txt`)
