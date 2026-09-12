import { atRow, isKnownKey, keyDef, normaliseKey, optionsFor, type CanonicalKey, type FieldKind } from "@/lib/forms/keys"
import { formById, isFormId, sectionOf, type FormId, type ProgramForm } from "@/lib/forms/programs"
// The shape of a run step this file reads — the kind and the tool's input.
// The agent runner's own Step is wider; this is what travels with the widgets.
type Step = { kind: string; input?: unknown }

// The contract between the Filer's client-side tools and the widgets that
// answer them. The model's `ask` input arrives here and is settled against
// the vocabulary — kinds, options and tones are the form's, whatever the
// model wrote — the way livingston's parseFieldBlock settled its prose block.

export type FieldTone = "caution" | "info"

export type ChatField = {
  key: CanonicalKey
  label: string
  kind: FieldKind
  hint?: string
  placeholder?: string
  /** `value|Label`. */
  options?: string[]
  multi?: boolean
  required?: boolean
  tone?: FieldTone
  href?: string
}

export type AskInput = {
  section: string
  title: string
  intro?: string
  fields: ChatField[]
  repeat?: { key: string; label: string; min: number; max: number }
}

export type AskResult =
  | { section: string; answered: CanonicalKey[]; skipped: CanonicalKey[]; next: { section: string; title: string; open: CanonicalKey[] } | null }
  | { error: string }
export type ReviewResult = { confirmed: boolean; sections: number; answered: number }
export type FillResult = { ok: boolean; filename?: string; pages?: number; bytes?: number; filled?: number; unmapped?: CanonicalKey[]; error?: string }
export type RememberResult = { kept: CanonicalKey[]; rejected: CanonicalKey[] }

const KINDS: FieldKind[] = ["text", "textarea", "number", "money", "date", "tel", "email", "ssn", "select", "radio", "checkbox", "yesno", "attest"]

/**
 * The model's fields, settled. A key the form does not ask is an error, not
 * a widget; a key with fixed values is asked with them whatever the model
 * wrote; an attestation is boxed and linked to its page.
 */
export function settleAsk(raw: unknown, form: ProgramForm | undefined): { input: AskInput } | { error: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  const section = String(r.section ?? "").trim()
  const title = String(r.title ?? "").trim() || section
  const list = Array.isArray(r.fields) ? r.fields : []
  if (!list.length) return { error: "ask needs at least one field" }
  const unknown: string[] = []
  const fields: ChatField[] = []
  for (const item of list) {
    const f = (item ?? {}) as Record<string, unknown>
    const key = String(f.key ?? "").trim()
    if (!key) continue
    if (!isKnownKey(key) || (form && !sectionOf(form, key))) {
      unknown.push(key)
      continue
    }
    const def = keyDef(key)!
    let kind: FieldKind = KINDS.includes(f.kind as FieldKind) ? (f.kind as FieldKind) : def.kind
    let options = Array.isArray(f.options) ? f.options.filter((o): o is string => typeof o === "string") : undefined
    const fixed = optionsFor(key)
    if (fixed) {
      options = fixed.options
      kind = def.kind
    }
    if ((kind === "select" || kind === "radio" || kind === "checkbox") && !options?.length) kind = "text"
    fields.push({
      key,
      label: typeof f.label === "string" && f.label.trim() ? f.label.trim() : def.label,
      kind,
      options,
      multi: def.multi,
      hint: typeof f.hint === "string" ? f.hint : undefined,
      placeholder: typeof f.placeholder === "string" ? f.placeholder : undefined,
      required: f.required === true,
      tone: kind === "attest" ? "caution" : def.tone,
      href: def.href,
    })
  }
  if (unknown.length) return { error: `${form?.code ?? "The form"} does not ask ${unknown.join(", ")}. Use only keys from form_schema.` }
  if (!fields.length) return { error: "ask needs at least one field" }
  const rep = r.repeat && typeof r.repeat === "object" ? (r.repeat as Record<string, unknown>) : undefined
  const repeat =
    rep && typeof rep.key === "string"
      ? { key: rep.key, label: String(rep.label ?? "Row"), min: Math.max(1, Number(rep.min) || 1), max: Math.max(1, Number(rep.max) || 8) }
      : fields.some((f) => f.key.includes("[n]"))
        ? { key: fields.find((f) => f.key.includes("[n]"))!.key.split("[")[0], label: "Person", min: 1, max: 8 }
        : undefined
  return { input: { section, title, intro: typeof r.intro === "string" ? r.intro : undefined, fields, repeat } }
}

/** `household[n].dob` on row 3 → `household[3].dob`; other keys unchanged. */
export const keyOnRow = (key: string, n: number) => (key.includes("[n]") ? atRow(key, n) : key.replace(/\[\d+\]/, `[${n}]`))

export const rowKeys = (fields: ChatField[]) => fields.filter((f) => normaliseKey(f.key).includes("[n]"))
export const plainKeys = (fields: ChatField[]) => fields.filter((f) => !normaliseKey(f.key).includes("[n]"))

/** The form a run is about: the last form named in any tool input, else the remembered one. */
export function activeFormOf(steps: Step[], fallback: FormId | null): FormId | null {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i]
    if (step.kind !== "tool" && step.kind !== "ask") continue
    const form = (step.input as { form?: unknown } | undefined)?.form
    if (isFormId(form)) return form
  }
  return fallback
}

export const formFor = (id: FormId | null) => (id ? formById(id) : undefined)
