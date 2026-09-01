"use client"

import * as React from "react"

import { useLocal } from "@/lib/policy/use-local"
import { Button } from "@govblock/ui/components/nova/button"
import { Textarea } from "@govblock/ui/components/nova/textarea"

// The notes page of the /typeset workspace. Same store as the Bill Notes
// widget on /create, so a note taken there is the note here.
export function BillNotes({
  billId,
  billNumber,
  title,
}: {
  billId: number
  billNumber: string
  title: string
}) {
  const [notes, setNotes] = useLocal<Record<string, string>>("livingston:bill-notes", {})
  const [draft, setDraft] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)
  const value = draft ?? notes[String(billId)] ?? ""

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="typeset w-full">
        <h1>{billNumber} — Notes</h1>
        <p>
          <em>{title}</em>
        </p>
      </div>
      <Textarea
        value={value}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="What matters about this bill, who to call, what to watch, what the sponsor said…"
        className="min-h-[50vh] text-[length:inherit] leading-[inherit]"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {saved ? "Saved to this browser." : draft !== null && draft !== (notes[String(billId)] ?? "") ? "Unsaved changes." : "Private to this browser."}
        </span>
        <Button
          size="sm"
          onClick={() => {
            setNotes((map) => ({ ...map, [String(billId)]: value }))
            setDraft(null)
            setSaved(true)
            setTimeout(() => setSaved(false), 1500)
          }}
        >
          Save Note
        </Button>
      </div>
    </div>
  )
}
