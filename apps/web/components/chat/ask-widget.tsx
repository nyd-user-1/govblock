"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLinkIcon, PlusIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { displayValue, keyDef, normaliseKey, optionParts, splitMulti, type CanonicalKey } from "@/lib/forms/keys"
import { askedSections, formById, type FormId } from "@/lib/forms/programs"
import { markDone, mergeProfile, rowCount, sectionKnown, valueFor, valuesFor, type Values } from "@/lib/forms/profile"
import { keyOnRow, plainKeys, rowKeys, type AskInput, type AskResult, type ChatField } from "@/lib/chat/form-tools"
import { Button } from "@govblock/ui/components/nova/button"
import { Checkbox } from "@govblock/ui/components/nova/checkbox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@govblock/ui/components/nova/field"
import { Input } from "@govblock/ui/components/nova/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@govblock/ui/components/nova/input-group"
import { Label } from "@govblock/ui/components/nova/label"
import { RadioGroup, RadioGroupItem } from "@govblock/ui/components/nova/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Textarea } from "@govblock/ui/components/nova/textarea"

// One section of a form, as controls in the chat.
//
// Ported from livingston's ChatFormFields: values are held the way they are
// stored (ten digits, plain money, ISO dates) and shown the way they are
// typed, so the profile never carries a formatted string the fill would have
// to unpick. What is new is the profile: a key the applicant has already
// answered arrives prefilled and folded into a one-line summary above the
// open fields, with Edit, so a returning applicant types only what is not
// known yet. Submitting writes the values into the profile and hands the
// model a receipt — which keys were answered — never the values.

const digits = (s: string) => s.replace(/\D/g, "")

