"use client"

import * as React from "react"

import { cn } from "@govblock/ui/lib/utils"
import { displayValue, keyDef, normaliseKey } from "@/lib/forms/keys"
import { askedSections, formById, sectionLabel, type FormId } from "@/lib/forms/programs"
import { onProfileChange, sectionKeys, valuesFor } from "@/lib/forms/profile"
import { AskWidget } from "@/components/chat/ask-widget"
import type { ChatField, ReviewResult } from "@/lib/chat/form-tools"
import { Button } from "@govblock/ui/components/nova/button"

// Every answer, before anything is filled: grouped by the form's sections,
// each section reopening as the same controls it was asked with. "Looks
// right" is the confirmation; the values stay in the profile, and the model
// hears only that it was confirmed and how many answers there are.

export function ReviewWidget({ form, answered, compact, onSubmit }: { form: FormId; answered?: ReviewResult; compact?: boolean; onSubmit: (result: ReviewResult) => void }) {
  const program = formById(form)
  const [values, setValues] = React.useState(() => valuesFor(form))
  const [editing, setEditing] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<ReviewResult | undefined>(answered)

  React.useEffect(() => onProfileChange(() => setValues(valuesFor(form))), [form])

  if (!program) return null
  const sections = askedSections(program)
  const filled = (key: string) => {
    const v = values[key]
    return v && v !== "skip" && v !== "unknown" ? v : ""
  }

  const confirm = () => {
    const answered = sections.reduce((n, s) => n + sectionKeys(s, values).filter((k) => filled(k)).length, 0)
    const result = { confirmed: true, sections: sections.length, answered }
    setDone(result)
    onSubmit(result)
  }

  return (
    <div data-slot="review-widget" className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium">{program.code}</span>
        {done && <span className="text-muted-foreground">Confirmed</span>}
      </div>
      <div className="flex flex-col divide-y">
        {sections.map((s) => {
          const keys = sectionKeys(s, values).filter((k) => filled(k))
          if (!keys.length && !s.keys.length) return null
          if (editing === s.n) {
            const fields: ChatField[] = s.keys.map((key) => {
              const def = keyDef(key)!
              return { key, label: def.label, kind: def.kind, options: def.options, multi: def.multi, tone: def.tone, href: def.href }
            })
            return (
              <div key={s.n} className="py-2">
                <AskWidget
                  input={{ section: s.n, title: sectionLabel(program, s.n), fields, repeat: s.repeat ? { ...s.repeat, min: 1 } : undefined }}
                  form={form}
                  compact={compact}
                  onSubmit={() => setEditing(null)}
                />
              </div>
            )
          }
          return (
            <div key={s.n} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{sectionLabel(program, s.n)}</span>
                {!done && (
                  <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setEditing(s.n)}>
                    Edit
                  </Button>
                )}
              </div>
              {keys.length ? (
                <dl className={cn("mt-1 grid gap-x-4 gap-y-0.5", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
                  {keys.map((k) => (
                    <div key={k} className="flex min-w-0 justify-between gap-3 text-muted-foreground">
                      <dt className="truncate">{keyDef(k)?.label ?? k}</dt>
                      <dd className="truncate text-right text-foreground">{displayValue(normaliseKey(k), values[k])}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-1 text-muted-foreground">Nothing answered.</p>
              )}
            </div>
          )
        })}
      </div>
      {!done && (
        <div className="mt-3">
          <Button type="button" size="sm" onClick={confirm} disabled={editing !== null}>
            Looks right
          </Button>
        </div>
      )}
    </div>
  )
}
