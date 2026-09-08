import { PDFBool, PDFDocument, PDFName, PDFString, StandardFonts, type PDFCheckBox, type PDFDict, type PDFForm, type PDFRadioGroup, type PDFTextField } from "pdf-lib"

import { keyDef, optionLabel, splitMulti } from "@/lib/forms/keys"
import { formById } from "@/lib/forms/programs"
import { asList, type Binding, type Computed, type FormSpec, type RepeatBinding } from "@/lib/forms/spec"
import type { Values } from "@/lib/forms/profile"

// One fill for every form.
//
// Load the base, mint the fields it lacks, apply the fixups, walk the map.
// Text goes in through setText with the binding's format; a checkbox is
// checked when a binding matches and left unchecked otherwise, with the
// on-value read from the field itself; a radio group selects by export value.
// Then Helvetica is embedded, every text field's default appearance is set to
// size 0 so the viewer fits the value to its box, appearances are regenerated
// and NeedAppearances is set so every viewer regenerates them again, and the
// document is saved without flattening so the file stays editable.
//
// Runs in the browser: pdf-lib is 350 KB and is loaded when someone asks for
// the file, and the applicant's values never leave this machine to be filled.

export type Filled = {
  blob: Blob
  bytes: Uint8Array
  filename: string
  pages: number
  /** Fields that received a value or a mark. */
  filled: number
  /** Keys with a value the form has no binding for. */
  unmapped: string[]
  /** Bindings whose field the PDF does not carry — a spec error, named. */
  missing: string[]
}

const BLANK = new Set(["", "skip", "unknown"])
const has = (v: string | undefined): v is string => v !== undefined && !BLANK.has(v.trim())

/* ------------------------------------------------------------- formats */

function digits(v: string) {
  return v.replace(/\D/g, "")
}

function isoParts(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim())
  return m ? { y: m[1], mo: m[2], d: m[3] } : null
}

export function formatValue(key: string, value: string, format?: Binding["format"]): string {
  const v = value.trim()
  switch (format) {
    case "ssn": {
      const d = digits(v)
      return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : v
    }
    case "ssn-digits":
      return digits(v)
    case "date": {
      const p = isoParts(v)
      return p ? `${p.mo}/${p.d}/${p.y}` : v
    }
    case "date-mmddyy": {
      const p = isoParts(v)
      return p ? `${p.mo}-${p.d}-${p.y.slice(2)}` : v
    }
    case "date-mm":
      return isoParts(v)?.mo ?? ""
    case "date-dd":
      return isoParts(v)?.d ?? ""
    case "date-yyyy":
      return isoParts(v)?.y ?? ""
    case "money": {
      const n = Number(v.replace(/[^\d.]/g, ""))
      return Number.isFinite(n) && v.replace(/[^\d.]/g, "") ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v
    }
    case "phone": {
      const d = digits(v).replace(/^1(?=\d{10}$)/, "")
      return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : v
    }
    case "phone-area": {
      const d = digits(v).replace(/^1(?=\d{10}$)/, "")
      return d.length === 10 ? d.slice(0, 3) : ""
    }
    case "phone-prefix": {
      const d = digits(v).replace(/^1(?=\d{10}$)/, "")
      return d.length === 10 ? d.slice(3, 6) : ""
    }
    case "phone-line": {
      const d = digits(v).replace(/^1(?=\d{10}$)/, "")
      return d.length === 10 ? d.slice(6) : ""
    }
    case "phone-rest": {
      const d = digits(v).replace(/^1(?=\d{10}$)/, "")
      return d.length === 10 ? `${d.slice(3, 6)}-${d.slice(6)}` : v
    }
    case "upper":
      return v.toUpperCase()
    case "label": {
      const def = keyDef(key)
      if (!def?.options) return v
      return def.multi ? splitMulti(v).map((p) => optionLabel(key, p) ?? p).join(", ") : (optionLabel(key, v) ?? v)
    }
    case "yn":
      return /^(y|yes|true)$/i.test(v) ? "Y" : /^(n|no|false)$/i.test(v) ? "N" : v
    case "yesno":
      return /^(y|yes|true)$/i.test(v) ? "Yes" : /^(n|no|false)$/i.test(v) ? "No" : v
    case "initial":
      return v.slice(0, 1).toUpperCase()
    default:
      return v
  }
}