function formatTel(stored: string) {
  const d = digits(stored).slice(0, 10)
  if (d.length <= 3) return d.length ? `(${d}` : ""
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

function formatSsn(stored: string) {
  const d = digits(stored).slice(0, 9)
  if (d.length <= 3) return d
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

function formatMoney(stored: string) {
  const m = /^(\d*)(\.\d{0,2})?/.exec(stored.replace(/[^\d.]/g, "")) ?? []
  const whole = m[1] ?? ""
  const frac = m[2] ?? ""
  return (whole ? Number(whole).toLocaleString("en-US") : "") + frac
}
const storeMoney = (typed: string) => {
  const clean = typed.replace(/[^\d.]/g, "")
  const [whole = "", ...rest] = clean.split(".")
  const frac = rest.length ? `.${rest.join("").slice(0, 2)}` : ""
  return whole.replace(/^0+(?=\d)/, "") + frac
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** What is wrong with a value, or nothing. */
function problem(f: ChatField, v: string): string | null {
  const t = v.trim()
  if (!t) return f.required ? "Needed to go on." : null
  if (f.kind === "ssn" && digits(t).length !== 9) return "Nine digits."
  if (f.kind === "tel" && digits(t).length !== 10) return "Ten digits."
  if (f.kind === "email" && !EMAIL.test(t)) return "Not an email address."
  if (f.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(t)) return "A full date."
  return null
}

type Control = { field: ChatField; id: string; value: string; set: (v: string) => void; error?: string }

function Control({ field: f, id, value: v, set, error }: Control) {
  const opts = (f.options ?? []).map(optionParts)
  const invalid = error ? true : undefined
  if (f.kind === "textarea") return <Textarea id={id} rows={2} value={v} placeholder={f.placeholder} aria-invalid={invalid} onChange={(e) => set(e.target.value)} />
  if (f.kind === "select")
    return (
      <Select value={v || null} onValueChange={(next) => set(String(next ?? ""))} items={opts}>
        <SelectTrigger id={id} aria-label={f.label} aria-invalid={invalid} className="w-full">
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent align="start" className="w-max min-w-44">
          {opts.map((o) => (
            <SelectItem key={o.value} value={o.value} className="whitespace-nowrap">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  if (f.kind === "radio")
    return (
      <RadioGroup value={v} onValueChange={(next) => set(String(next ?? ""))} className="gap-1.5" aria-invalid={invalid}>
        {opts.map((o) => (
          <Label key={o.value} className="flex items-center gap-2 font-normal">
            <RadioGroupItem value={o.value} id={`${id}-${o.value}`} />
            {o.label}
          </Label>
        ))}
      </RadioGroup>
    )
  if (f.kind === "yesno" || f.kind === "attest")
    return (
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={f.label} aria-invalid={invalid}>
        {(opts.length ? opts : [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]).map((o) => (
          <Button key={o.value} type="button" size="sm" variant={v === o.value ? "default" : "outline"} role="radio" aria-checked={v === o.value} onClick={() => set(v === o.value ? "" : o.value)}>
            {o.label}
          </Button>
        ))}
      </div>
    )
  if (f.kind === "checkbox") {
    const chosen = splitMulti(v)
    return (
      <div className="flex flex-col gap-1.5" role="group" aria-label={f.label} aria-invalid={invalid}>
        {opts.map((o) => {
          const on = chosen.includes(o.value)
          return (
            <Label key={o.value} className="flex items-center gap-2 font-normal">
              <Checkbox
                id={`${id}-${o.value}`}
                checked={on}
                onCheckedChange={(next) => {
                  const rest = chosen.filter((c) => c !== o.value)
                  set((next ? [...rest, o.value] : rest).join(", "))
                }}
              />
              {o.label}
            </Label>
          )
        })}
      </div>
    )
  }
  if (f.kind === "date") return <Input id={id} type="date" value={v} aria-invalid={invalid} onChange={(e) => set(e.target.value)} />
  if (f.kind === "money")
    return (
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>$</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput id={id} inputMode="decimal" value={formatMoney(v)} placeholder={f.placeholder ?? "0"} aria-invalid={invalid} onChange={(e) => set(storeMoney(e.target.value))} />
      </InputGroup>
    )
  if (f.kind === "tel") return <Input id={id} type="tel" inputMode="numeric" autoComplete="tel" value={formatTel(v)} placeholder={f.placeholder ?? "(555) 555-5555"} aria-invalid={invalid} onChange={(e) => set(digits(e.target.value).slice(0, 10))} />
  if (f.kind === "ssn") return <Input id={id} inputMode="numeric" autoComplete="off" value={formatSsn(v)} placeholder="123-45-6789" aria-invalid={invalid} onChange={(e) => set(digits(e.target.value).slice(0, 9))} />
  if (f.kind === "email") return <Input id={id} type="email" inputMode="email" autoComplete="email" value={v} placeholder={f.placeholder ?? "you@example.com"} aria-invalid={invalid} onChange={(e) => set(e.target.value)} />
  if (f.kind === "number") return <Input id={id} inputMode="numeric" value={v} placeholder={f.placeholder} aria-invalid={invalid} onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ""))} />
  return <Input id={id} type="text" value={v} placeholder={f.placeholder} aria-invalid={invalid} onChange={(e) => set(e.target.value)} />
}

const TONE: Record<"caution" | "info", string> = {
  caution: "border-amber-400/60 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/30",
  info: "border-blue-500/50 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-950/30",
}

export function AskWidget({
  input,
  form,
  answered,
  compact,
  onSubmit,
}: {
  input: AskInput
  form: FormId | null
  /** The receipt already returned, when this widget is being re-rendered from a saved run. */
  answered?: AskResult
  compact?: boolean
  onSubmit: (result: AskResult) => void
}) {
  const plain = React.useMemo(() => plainKeys(input.fields), [input.fields])
  const rows = React.useMemo(() => rowKeys(input.fields), [input.fields])
  const known = React.useCallback((key: string) => (form ? (valueFor(form, key) ?? "") : ""), [form])

  // Rows the profile already holds, at least the minimum.
  const [rowN, setRowN] = React.useState(() => {
    const have = form && input.repeat ? rowCount(valuesFor(form), input.repeat.key) : 0
    return Math.max(input.repeat?.min ?? 1, have, 1)
  })
  const allFields = React.useMemo(() => {
    const out: ChatField[] = [...plain]
    if (rows.length) for (let n = 1; n <= rowN; n += 1) for (const f of rows) out.push({ ...f, key: keyOnRow(f.key, n) })
    return out
  }, [plain, rows, rowN])

  const fromProfile = React.useCallback(() => Object.fromEntries(allFields.map((f) => [f.key, known(f.key)])), [allFields, known])
  const [values, setValues] = React.useState<Values>(fromProfile)
  React.useEffect(() => setValues((prev) => ({ ...fromProfile(), ...prev })), [fromProfile])
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [done, setDone] = React.useState<AskResult | undefined>(answered)
  const [editing, setEditing] = React.useState(false)
  // Known keys start folded; Edit opens them.
  const [showKnown, setShowKnown] = React.useState(false)

  const set = (key: string, v: string) => {
    setValues((p) => ({ ...p, [key]: v }))
    if (errors[key]) setErrors((p) => ({ ...p, [key]: "" }))
  }

  const isKnown = (f: ChatField) => !keyDef(f.key)?.always && Boolean(known(f.key))
  const knownFields = allFields.filter(isKnown)
  const openFields = showKnown || editing ? allFields : allFields.filter((f) => !isKnown(f))

  const submit = () => {
    const problems: Record<string, string> = {}
    for (const f of allFields) {
      const p = problem(f, values[f.key] ?? "")
      if (p) problems[f.key] = p
    }
    setErrors(problems)
    if (Object.keys(problems).length) return
    const merged: Values = {}
    for (const f of allFields) merged[f.key] = (values[f.key] ?? "").trim()
    mergeProfile(merged)
    if (form) markDone(form, input.section)
    const answeredKeys: CanonicalKey[] = []
    const skipped: CanonicalKey[] = []
    for (const f of allFields) (merged[f.key] ? answeredKeys : skipped).push(f.key)
    // The next section still open, from the profile as it now stands — so
    // the model can go on without holding the schema or a tally.
    let next: Extract<AskResult, { section: string }>["next"] = null
    const program = form ? formById(form) : undefined
    if (program) {
      const now = valuesFor(form!)
      const order = askedSections(program)
      const at = order.findIndex((s) => s.n === input.section)
      for (const s of order.slice(at + 1)) {
        const open = sectionKnown(s, now).open
        if (open.length) {
          next = { section: s.n, title: s.title, open }
          break
        }
      }
    }
    const result: AskResult = { section: input.section, answered: answeredKeys, skipped, next }
    setDone(result)
    setEditing(false)
    if (!done) onSubmit(result)
  }

  const grid = compact ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-3 sm:grid-cols-2"
  const wide = (f: ChatField) => f.kind === "textarea" || f.kind === "checkbox" || f.tone || (f.options?.length ?? 0) > 3

  const control = (f: ChatField) => {
    const id = `${input.section}-${f.key}`.replace(/[^\w-]/g, "_")
    const error = errors[f.key]
    if (f.tone) {
      const boxed = (
        <div key={f.key} className={cn("relative rounded-lg border p-3", TONE[f.tone], !compact && "sm:col-span-2")}>
          {f.href && (
            <a href={f.href} target="_blank" rel="noopener noreferrer" aria-label="Read the page this refers to" className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-foreground/60 hover:bg-background/60 hover:text-foreground">
              <ExternalLinkIcon className="size-4" />
            </a>
          )}
          {f.hint && <p className="mb-2.5 pr-8 text-sm leading-relaxed">{f.hint}</p>}
          <Label htmlFor={id} className="mb-1.5">
            {f.label}
          </Label>
          <Control field={f} id={id} value={values[f.key] ?? ""} set={(v) => set(f.key, v)} error={error} />
          {error && <FieldError className="mt-1.5">{error}</FieldError>}
        </div>
      )
      return boxed
    }
    return (
      <Field key={f.key} data-invalid={error ? true : undefined} className={cn(wide(f) && !compact && "sm:col-span-2")}>
        <FieldLabel htmlFor={id}>
          {f.label}
          {f.required && <span className="text-muted-foreground">·</span>}
        </FieldLabel>
        <Control field={f} id={id} value={values[f.key] ?? ""} set={(v) => set(f.key, v)} error={error} />
        {f.hint && !error && <FieldDescription>{f.hint}</FieldDescription>}
        {error && <FieldError>{error}</FieldError>}
      </Field>
    )
  }

  // The rows of a repeating section, each its own small block.
  const rowBlocks = () => {
    if (!rows.length) return null
    const blocks: React.ReactNode[] = []
    for (let n = 1; n <= rowN; n += 1) {
      const these = openFields.filter((f) => rows.some((r) => keyOnRow(r.key, n) === f.key))
      if (!these.length) continue
      blocks.push(
        <div key={n} className={cn("rounded-lg border p-3", !compact && "sm:col-span-2")}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">
              {input.repeat?.label ?? "Row"} {n}
            </span>
            {n === rowN && n > (input.repeat?.min ?? 1) && (
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove this row" onClick={() => setRowN((k) => k - 1)}>
                <XIcon />
              </Button>
            )}
          </div>
          <div className={grid}>{these.map(control)}</div>
        </div>
      )
    }
    return blocks
  }

  // Submitted: a read-only summary, with Edit.
  if (done && !editing) {
    const lines = allFields.filter((f) => (values[f.key] ?? "").trim())
    return (
      <div data-slot="ask-widget" className="rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="font-medium">{input.title}</span>
          <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
        {lines.length ? (
          <dl className={cn("grid gap-x-4 gap-y-0.5", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
            {lines.map((f) => (
              <div key={f.key} className="flex min-w-0 justify-between gap-3 text-muted-foreground">
                <dt className="truncate">{f.label}</dt>
                <dd className="truncate text-right text-foreground">{displayValue(normaliseKey(f.key), values[f.key])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-muted-foreground">Nothing answered.</p>
        )}
      </div>
    )
  }

  return (
    <form
      data-slot="ask-widget"
      className="rounded-lg border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="mb-3 flex flex-col gap-1">
        <span className="text-sm font-medium">{input.title}</span>
        {input.intro && <p className="text-sm text-muted-foreground">{input.intro}</p>}
      </div>

      {knownFields.length > 0 && !showKnown && !editing && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-md border border-dashed px-3 py-2 text-sm">
          <p className="min-w-0 text-muted-foreground">
            Already known:{" "}
            {knownFields.map((f, i) => (
              <React.Fragment key={f.key}>
                {i > 0 && ", "}
                <span className="text-foreground">{f.label.toLowerCase()}</span>
              </React.Fragment>
            ))}
            . <Link href="/workspace/dashboard/settings/applicant" className="underline underline-offset-4">Profile</Link>
          </p>
          <Button type="button" variant="ghost" size="xs" className="shrink-0" onClick={() => setShowKnown(true)}>
            Edit
          </Button>
        </div>
      )}

      <div className={grid}>
        {openFields.filter((f) => plain.some((p) => p.key === f.key)).map(control)}
        {rowBlocks()}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm">
          {done ? "Save" : "Continue"}
        </Button>
        {input.repeat && rowN < input.repeat.max && (
          <Button type="button" variant="outline" size="sm" onClick={() => setRowN((k) => k + 1)}>
            <PlusIcon /> Add {input.repeat.label.toLowerCase()}
          </Button>
        )}
        {done && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
