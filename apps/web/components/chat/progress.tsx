"use client"

import * as React from "react"

import { formById, type FormId } from "@/lib/forms/programs"
import { loadFormState, onProfileChange, progress, valuesFor } from "@/lib/forms/profile"

// Sections done of the form in hand, above the composer while a form is
// active. From livingston's FormProgress: the count is the record's, never
// the model's tally, so it cannot lag a section the widget already saved.

export function FormProgress({ form }: { form: FormId }) {
  const program = formById(form)
  const read = React.useCallback(() => (program ? progress(program, loadFormState(form), valuesFor(form)) : { done: 0, total: 0 }), [form, program])
  const [state, setState] = React.useState(read)
  React.useEffect(() => {
    setState(read())
    return onProfileChange(() => setState(read()))
  }, [read])
  if (!program || !state.total) return null
  const pct = Math.round((state.done / state.total) * 100)
  return (
    <div data-slot="form-progress" className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="shrink-0 font-medium text-foreground">{program.code}</span>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 tabular-nums">
        {state.done} of {state.total} sections
      </span>
    </div>
  )
}