/* ------------------------------------------------------------ computed */

const NO_WORDS = /^\s*(no|none|n\/a|nobody|no one)\s*$/i

function age(iso: string): number | null {
  const p = isoParts(iso)
  if (!p) return null
  const now = new Date()
  let a = now.getFullYear() - Number(p.y)
  const m = now.getMonth() + 1 - Number(p.mo)
  if (m < 0 || (m === 0 && now.getDate() < Number(p.d))) a -= 1
  return a
}

function compute(c: Computed, values: Values, at: (k: string) => string): string {
  const from = (c.from ?? []).map(at)
  switch (c.fn) {
    case "join":
      return from.filter(has).join(c.sep ?? " ")
    case "age": {
      const a = from[0] ? age(from[0]) : null
      return a === null ? "" : String(a)
    }
    case "under21": {
      const a = from[0] ? age(from[0]) : null
      return a === null ? "" : a < 21 ? "yes" : "no"
    }
    case "nonzero": {
      const v = from[0] ?? ""
      if (!has(v)) return ""
      if (NO_WORDS.test(v)) return "no"
      const n = Number(v.replace(/[^\d.]/g, ""))
      return Number.isFinite(n) && v.replace(/[^\d.]/g, "") ? (n > 0 ? "yes" : "no") : "yes"
    }
    case "nonempty":
      return has(from[0]) ? (NO_WORDS.test(from[0]) ? "no" : "yes") : ""
    case "whoYN": {
      const v = from[0] ?? ""
      return !has(v) ? "" : NO_WORDS.test(v) ? "no" : "yes"
    }
    case "notices": {
      const v = (from[0] ?? "").toLowerCase()
      return v === "english" ? "english" : v === "spanish" ? "both" : ""
    }
    case "shelterCost": {
      const v = from[0] ?? ""
      return ["rent", "mortgage", "roomAndBoard", "trailerLot"].includes(v) ? "yes" : v === "none" || v === "shelter" ? "no" : ""
    }
    case "isShelter": {
      const v = from[0] ?? ""
      return v === "shelter" ? "yes" : has(v) ? "no" : ""
    }
    case "heatSeparate": {
      const v = from[0] ?? ""
      return v === "yes" ? "no" : v === "no" ? "yes" : ""
    }
    case "jobPeriod": {
      for (let n = 1; n <= 12; n += 1) {
        const source = values[`income[${n}].source`]
        if (source === "job" || source === "selfEmployment") return values[`income[${n}].period`] ?? ""
      }
      return ""
    }
    case "hasSource": {
      const wanted = new Set((c.arg ?? "").split("|"))
      for (let n = 1; n <= 12; n += 1) if (wanted.has(values[`income[${n}].source`] ?? "")) return "yes"
      return values["income.hasAny"] === "no" ? "no" : ""
    }
    case "amountPeriod": {
      // "1,234.00 / Monthly" for a cell headed AMOUNT/VALUE & FREQUENCY.
      const [amount, period, detail] = from
      const money = has(amount) ? formatValue("income[n].amount", amount, "money") : ""
      const how = has(period) ? (period === "other" && has(detail) ? detail : (optionLabel("income[n].period", period) ?? period)) : ""
      return [money, how].filter(Boolean).join(" / ")
    }
  }
}

/* -------------------------------------------------------------- matching */

