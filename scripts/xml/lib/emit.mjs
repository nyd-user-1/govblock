// A front end's IR, written out as one stored USLM document: the root carries
// the Work in `identifier` and USLM's namespace, and <meta> carries the
// expression (`docStage`, `processedDate`) and how the document was made, so
// an object read out of S3 names itself without the index (schema.md, "Where
// it is stored").

export const USLM_NS = "http://schemas.gpo.gov/xml/uslm"
export const DC_NS = "http://purl.org/dc/elements/1.1/"
export const DCTERMS_NS = "http://purl.org/dc/terms/"

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const attr = (s) => esc(String(s)).replace(/"/g, "&quot;")

/** IrNode → XML. The IR decodes entities at parse time, so text is escaped once here. */
export function toXml(n) {
  if (typeof n === "string") return esc(n)
  if (n.tag === "#root") return n.children.map(toXml).join("")
  const attrs = Object.entries(n.attrs).map(([k, v]) => ` ${k}="${attr(v)}"`).join("")
  return n.children.length ? `<${n.tag}${attrs}>${n.children.map(toXml).join("")}</${n.tag}>` : `<${n.tag}${attrs}/>`
}

const el = (tag, attrs = {}, children = []) => ({ tag, attrs, children })
const kids = (n) => n.children.filter((c) => typeof c !== "string")
const ROOTS = new Set(["bill", "resolution", "amendment", "lawDoc", "uscDoc", "pLaw", "statutesAtLarge"])

/** The first element named `tag` anywhere under `n`. */
export function first(n, tag) {
  if (typeof n === "string") return null
  if (n.tag === tag) return n
  for (const c of n.children) {
    const hit = typeof c === "string" ? null : first(c, tag)
    if (hit) return hit
  }
  return null
}

export const textOf = (n) => (typeof n === "string" ? n : n.children.map(textOf).join(""))

/**
 * The stored document. `doc` is what the front end returned: a whole USLM or
 * Bill DTD document (its root is kept), or a body (`main`, a section) that
 * is set inside `root`.
 *
 * info: { root, work, stage, date, title, number, publisher, source, fidelity,
 *         coverage, dialect, frontEnd, builder, dateBasis, path, section }
 */
export function wrap(doc, info) {
  let top = doc.tag === "#root" ? kids(doc)[0] ?? el("main") : doc
  if (!ROOTS.has(top.tag)) {
    const body = top.tag === "main" ? top : el("main", {}, [top])
    // A statute section read as text carries its number and heading from the
    // loader's own columns, so the section element is the Work itself.
    if (info.section) {
      const section = el("section", { identifier: info.work }, [
        ...(info.section.num ? [el("num", {}, [info.section.num])] : []),
        ...(info.section.heading ? [el("heading", {}, [info.section.heading])] : []),
        ...body.children,
      ])
      body.children = [section]
    }
    top = el(info.root ?? "lawDoc", {}, [body])
  }

  top.attrs = {
    xmlns: USLM_NS,
    "xmlns:dc": DC_NS,
    "xmlns:dcterms": DCTERMS_NS,
    "xml:lang": "en",
    ...Object.fromEntries(Object.entries(top.attrs).filter(([k]) => !k.startsWith("xmlns") && k !== "identifier")),
    identifier: info.work,
  }

  let meta = kids(top).find((c) => c.tag === "meta")
  if (!meta) {
    meta = el("meta")
    top.children.unshift(meta)
  }
  const add = (tag, value, attrs = {}) => {
    if (value === null || value === undefined || value === "") return
    meta.children.push(el(tag, attrs, [String(value)]))
  }
  if (!first(meta, "dc:title")) add("dc:title", info.title)
  if (!first(meta, "dc:type")) add("dc:type", info.kind)
  if (!first(meta, "docNumber")) add("docNumber", info.number)
  if (!first(meta, "dc:publisher")) add("dc:publisher", info.publisher)
  add("docStage", info.stage)
  add("processedDate", info.date)
  add("dc:source", info.source)
  add("property", info.fidelity, { name: "govblock:fidelity" })
  add("property", info.coverage === undefined ? null : Number(info.coverage).toFixed(4), { name: "govblock:coverage" })
  add("property", info.dialect, { name: "govblock:dialect" })
  add("property", info.frontEnd, { name: "govblock:frontEnd" })
  add("property", info.builder, { name: "govblock:builder" })
  add("property", info.dateBasis, { name: "govblock:dateBasis" })
  add("property", info.path, { name: "govblock:path" })

  return `<?xml version="1.0" encoding="UTF-8"?>\n${toXml(top)}\n`
}
