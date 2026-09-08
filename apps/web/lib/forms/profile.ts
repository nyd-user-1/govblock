import { atRow, gateOpen, keyDef, splitMulti, type CanonicalKey } from "@/lib/forms/keys"
import { askedSections, type FormId, type FormSection, type ProgramForm } from "@/lib/forms/programs"

// The browser is the ledger, and the ledger is a profile.
//
// One applicant profile in canonical keys, in this browser's localStorage and
// nowhere else — the same place the Agentic Inbox keeps its threads, for the
// same reason: govblock has no accounts, and a profile with a Social Security
// number in it has no business on a server that cannot say whose it is. The
// model never holds a value: an `ask` widget writes here, `review` and
// `fill_form` read here, and the agent route sees receipts, not answers.
//
// Beside the profile, one small record per form — which sections are done,
// and any answer that differs on this form from the profile — ported from
// livingston's form-answers.ts so a reload resumes where it stopped.

export type Values = Record<CanonicalKey, string>

export type Profile = { values: Values; updatedAt: number }

export type FormState = {
  form: FormId
  /** Sections the widget has submitted, by `n`, in order. */
  done: string[]
  /** Answers that differ on this form from the profile's. */
  overrides: Values
  updatedAt: number
}

const PROFILE_KEY = "govblock:applicant:profile"
const FORM_KEY = (form: string) => `govblock:forms:${form}`
const ACTIVE_KEY = "govblock:forms:active"
const EVENT = "govblock:profile"

const canStore = () => typeof window !== "undefined" && "localStorage" in window

function read<T>(key: string): T | null {
  if (!canStore()) return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  if (!canStore()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }))
}

/* -------------------------------------------------------------- profile */

export function loadProfile(): Profile {
  return read<Profile>(PROFILE_KEY) ?? { values: {}, updatedAt: 0 }
}

export function saveProfile(profile: Profile) {
  write(PROFILE_KEY, profile)
}

/** Only the vocabulary's keys are kept; the rest are reported back, not stored. */
export function mergeProfile(values: Values): { kept: CanonicalKey[]; rejected: CanonicalKey[] } {
  const profile = loadProfile()
  const kept: CanonicalKey[] = []
  const rejected: CanonicalKey[] = []
  for (const [key, raw] of Object.entries(values)) {
    if (!keyDef(key)) {
      rejected.push(key)
      continue
    }
    const value = typeof raw === "string" ? raw.trim() : ""
    if (value) profile.values[key] = value
    else delete profile.values[key]
    kept.push(key)
  }
  profile.updatedAt = Date.now()
  saveProfile(profile)
  return { kept, rejected }
}

/** Subscribe to any change to the profile or a form's state, across tabs too. */
export function onProfileChange(listener: () => void) {
  if (typeof window === "undefined") return () => {}
  const local = () => listener()
  const storage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith("govblock:applicant") || event.key.startsWith("govblock:forms")) listener()
  }
  window.addEventListener(EVENT, local)
  window.addEventListener("storage", storage)
  return () => {
    window.removeEventListener(EVENT, local)
    window.removeEventListener("storage", storage)
  }
}

/* ------------------------------------------------------------ per form */

export function loadFormState(form: FormId): FormState {
  return read<FormState>(FORM_KEY(form)) ?? { form, done: [], overrides: {}, updatedAt: 0 }
}

export function saveFormState(state: FormState) {
  write(FORM_KEY(state.form), { ...state, updatedAt: Date.now() })
}

export function markDone(form: FormId, section: string) {
  const state = loadFormState(form)
  if (!state.done.includes(section)) state.done.push(section)
  saveFormState(state)
}

export function rememberActiveForm(form: FormId | null) {
  if (!canStore()) return
  try {
    if (form) window.localStorage.setItem(ACTIVE_KEY, form)
    else window.localStorage.removeItem(ACTIVE_KEY)
  } catch {}
}

export function recallActiveForm(): FormId | null {
  const raw = read<string>(ACTIVE_KEY)
  return raw === "ldss-2921" || raw === "ocfs-6025" ? raw : null
}