function matches(binding: Binding, key: string, value: string | undefined, values: Values, at: (k: string) => string): boolean {
  if (binding.if) {
    const other = at(binding.if.key)
    const ok = binding.if.is.split("|").some((alt) => (keyDef(binding.if!.key)?.multi ? splitMulti(other).includes(alt) : other === alt))
    if (!ok) return false
  }
  if (binding.when === undefined && binding.match === undefined) return has(value)
  if (!has(value)) return false
  if (binding.match !== undefined) return new RegExp(binding.match, "i").test(value)
  if (binding.when === "*") return true
  const alts = (binding.when ?? "").split("|")
  const def = keyDef(key)
  const parts = def?.multi ? splitMulti(value) : [value.trim()]
  return parts.some((p) => alts.includes(p))
}

const isMark = (b: Binding) => b.when !== undefined || b.match !== undefined

/* ------------------------------------------------------------------ fill */

type Plan = {
  texts: Map<string, string>
  checks: Map<string, boolean>
  radios: Map<string, string>
}

function plan(spec: FormSpec, values: Values): { plan: Plan; unmapped: string[] } {
  const p: Plan = { texts: new Map(), checks: new Map(), radios: new Map() }
  const types = new Map<string, "text" | "check" | "radio" | "choice">()
  for (const f of spec.fields) types.set(f.name, f.type)
  for (const f of spec.added ?? []) types.set(f.name, f.type)
  const bound = new Set<string>()

  // A key's value, a computed one resolved (and computed from computed).
  const at = (k: string): string => (spec.computed?.[k] ? compute(spec.computed[k], values, at) : (values[k] ?? ""))

  const apply = (key: string, value: string | undefined, bindings: Binding[]) => {
    for (const b of bindings) {
      const type = types.get(b.field)
      const hit = matches(b, key, value, values, at)
      if (type === "check") {
        // OR across bindings: one match checks the box, and nothing unchecks it.
        if (hit) p.checks.set(b.field, true)
        else if (!p.checks.has(b.field)) p.checks.set(b.field, false)
      } else if (type === "radio") {
        if (hit) p.radios.set(b.field, b.when ?? value ?? "")
      } else {
        if (!hit || !b.field) continue
        const text = isMark(b) && b.mark !== "=" ? (b.mark ?? "X") : formatValue(key, value ?? "", b.format)
        if (text) p.texts.set(b.field, text)
      }
    }
  }

  const computedValue = (name: string) => (spec.computed?.[name] ? at(name) : undefined)

  // A key is bound when a binding reads it: directly, through a computed
  // value, as the condition on another binding, or as a repeat's class.
  for (const c of Object.values(spec.computed ?? {})) for (const k of c.from ?? []) bound.add(k)
  for (const bindings of Object.values(spec.map)) for (const b of asList(bindings)) if (b.if) bound.add(b.if.key)

  for (const [key, bindings] of Object.entries(spec.map)) {
    const value = spec.computed?.[key] ? computedValue(key) : values[key]
    if (!spec.computed?.[key]) bound.add(key)
    apply(key, value, asList(bindings))
  }

  for (const r of spec.repeats ?? []) {
    const slotsUsed = new Map<string, number>()
    for (let n = 1; n <= 40; n += 1) {
      const prefix = `${r.repeat}[${n}].`
      const own = Object.keys(values).filter((k) => k.startsWith(prefix) && has(values[k]))
      if (!own.length) continue
      const sub = (name: string) => values[`${prefix}${name}`]
      const rowAt = (name: string) => (r.computed?.[name] ? compute(r.computed[name], values, (k) => values[`${prefix}${k}`] ?? "") : (sub(name) ?? ""))
      let cls = ""
      let slot = 1
      if (r.classify) {
        const raw = sub(r.classify.key) ?? ""
        cls = r.classify.classes[raw] ?? ""
        if (!cls) {
          own.forEach((k) => bound.add(k))
          continue
        }
        slot = (slotsUsed.get(cls) ?? 0) + 1
        slotsUsed.set(cls, slot)
        if (slot > r.classify.slots) continue
      } else if (n > r.rows) continue
      const rowNumber = n + (r.offset ?? 0)
      const fill = (t: string) =>
        t
          .replace(/\{slot:([^}]*)\}/g, (_, alts: string) => alts.split("|")[slot - 1] ?? "")
          .replace(/\{n\}/g, String(rowNumber))
          .replace(/\{class\}/g, cls)
          .replace(/\{slot\}/g, String(slot))
      const instantiate = (b: Binding): Binding => ({ ...b, field: fill(b.field), if: b.if ? { key: b.if.key.replace(/\[n\]/g, `[${n}]`), is: b.if.is } : undefined })
      const templates = { ...r.fields, ...(r.rowFields?.[n - 1] ?? {}), ...(cls && r.classFields?.[cls] ? r.classFields[cls] : {}) }
      if (r.classify) bound.add(`${prefix}${r.classify.key}`)
      for (const c of Object.values(r.computed ?? {})) for (const k of c.from ?? []) bound.add(`${prefix}${k}`)
      for (const bindings of Object.values(templates)) for (const b of asList(bindings)) if (b.if) bound.add(b.if.key.replace(/\[n\]/g, `[${n}]`))
      // A class may name its own "row exists" cell under `$present`, or none.
      const present = "$present" in templates ? templates.$present : r.present
      for (const [name, bindings] of Object.entries(templates)) {
        if (name === "$present") continue
        const key = `${prefix}${name}`
        if (!r.computed?.[name]) bound.add(key)
        apply(key, rowAt(name), asList(bindings).map(instantiate))
      }
      for (const b of asList(present)) apply(`${prefix}${r.classify?.key ?? "present"}`, "yes", [instantiate({ ...b, when: b.when ?? "*" })])
    }
  }

  // A key with a value that this form asks and nothing here binds — a row
  // past the form's rows included, since its keys were never placed.
  const form = formById(spec.id)
  const asked = new Set(form?.sections.flatMap((s) => s.keys) ?? [])
  const unmapped = Object.keys(values)
    .filter((k) => has(values[k]))
    .filter((k) => asked.has(k.replace(/\[\d+\]/g, "[n]")))
    .filter((k) => !bound.has(k))
  return { plan: p, unmapped }
}

