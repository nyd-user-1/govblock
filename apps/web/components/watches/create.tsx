"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CompassIcon, FolderOpenIcon, LandmarkIcon, ScrollTextIcon, WorkflowIcon } from "lucide-react"

import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { Input } from "@govblock/ui/components/nova/input"
import { Label } from "@govblock/ui/components/nova/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Textarea } from "@govblock/ui/components/nova/textarea"
import { cn } from "@govblock/ui/lib/utils"

import { STATE_NAMES } from "@/lib/filters"
import { TEMPLATES, VIAS, templateById, type Answers, type Field, type Step, type Template, type Trigger, type Via } from "@/lib/watches/templates"
import { CreateCard, CreateFrame, Gate, ICONS, IconTile, OptionRow, useAccount } from "./shared"

// Create a watch, in the shape of the Cloudflare dashboard's create flow:
// a label on the left, one card in the middle that changes as you go, the
// two steps on the right. "Make something new" offers the two watches most
// people want side by side, then the template list, then a build-your-own,
// then a list of bills to drop in. The set-up card asks only what the
// template needs, then where to send it, then turns it on.

type Stage = "method" | "templates" | "setup" | "custom" | "upload"

const STATES = Object.entries(STATE_NAMES).sort((a, b) => (a[0] === "US" ? -1 : b[0] === "US" ? 1 : a[1].localeCompare(b[1])))
const WHEN = [
  { value: "any", label: "Every action" },
  { value: "passed", label: "When it passes a chamber" },
  { value: "signed", label: "When it is signed" },
  { value: "committee", label: "When it moves in committee" },
  { value: "vetoed", label: "When it is vetoed" },
]

type BillHit = { bill_id: number; bill_number: string; title: string; state: string }

export function CreateWatch() {
  const router = useRouter()
  const { account, ready } = useAccount()
  const [stage, setStage] = React.useState<Stage>("method")
  const [template, setTemplate] = React.useState<Template | null>(null)
  if (ready && !account) return <Gate what="Watches" />

  const pick = (id: string) => {
    setTemplate(templateById(id) ?? null)
    setStage("setup")
  }
  const steps = ["Select a method", "Set up and turn on"]
  const current = stage === "method" || stage === "templates" ? 0 : 1

  return (
    <CreateFrame label="Create a watch" steps={steps} current={current}>
      {stage === "method" && (
        <CreateCard title="Make something new" description="Start from a template, build your own, or drop in a list of bills.">
          <div className="grid gap-3 sm:grid-cols-2">
            <OptionRow icon={ScrollTextIcon} title="Track a bill" onClick={() => pick("track-bill")} />
            <OptionRow icon={LandmarkIcon} title="Committee watch" onClick={() => pick("committee-watch")} />
          </div>
          <OptionRow icon={CompassIcon} title="Select a template" description="Memos, digests, vote reports, text changes, letters." onClick={() => setStage("templates")} />
          <OptionRow icon={WorkflowIcon} title="Build your own" description="Pick what to watch and what should happen." onClick={() => setStage("custom")} />
          <OptionRow icon={FolderOpenIcon} title="Upload a list of bills" description="A CSV or a text file, one bill a line." onClick={() => setStage("upload")} />
        </CreateCard>
      )}
      {stage === "templates" && (
        <CreateCard
          title="Select a template"
          description="Get going with one of the watches people use most."
          footer={
            <>
              <Button variant="ghost" onClick={() => setStage("method")}>
                Back
              </Button>
              <span className="text-sm text-muted-foreground">{TEMPLATES.length} templates</span>
            </>
          }
        >
          {TEMPLATES.map((t) => (
            <OptionRow
              key={t.id}
              icon={ICONS[t.icon]}
              title={t.name}
              description={t.description}
              onClick={() => pick(t.id)}
              badge={
                t.featured ? (
                  <Badge variant="secondary" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    ✦ Featured
                  </Badge>
                ) : undefined
              }
            />
          ))}
        </CreateCard>
      )}
      {stage === "setup" && template && <Setup template={template} account={account} onBack={() => setStage("method")} onDone={(id) => router.push(`/watches/${id}`)} />}
      {stage === "custom" && <Custom account={account} onBack={() => setStage("method")} onDone={(id) => router.push(`/watches/${id}`)} />}
      {stage === "upload" && <Upload account={account} onBack={() => setStage("method")} onDone={() => router.push("/watches")} />}
    </CreateFrame>
  )
}

