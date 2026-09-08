"use client"

import * as React from "react"

import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { Control } from "@/components/chat/ask-widget"
import { gateOpen, keyDef, type CanonicalKey } from "@/lib/forms/keys"
import { forgetEverything, loadProfile, mergeProfile, onProfileChange, rowCount, type Values } from "@/lib/forms/profile"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader } from "@govblock/ui/components/nova/card"
import { Label } from "@govblock/ui/components/nova/label"

// The applicant profile, as a settings tab: the same store the Filer reads
// and writes, in the forms' own order — you, contact, household, citizenship,
// income, housing, expenses. Filling it here is onboarding: a person who has
// done this has both forms mostly done before opening /chat, and every field
// is a key from lib/forms/keys.ts so nothing here can drift from the widget.

type Section = { title: string; description?: string; keys: CanonicalKey[]; rows?: { prefix: string; label: string; max: number } }

const SECTIONS: Section[] = [
  { title: "You", keys: ["applicant.firstName", "applicant.middleInitial", "applicant.lastName", "applicant.aliases", "applicant.dob", "applicant.sex", "applicant.genderIdentity", "applicant.ssn", "applicant.maritalStatus", "applicant.maritalStatusDetail", "language.read", "language.readDetail", "language.speak", "language.speakDetail", "interpreter"] },
  { title: "Contact", keys: ["applicant.phone", "applicant.phoneType", "applicant.email", "contact.preferred", "contact.preferredDetail", "address.street", "address.apt", "address.city", "address.county", "address.state", "address.zip", "mailing.same", "mailing.street", "mailing.apt", "mailing.city", "mailing.county", "mailing.state", "mailing.zip"] },
  {
    title: "Household members",
    description: "Everyone who lives with the applicant, whether or not they are applying.",
    keys: ["household[n].firstName", "household[n].lastName", "household[n].dob", "household[n].sex", "household[n].relationship", "household[n].ssn", "household[n].buysFoodTogether", "household[n].citizenship", "household[n].citizenshipDetail", "household[n].needsCare", "household[n].specialNeeds", "household[n].bothParents"],
    rows: { prefix: "household", label: "Person", max: 7 },
  },
  { title: "Citizenship", keys: ["applicant.citizenship", "applicant.citizenshipDetail", "raceEthnicity.provide", "applicant.race"] },
  {
    title: "Income",
    keys: ["income.hasAny", "income[n].source", "income[n].sourceDetail", "income[n].who", "income[n].amount", "income[n].period", "income[n].periodDetail"],
    rows: { prefix: "income", label: "Income", max: 12 },
  },
  { title: "Work", keys: ["employment.status", "employment.statusDetail", "employment.employer", "employment.hoursPerWeek", "employment.lastWorked", "employment.lastEmployer", "employment.endReason", "employment.lookingForWork", "employment.inTraining", "education.highestGrade", "education.highestGradeDetail", "education.currentSchool"] },
  { title: "Housing", keys: ["shelter.type", "shelter.typeDetail", "shelter.amount", "shelter.payee", "shelter.heatIncluded", "utilities.heatCost", "utilities.shutoffNotice", "housing.homeless"] },
  { title: "Expenses", keys: ["expenses.childCare", "expenses.childSupportPaid", "expenses.other"] },
]

const atRow = (key: string, n: number) => key.replace("[n]", `[${n}]`)

function SectionCard({ section, values, set }: { section: Section; values: Values; set: (key: string, v: string) => void }) {
  const [rows, setRows] = React.useState(() => Math.max(1, section.rows ? rowCount(values, section.rows.prefix) : 0))
  const keys: string[] = []
  for (const key of section.keys) {
    if (!key.includes("[n]")) keys.push(key)
    else for (let n = 1; n <= rows; n += 1) keys.push(atRow(key, n))
  }
  const rowsOf = (n: number) => keys.filter((k) => k.includes(`[${n}]`))
  const plain = keys.filter((k) => !/\[\d+\]/.test(k))

  const field = (key: string) => {
    const def = keyDef(key)
    if (!def || !gateOpen(key, values)) return null
    const id = `applicant-${key}`.replace(/[^\w-]/g, "_")
    const wide = def.kind === "textarea" || def.kind === "checkbox" || (def.options?.length ?? 0) > 3
    return (
      <div key={key} className={wide ? "flex flex-col gap-2 sm:col-span-2" : "flex flex-col gap-2"}>
        <Label htmlFor={id}>{def.label}</Label>
        <Control field={{ key, label: def.label, kind: def.kind, options: def.options, multi: def.multi }} id={id} value={values[key] ?? ""} set={(v) => set(key, v)} />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardAnchor>{section.title}</CardAnchor>
        {section.description && <CardDescription>{section.description}</CardDescription>}
        <CardAction>
          <CardTools />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {plain.map(field)}
        {section.rows &&
          Array.from({ length: rows }, (_, i) => i + 1).map((n) => (
            <div key={n} className="rounded-lg border p-3 sm:col-span-2">
              <p className="mb-3 text-sm font-medium">
                {section.rows!.label} {n}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">{rowsOf(n).map(field)}</div>
            </div>
          ))}
      </CardContent>
      {section.rows && rows < section.rows.max && (
        <CardFooter>
          <Button variant="outline" size="sm" onClick={() => setRows((r) => r + 1)}>
            Add {section.rows.label.toLowerCase()}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

export function Applicant() {
  const [values, setValues] = React.useState<Values>({})
  const [dirty, setDirty] = React.useState<Values>({})
  const [saved, setSaved] = React.useState(false)
  React.useEffect(() => {
    setValues(loadProfile().values)
    return onProfileChange(() => setValues((v) => ({ ...loadProfile().values, ...v })))
  }, [])
  const set = (key: string, v: string) => {
    setValues((p) => ({ ...p, [key]: v }))
    setDirty((p) => ({ ...p, [key]: v }))
    setSaved(false)
  }
  const save = () => {
    mergeProfile(dirty)
    setDirty({})
    setSaved(true)
  }
  const count = Object.keys(values).filter((k) => values[k] && keyDef(k)).length
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{count ? `${count} answers in this browser.` : "Nothing saved yet."}</span>
        <span>The Filer fills LDSS-2921 and OCFS-6025 from these; a form asks only what is missing.</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-muted-foreground"
          onClick={() => {
            forgetEverything()
            setValues({})
            setDirty({})
          }}
        >
          Forget everything
        </Button>
      </div>
      {SECTIONS.map((section) => (
        <SectionCard key={section.title} section={section} values={values} set={set} />
      ))}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={!Object.keys(dirty).length}>
          Save changes
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
      </div>
    </div>
  )
}