/* ---------------------------------------------------------------- pdf */

async function loadBase(spec: FormSpec, base?: ArrayBuffer | Uint8Array) {
  if (base) return PDFDocument.load(base, { ignoreEncryption: true })
  const response = await fetch(spec.base)
  if (!response.ok) throw new Error(`Could not load ${spec.code} (${response.status})`)
  return PDFDocument.load(await response.arrayBuffer(), { ignoreEncryption: true })
}

function mint(form: PDFForm, doc: PDFDocument, spec: FormSpec) {
  const names = new Set(form.getFields().map((f) => f.getName()))
  for (const f of spec.added ?? []) {
    if (names.has(f.name)) continue
    const page = doc.getPages()[f.page - 1]
    if (!page) continue
    const field = form.createTextField(f.name)
    field.addToPage(page, { x: f.rect[0], y: f.rect[1], width: f.rect[2], height: f.rect[3], borderWidth: 0 })
    names.add(f.name)
  }
}

export function filenameFor(spec: FormSpec, values: Values, at = new Date()) {
  const last = (values["applicant.lastName"] ?? "Applicant").replace(/[^A-Za-z0-9]+/g, "")
  return `${spec.code}-${last || "Applicant"}-${at.toISOString().slice(0, 10)}.pdf`
}

/**
 * Fill a form from the applicant's values. `base` lets a script pass the
 * PDF's bytes; in the browser the base is fetched from the spec's path.
 */