/* -------------------------------------------------------------- reading */

/**
 * The values a form is filled from: the profile, with this form's overrides
 * on top, and the facts one answer implies about another underneath. A
 * numbered key is looked up as written; the profile stores rows as they were
 * answered (`household[2].dob`).
 */
export function valuesFor(form: FormId): Values {
  const profile = loadProfile()
  const state = loadFormState(form)
  return { ...implied(profile.values), ...profile.values, ...state.overrides }
}

export function valueFor(form: FormId, key: CanonicalKey): string | undefined {
  const v = valuesFor(form)[key]
  return v && v !== "skip" && v !== "unknown" ? v : undefined
}

/**
 * What one answer says about another, conservatively: a fact is implied only
 * where the form's own wording makes the two the same question. Nothing here
 * infers a "no" from silence.
 */
export function implied(values: Values): Values {
  const out: Values = {}
  const urgent = splitMulti(values["urgent"])
  if (urgent.includes("homeless") || values["shelter.type"] === "shelter") out["housing.homeless"] = "yes"
  else if (["rent", "mortgage", "roomAndBoard", "trailerLot"].includes(values["shelter.type"] ?? "")) out["housing.homeless"] = "no"
  return out
}

/** How many `[n]` rows a prefix has answers for. */
export function rowCount(values: Values, prefix: string): number {
  let max = 0
  for (const key of Object.keys(values)) {
    const m = new RegExp(`^${prefix.replace(/[.[\]]/g, "\\$&")}\\[(\\d+)\\]\\.`).exec(key)
    if (m && values[key]) max = Math.max(max, Number(m[1]))
  }
  return max
}

/** The keys of a section, rows expanded to the rows the profile has (at least one). */
export function sectionKeys(section: FormSection, values: Values): CanonicalKey[] {
  if (!section.repeat) return section.keys
  const rows = Math.max(1, Math.min(section.repeat.max, rowCount(values, section.repeat.key)))
  const out: CanonicalKey[] = []
  for (const key of section.keys) {
    if (!key.includes("[n]")) out.push(key)
    else for (let n = 1; n <= rows; n += 1) out.push(atRow(key, n))
  }
  return out
}

/** Is every key a section asks already answered — so the Filer can skip it? */
export function sectionKnown(section: FormSection, values: Values): { known: CanonicalKey[]; open: CanonicalKey[] } {
  const known: CanonicalKey[] = []
  const open: CanonicalKey[] = []
  for (const key of sectionKeys(section, values)) {
    const def = keyDef(key)
    const value = values[key]
    if (!def?.always && value && value !== "skip" && value !== "unknown") known.push(key)
    else if (gateOpen(key, values)) open.push(key)
  }
  return { known, open }
}

/** Sections done / total for the progress line, never lagging the record. */
export function progress(form: ProgramForm, state: FormState, values: Values) {
  const sections = askedSections(form)
  const done = sections.filter((s) => state.done.includes(s.n) || (s.keys.length > 0 && sectionKnown(s, values).open.length === 0)).length
  return { done, total: sections.length }
}

/* ---------------------------------------------------------------- forget */

/**
 * "Forget everything": the profile, every form's state, and the Filer's
 * threads in the inbox — those carry the values a file was built from, which
 * is the point of them and the reason they cannot stay once someone asks.
 */
export function forgetEverything() {
  if (!canStore()) return
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && (key.startsWith("govblock:applicant") || key.startsWith("govblock:forms"))) keys.push(key)
    }
    keys.forEach((key) => window.localStorage.removeItem(key))
    const raw = window.localStorage.getItem("govblock:inbox:threads")
    if (raw) {
      const threads = JSON.parse(raw) as { agent?: string; messages?: { form?: unknown }[] }[]
      const kept = threads.filter((t) => t.agent !== "form-filler" && !t.messages?.some((m) => m.form))
      window.localStorage.setItem("govblock:inbox:threads", JSON.stringify(kept))
    }
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: PROFILE_KEY }))
}