/* ---- fields ------------------------------------------------------------------ */

function BillPicker({ state, value, onPick }: { state: string; value?: { bill_id: number; label: string } | null; onPick: (hit: BillHit | null) => void }) {
  const [q, setQ] = React.useState("")
  const [hits, setHits] = React.useState<BillHit[]>([])
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    if (q.trim().length < 2) return setHits([])
    const t = setTimeout(async () => {
      const r = await fetch(`/api/policy/search?state=${encodeURIComponent(state)}&q=${encodeURIComponent(q.trim())}&limit=8`)
      if (!r.ok) return
      const d = (await r.json()) as { bills?: BillHit[] }
      setHits(d.bills ?? [])
      setOpen(true)
    }, 250)
    return () => clearTimeout(t)
  }, [q, state])
  if (value)
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate">{value.label}</span>
        <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => onPick(null)}>
          Change
        </button>
      </div>
    )
  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${STATE_NAMES[state] ?? state} bills by number or title`}
        onFocus={() => hits.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && hits.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
          {hits.map((h) => (
            <li key={h.bill_id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(h)
                  setOpen(false)
                }}
                className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-accent"
              >
                <span className="text-sm font-medium">
                  {h.state} {String(h.bill_number).replace(/^([A-Z]+)0*(\d+)/, "$1 $2")}
                </span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{h.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FieldRow({ field, answers, set, allowAll }: { field: Field; answers: Answers; set: (k: string, v: string | number | undefined) => void; allowAll?: boolean }) {
  const state = String(answers.state ?? "NY")
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      {field.kind === "bill" && (
        <>
          <div className="flex gap-2">
            <Select value={state} onValueChange={(v) => v && set("state", String(v))}>
              <SelectTrigger className="w-max min-w-24" aria-label="Jurisdiction">
                <SelectValue>{() => state}</SelectValue>
              </SelectTrigger>
              <SelectContent className="w-max min-w-44">
                {STATES.map(([code, name]) => (
                  <SelectItem key={code} value={code} className="whitespace-nowrap">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="min-w-0 flex-1">
              <BillPicker
                state={state}
                value={answers.bill_id ? { bill_id: Number(answers.bill_id), label: String(answers.bill_label ?? "") } : null}
                onPick={(h) => {
                  set("bill_id", h?.bill_id)
                  set("bill_label", h ? `${h.state} ${String(h.bill_number).replace(/^([A-Z]+)0*(\d+)/, "$1 $2")}: ${h.title}` : undefined)
                  if (h) set("state", h.state)
                }}
              />
            </div>
          </div>
        </>
      )}
      {field.kind === "jurisdiction" && (
        <Select value={String(answers.state ?? "NY")} onValueChange={(v) => v && set("state", String(v))}>
          <SelectTrigger className="w-max min-w-48" aria-label="Jurisdiction">
            <SelectValue>{() => (answers.state === "all" ? "All 52 jurisdictions" : (STATE_NAMES[String(answers.state ?? "NY")] ?? String(answers.state ?? "NY")))}</SelectValue>
          </SelectTrigger>
          <SelectContent className="w-max min-w-44">
            {allowAll && (
              <SelectItem value="all" className="whitespace-nowrap">
                All 52 jurisdictions
              </SelectItem>
            )}
            {STATES.map(([code, name]) => (
              <SelectItem key={code} value={code} className="whitespace-nowrap">
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {(field.kind === "text" || field.kind === "committee") && <Input value={String(answers[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} placeholder={field.placeholder} />}
      {field.kind === "number" && <Input type="number" value={String(answers[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} placeholder={field.placeholder} className="w-32" />}
      {field.kind === "date" && <Input type="date" value={String(answers[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} className="w-max" />}
      {field.kind === "when" && (
        <Select value={String(answers.when ?? "any")} onValueChange={(v) => v && set("when", String(v))}>
          <SelectTrigger className="w-max min-w-56" aria-label="Which actions">
            <SelectValue>{() => WHEN.find((w) => w.value === String(answers.when ?? "any"))?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent className="w-max min-w-44">
            {WHEN.map((w) => (
              <SelectItem key={w.value} value={w.value} className="whitespace-nowrap">
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
    </div>
  )
}

function Delivery({ via, to, setVia, setTo, email }: { via: Via; to: string; setVia: (v: Via) => void; setTo: (v: string) => void; email?: string | null }) {
  const def = VIAS.find((v) => v.value === via)!
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">Send it to</Label>
      <div className="flex gap-2">
        <Select
          value={via}
          onValueChange={(v) => {
            if (!v) return
            setVia(v as Via)
            setTo(v === "email" ? (email ?? "") : "")
          }}
        >
          <SelectTrigger className="w-max min-w-32" aria-label="Send via">
            <SelectValue>{() => def.label}</SelectValue>
          </SelectTrigger>
          <SelectContent className="w-max min-w-44">
            {VIAS.map((v) => (
              <SelectItem key={v.value} value={v.value} className="whitespace-nowrap">
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {def.needs && <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder={def.needs === "address" ? "you@example.com" : "https://…"} className="min-w-0 flex-1" />}
      </div>
      <p className="text-xs text-muted-foreground">{def.hint}</p>
    </div>
  )
}

/* ---- set up from a template ------------------------------------------------- */

function Setup({ template, account, onBack, onDone }: { template: Template; account: { email?: string | null } | null; onBack: () => void; onDone: (id: string) => void }) {
  const [answers, setAnswers] = React.useState<Answers>({ state: "NY", when: "any" })
  const [name, setName] = React.useState("")
  const [via, setVia] = React.useState<Via>("inbox")
  const [to, setTo] = React.useState("")
  const [approve, setApprove] = React.useState(template.id === "weekly-digest")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const set = (k: string, v: string | number | undefined) => setAnswers((a) => ({ ...a, [k]: v }))

  const missing = template.fields.filter((f) => f.required && (f.kind === "bill" ? !answers.bill_id : !answers[f.key === "state" ? "state" : f.key]))
  const suggested =
    template.id === "weekly-digest"
      ? `Weekly digest · ${answers.state === "all" ? "everywhere" : answers.state}${answers.keyword ? ` · ${answers.keyword}` : ""}`
      : answers.bill_label
        ? `${template.name} · ${String(answers.bill_label).split(":")[0]}`
        : answers.committee
          ? `${template.name} · ${answers.committee}`
          : template.name
  const Icon = ICONS[template.icon]

  const submit = async () => {
    setBusy(true)
    setError(null)
    const r = await fetch("/api/watches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() || suggested, template: template.id, answers, via, to: to || undefined, approve }) })
    const d = (await r.json().catch(() => ({}))) as { id?: string; error?: string }
    setBusy(false)
    if (!r.ok || !d.id) return setError(d.error ?? "Could not save the watch.")
    onDone(d.id)
  }

  return (
    <CreateCard
      title="Set up your watch"
      description={template.description}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            {error && <span className="text-sm text-destructive">{error}</span>}
            <Button onClick={() => void submit()} disabled={busy || missing.length > 0 || (VIAS.find((v) => v.value === via)?.needs ? !to : false)}>
              {busy ? "Turning on…" : "Turn on"}
            </Button>
          </div>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
        <IconTile icon={Icon} />
        <span className="text-sm font-medium">{template.name}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={suggested} />
      </div>
      {template.fields.map((f) => (
        <FieldRow key={f.key} field={f} answers={answers} set={set} allowAll={template.id === "new-bills"} />
      ))}
      <Delivery via={via} to={to} setVia={setVia} setTo={setTo} email={account?.email} />
      {template.approvable && (
        <label className="flex items-start gap-3 rounded-lg border p-3">
          <Checkbox checked={approve} onCheckedChange={(v) => setApprove(v === true)} className="mt-0.5" />
          <span className="flex flex-col">
            <span className="text-sm font-medium">Ask me before it goes out</span>
            <span className="text-xs text-muted-foreground">The draft waits in your inbox for three days. Nothing is sent until you say so.</span>
          </span>
        </label>
      )}
    </CreateCard>
  )
}

/* ---- build your own ---------------------------------------------------------- */

const KINDS: { value: Trigger["kind"]; label: string; fields: Field[] }[] = [
  {
    value: "bill.action",
    label: "A bill acts",
    fields: [
      { key: "bill", label: "Bill", kind: "bill", required: true },
      { key: "when", label: "Which actions", kind: "when" },
    ],
  },
  { value: "text.landed", label: "A bill's text lands", fields: [{ key: "bill", label: "Bill", kind: "bill", required: true }] },
  {
    value: "rollcall.recorded",
    label: "A roll call is recorded",
    fields: [
      { key: "state", label: "Jurisdiction", kind: "jurisdiction", required: true },
      { key: "bill", label: "Bill", kind: "bill", hint: "Optional." },
    ],
  },
  {
    value: "bill.introduced",
    label: "A bill is introduced",
    fields: [
      { key: "state", label: "Jurisdiction", kind: "jurisdiction", required: true },
      { key: "keyword", label: "Keyword", kind: "text" },
      { key: "committee", label: "Committee", kind: "committee" },
    ],
  },
  {
    value: "hearing.scheduled",
    label: "A hearing is scheduled",
    fields: [
      { key: "state", label: "Jurisdiction", kind: "jurisdiction", required: true },
      { key: "committee", label: "Committee", kind: "committee" },
    ],
  },
  {
    value: "schedule",
    label: "On a schedule",
    fields: [
      { key: "state", label: "Jurisdiction", kind: "jurisdiction", required: true },
      { key: "keyword", label: "Keyword", kind: "text" },
      { key: "committee", label: "Committee", kind: "committee" },
    ],
  },
  {
    value: "date",
    label: "On a date",
    fields: [
      { key: "date", label: "Date", kind: "date", required: true },
      { key: "bill", label: "Bill", kind: "bill", hint: "Optional." },
    ],
  },
]
const TASKS = [
  { value: "", label: "Nothing, just the facts" },
  { value: "summarize", label: "A summary" },
  { value: "memo", label: "A memo" },
  { value: "diff", label: "What changed in the text" },
  { value: "vote-report", label: "A vote report" },
  { value: "hearing-brief", label: "A hearing brief" },
  { value: "digest", label: "A digest of what moved" },
  { value: "letter", label: "A letter to my legislator" },
]

function Custom({ account, onBack, onDone }: { account: { email?: string | null } | null; onBack: () => void; onDone: (id: string) => void }) {
  const [kind, setKind] = React.useState<Trigger["kind"]>("bill.action")
  const [answers, setAnswers] = React.useState<Answers>({ state: "NY", when: "any" })
  const [task, setTask] = React.useState("")
  const [approve, setApprove] = React.useState(false)
  const [name, setName] = React.useState("")
  const [via, setVia] = React.useState<Via>("inbox")
  const [to, setTo] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const set = (k: string, v: string | number | undefined) => setAnswers((a) => ({ ...a, [k]: v }))
  const def = KINDS.find((k) => k.value === kind)!
  const missing = def.fields.filter((f) => f.required && (f.kind === "bill" ? !answers.bill_id : !answers[f.key]))

  const build = (): { trigger: Trigger; steps: Step[] } => {
    const st = String(answers.state ?? "NY").toUpperCase()
    const bill = answers.bill_id ? Number(answers.bill_id) : undefined
    let trigger: Trigger
    switch (kind) {
      case "bill.action":
        trigger = { kind, state: st, bill_id: bill!, when: (answers.when as never) || "any" }
        break
      case "text.landed":
        trigger = { kind, state: st, bill_id: bill! }
        break
      case "rollcall.recorded":
        trigger = { kind, state: st, ...(bill ? { bill_id: bill } : {}) }
        break
      case "bill.introduced":
        trigger = { kind, state: st, keyword: answers.keyword ? String(answers.keyword) : undefined, committee: answers.committee ? String(answers.committee) : undefined }
        break
      case "hearing.scheduled":
        trigger = { kind, state: st, committee: answers.committee ? String(answers.committee) : undefined }
        break
      case "schedule":
        trigger = { kind, every: "week", dow: 1, hour: 13, state: st, keyword: answers.keyword ? String(answers.keyword) : undefined, committee: answers.committee ? String(answers.committee) : undefined, days: 7 }
        break
      default:
        trigger = { kind: "date", at: new Date(`${answers.date}T13:00:00Z`).toISOString(), ...(bill ? { bill_id: bill, state: st } : {}) }
    }
    const what: Extract<Step, { kind: "enrich" }>["what"] = kind === "schedule" ? ["moved"] : task === "diff" ? ["bill", "text"] : task === "vote-report" ? ["bill", "votes", "sponsors"] : ["bill", "sponsors", "votes", "history"]
    const steps: Step[] = [{ kind: "enrich", what }]
    if (task) steps.push({ kind: "agent", task: task as never })
    if (approve) steps.push({ kind: "approve", timeout: "72h" })
    steps.push({ kind: "deliver", via, ...(to ? { to } : {}) })
    return { trigger, steps }
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    const { trigger, steps } = build()
    const r = await fetch("/api/watches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || `${def.label}${answers.bill_label ? ` · ${String(answers.bill_label).split(":")[0]}` : ""}`, trigger, steps }),
    })
    const d = (await r.json().catch(() => ({}))) as { id?: string; error?: string }
    setBusy(false)
    if (!r.ok || !d.id) return setError(d.error ?? "Could not save the watch.")
    onDone(d.id)
  }

  return (
    <CreateCard
      title="Build your own"
      description="What to watch, what should happen, and where it goes."
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            {error && <span className="text-sm text-destructive">{error}</span>}
            <Button onClick={() => void submit()} disabled={busy || missing.length > 0}>
              {busy ? "Turning on…" : "Turn on"}
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={def.label} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">When</Label>
        <Select value={kind} onValueChange={(v) => v && setKind(v as Trigger["kind"])}>
          <SelectTrigger className="w-max min-w-56" aria-label="Trigger">
            <SelectValue>{() => def.label}</SelectValue>
          </SelectTrigger>
          <SelectContent className="w-max min-w-44">
            {KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value} className="whitespace-nowrap">
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {def.fields.map((f) => (
        <FieldRow key={f.key} field={f} answers={answers} set={set} allowAll={kind === "bill.introduced"} />
      ))}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Then write</Label>
        <Select value={task} onValueChange={(v) => setTask(String(v ?? ""))}>
          <SelectTrigger className="w-max min-w-56" aria-label="Agent task">
            <SelectValue>{() => TASKS.find((t) => t.value === task)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent className="w-max min-w-44">
            {TASKS.map((t) => (
              <SelectItem key={t.value || "none"} value={t.value} className="whitespace-nowrap">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-start gap-3 rounded-lg border p-3">
        <Checkbox checked={approve} onCheckedChange={(v) => setApprove(v === true)} className="mt-0.5" />
        <span className="flex flex-col">
          <span className="text-sm font-medium">Ask me before it goes out</span>
          <span className="text-xs text-muted-foreground">It waits in your inbox for three days.</span>
        </span>
      </label>
      <Delivery via={via} to={to} setVia={setVia} setTo={setTo} email={account?.email} />
    </CreateCard>
  )
}

/* ---- a list of bills --------------------------------------------------------- */

function Upload({ account, onBack, onDone }: { account: { email?: string | null } | null; onBack: () => void; onDone: () => void }) {
  const [state, setState] = React.useState("NY")
  const [lines, setLines] = React.useState<string[]>([])
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [resolved, setResolved] = React.useState<{ line: string; hit: BillHit | null }[]>([])
  const [via, setVia] = React.useState<Via>("inbox")
  const [to, setTo] = React.useState("")
  const [busy, setBusy] = React.useState<string | null>(null)
  const [over, setOver] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const read = async (file: File) => {
    const text = await file.text()
    const ls = text
      .split(/\r?\n/)
      .map((l) => l.split(",")[0].trim())
      .filter((l) => l && !/^bill|^number/i.test(l))
      .slice(0, 100)
    setFileName(file.name)
    setLines(ls)
    setResolved([])
  }
  const resolve = async () => {
    setBusy("Looking up bills…")
    const out: { line: string; hit: BillHit | null }[] = []
    for (const line of lines) {
      const m = /^([A-Z]{2})\s+(.+)$/i.exec(line)
      const st = m ? m[1].toUpperCase() : state
      const num = (m ? m[2] : line).replace(/\s+/g, "").toUpperCase()
      const r = await fetch(`/api/policy/search?state=${st}&q=${encodeURIComponent(num)}&limit=5`)
      const d = r.ok ? ((await r.json()) as { bills?: BillHit[] }) : {}
      const hit = (d.bills ?? []).find((b) => String(b.bill_number).replace(/\s+/g, "").toUpperCase() === num) ?? (d.bills ?? [])[0] ?? null
      out.push({ line, hit })
    }
    setResolved(out)
    setBusy(null)
  }
  const submit = async () => {
    setBusy("Turning on…")
    for (const { hit } of resolved) {
      if (!hit) continue
      await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Track ${hit.state} ${String(hit.bill_number).replace(/^([A-Z]+)0*(\d+)/, "$1 $2")}`,
          template: "track-bill",
          answers: { bill_id: hit.bill_id, state: hit.state, bill_label: hit.title, when: "any" },
          via,
          to: to || undefined,
        }),
      })
    }
    setBusy(null)
    onDone()
  }
  const found = resolved.filter((r) => r.hit).length

  return (
    <CreateCard
      title="Upload a list of bills"
      description="One bill a line. A jurisdiction code in front of a number, TX HB 2, overrides the one chosen here."
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          {resolved.length === 0 ? (
            <Button onClick={() => void resolve()} disabled={!lines.length || !!busy}>
              {busy ?? `Look up ${lines.length || ""} ${lines.length === 1 ? "bill" : "bills"}`}
            </Button>
          ) : (
            <Button onClick={() => void submit()} disabled={!found || !!busy}>
              {busy ?? `Turn on ${found} ${found === 1 ? "watch" : "watches"}`}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Jurisdiction</Label>
        <Select value={state} onValueChange={(v) => v && setState(String(v))}>
          <SelectTrigger className="w-max min-w-48" aria-label="Jurisdiction">
            <SelectValue>{() => STATE_NAMES[state] ?? state}</SelectValue>
          </SelectTrigger>
          <SelectContent className="w-max min-w-44">
            {STATES.map(([code, name]) => (
              <SelectItem key={code} value={code} className="whitespace-nowrap">
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) void read(f)
        }}
        onClick={() => fileRef.current?.click()}
        className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors", over ? "border-foreground bg-accent/40" : "hover:bg-accent/30")}
      >
        <span className="flex size-12 items-center justify-center rounded-lg border bg-background">
          <FolderOpenIcon className="size-5" />
        </span>
        <p className="text-sm font-medium">{fileName ? `${fileName} · ${lines.length} ${lines.length === 1 ? "line" : "lines"}` : "Drag in or click to upload a file."}</p>
        <p className="text-xs text-muted-foreground">A CSV with the bill number in the first column, or a text file.</p>
        <input ref={fileRef} type="file" accept=".csv,.txt,text/plain,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
      </div>
      {resolved.length > 0 && (
        <ul className="divide-y rounded-lg border text-sm">
          {resolved.map((r, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2">
              <span className={cn("size-2 rounded-full", r.hit ? "bg-green-500" : "bg-destructive")} />
              <span className="w-24 shrink-0 font-mono text-xs">{r.line}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.hit ? `${r.hit.state} ${r.hit.bill_number}: ${r.hit.title}` : "not found"}</span>
            </li>
          ))}
        </ul>
      )}
      <Delivery via={via} to={to} setVia={setVia} setTo={setTo} email={account?.email} />
    </CreateCard>
  )
}