export async function fillForm(spec: FormSpec, values: Values, base?: ArrayBuffer | Uint8Array): Promise<Filled> {
  const doc = await loadBase(spec, base)
  const form = doc.getForm()
  mint(form, doc, spec)

  for (const fix of spec.fixups ?? []) {
    let field
    try {
      field = form.getField(fix.field)
    } catch {
      continue
    }
    const widget = field.acroField.getWidgets()[0]
    if (fix.rect && widget) widget.setRectangle({ x: fix.rect[0], y: fix.rect[1], width: fix.rect[2], height: fix.rect[3] })
    if ("setFontSize" in field && fix.fontSize !== undefined) (field as PDFTextField).setFontSize(fix.fontSize)
    if ("enableMultiline" in field && fix.multiline) (field as PDFTextField).enableMultiline()
  }

  const { plan: p, unmapped } = plan(spec, values)
  const missing: string[] = []
  let filled = 0

  for (const [name, text] of p.texts) {
    try {
      const field = form.getTextField(name)
      field.setText(text)
      filled += 1
    } catch {
      missing.push(name)
    }
  }
  for (const [name, on] of p.checks) {
    let box: PDFCheckBox
    try {
      box = form.getCheckBox(name)
    } catch {
      if (on) missing.push(name)
      continue
    }
    if (on) {
      box.check()
      filled += 1
    } else box.uncheck()
  }
  for (const [name, value] of p.radios) {
    let group: PDFRadioGroup
    try {
      group = form.getRadioGroup(name)
    } catch {
      missing.push(name)
      continue
    }
    const options = group.getOptions()
    const pick = options.find((o) => o === value) ?? options.find((o) => o.toLowerCase() === value.toLowerCase())
    if (pick) {
      group.select(pick)
      filled += 1
    }
  }

  // One font for every value, registered in the form's default resources
  // under the name the default appearance uses, so a viewer that regenerates
  // appearances (NeedAppearances) finds it; size 0 is "fit the box".
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const acro = form.acroForm.dict
  const dr = (acro.lookup(PDFName.of("DR")) as PDFDict | undefined) ?? doc.context.obj({})
  const fonts = (dr.lookup(PDFName.of("Font")) as PDFDict | undefined) ?? doc.context.obj({})
  fonts.set(PDFName.of("Helv"), font.ref)
  // livingston's base named its font Helvetica in every cell's appearance
  // string; the name is honoured too, so nothing points at a font that is
  // not there.
  fonts.set(PDFName.of("Helvetica"), font.ref)
  dr.set(PDFName.of("Font"), fonts)
  acro.set(PDFName.of("DR"), dr)
  for (const field of form.getFields()) {
    if (field.constructor.name !== "PDFTextField") continue
    const text = field as PDFTextField
    text.acroField.setDefaultAppearance("/Helv 0 Tf 0 g")
    // The widget can carry its own /DA, and a viewer reads that one.
    for (const widget of text.acroField.getWidgets()) widget.dict.set(PDFName.of("DA"), PDFString.of("/Helv 0 Tf 0 g"))
  }
  form.updateFieldAppearances(font)
  // The state's OCFS-6025 ships every checkbox with an /On and an /Off
  // appearance that are both empty streams. pdf-lib sees the keys, decides the
  // box needs no update, and leaves the empty stream in place — so the value
  // is set and no viewer draws a mark. Regenerate every box and radio
  // outright, and give each widget the check character (/MK /CA "4",
  // ZapfDingbats) a viewer that redraws for itself would use.
  for (const field of form.getFields()) {
    const kind = field.constructor.name
    if (kind !== "PDFCheckBox" && kind !== "PDFRadioGroup") continue
    for (const widget of field.acroField.getWidgets()) {
      const mk = (widget.dict.lookup(PDFName.of("MK")) as PDFDict | undefined) ?? doc.context.obj({})
      mk.set(PDFName.of("CA"), PDFString.of("4"))
      widget.dict.set(PDFName.of("MK"), mk)
    }
    ;(field as PDFCheckBox | PDFRadioGroup).updateAppearances()
  }
  // Every field now carries a correct appearance stream, so viewers must use
  // them. With NeedAppearances on, iOS and Google's viewer redraw text with
  // their own sizing and clip a three-digit area code to two, and draw
  // nothing for a box whose base appearance was empty.
  acro.set(PDFName.of("NeedAppearances"), PDFBool.False)

  const bytes = await doc.save({ updateFieldAppearances: false })
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
  return { blob, bytes, filename: filenameFor(spec, values), pages: doc.getPageCount(), filled, unmapped, missing }
}
