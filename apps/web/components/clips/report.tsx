"use client"

import * as React from "react"

import { Button } from "@govblock/ui/components/nova/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@govblock/ui/components/nova/dialog"
import { Input } from "@govblock/ui/components/nova/input"
import { Label } from "@govblock/ui/components/nova/label"
import { RadioGroup, RadioGroupItem } from "@govblock/ui/components/nova/radio-group"
import { Textarea } from "@govblock/ui/components/nova/textarea"

import { reportClip, type Clip, type ReportReason } from "./store"

// Report, from a clip's menu. The reason, what the reporter wants known, and
// an address to answer; a copyright report needs both of the last two. The
// report goes to GovBlock's admins, who take the clip down or keep it.

const REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: "copyright", label: "Copyright", hint: "It uses a work that belongs to the reporter or the reporter's client." },
  { value: "privacy", label: "Privacy", hint: "It shows or names someone who did not agree to it." },
  { value: "harmful", label: "Harmful or misleading", hint: "It harasses, threatens, or misstates the record." },
  { value: "other", label: "Something else", hint: "" },
]

export function ReportDialog({ clip, open, onOpenChange, defaultContact }: { clip: Clip; open: boolean; onOpenChange: (open: boolean) => void; defaultContact?: string }) {
  const [reason, setReason] = React.useState<ReportReason | "">("")
  const [details, setDetails] = React.useState("")
  const [contact, setContact] = React.useState(defaultContact ?? "")
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setReason("")
    setDetails("")
    setContact(defaultContact ?? "")
    setError(null)
    setSent(false)
  }, [open, defaultContact])

  const copyright = reason === "copyright"
  const ready = !!reason && (!copyright || (details.trim() && contact.trim()))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason || !ready) return
    setSending(true)
    setError(null)
    try {
      await reportClip({ clipId: clip.id, reason, details, contact })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "The report did not go through.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <>
            <DialogHeader>
              <DialogTitle>Report sent</DialogTitle>
              <DialogDescription>GovBlock reviews every report and takes down a clip that breaks the rules.{contact ? ` The answer goes to ${contact}.` : ""}</DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton />
          </>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Report “{clip.title}”</DialogTitle>
            </DialogHeader>
            <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
              {REASONS.map((r) => (
                <Label key={r.value} className="flex items-start gap-3 font-normal">
                  <RadioGroupItem value={r.value} className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{r.label}</span>
                    {r.hint && <span className="text-xs text-muted-foreground">{r.hint}</span>}
                  </span>
                </Label>
              ))}
            </RadioGroup>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder={copyright ? "The work, who owns it, and where it appears in the clip" : "Details (optional)"} aria-label="Details" className="min-h-20" />
            <Input type="email" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={copyright ? "Email address" : "Email address (optional)"} aria-label="Email address" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!ready || sending}>
                {sending ? "Sending…" : "Send report"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
