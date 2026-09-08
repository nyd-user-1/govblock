"use client"

import * as React from "react"
import { DownloadIcon, InboxIcon, MailIcon, Trash2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { formById, type FormId } from "@/lib/forms/programs"
import { forgetEverything, valuesFor, type Values } from "@/lib/forms/profile"
import { attachmentMeta } from "@/lib/agents/report-pdf"
import type { FillResult } from "@/lib/chat/form-tools"
import type { Filled } from "@/lib/forms/fill"
import { Button } from "@govblock/ui/components/nova/button"
import { Input } from "@govblock/ui/components/nova/input"
import { Label } from "@govblock/ui/components/nova/label"

// Where the filled form goes: the file, an email, the inbox.
//
// The fill runs here, in the browser, from the profile, when the model calls
// fill_form; the model gets back a receipt (filename, pages, fields filled)
// and this card keeps the bytes. Email is livingston's FormDelivery: to
// yourself, or to a county address with a copy to yourself — sending on
// someone's behalf always leaves them holding a record. Nothing is filed by
// any of this; the card says so.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function build(form: FormId) {
  const [{ fillForm }, spec] = await Promise.all([import("@/lib/forms/fill"), specFor(form)])
  return fillForm(spec, valuesFor(form))
}

export async function specFor(form: FormId) {
  return form === "ldss-2921" ? (await import("@/lib/forms/specs/ldss-2921")).LDSS_2921_SPEC : (await import("@/lib/forms/specs/ocfs-6025")).OCFS_6025_SPEC
}

function toBase64(bytes: Uint8Array) {
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function DeliveryCard({
  form,
  answered,
  compact,
  onSubmit,
  onSaveToInbox,
}: {
  form: FormId
  /** The receipt already returned, when the widget is re-rendered from a saved run: the file is built again on request. */
  answered?: FillResult
  compact?: boolean
  onSubmit: (result: FillResult) => void
  /** Provided by the chat: writes a delivered thread with the values used. */
  onSaveToInbox?: (built: Filled, values: Values) => string | undefined
}) {
  const program = formById(form)
  const [built, setBuilt] = React.useState<Filled | null>(null)
  const [values, setValues] = React.useState<Values | null>(null)
  const [url, setUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [mode, setMode] = React.useState<null | "self" | "county">(null)
  const [to, setTo] = React.useState("")
  const [county, setCounty] = React.useState("")
  const [sent, setSent] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState<string | null>(null)
  const [forgot, setForgot] = React.useState(false)
  const reported = React.useRef(Boolean(answered))

  const make = React.useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const snapshot = valuesFor(form)
      const out = await build(form)
      setBuilt(out)
      setValues(snapshot)
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(out.blob)
      })
      if (!reported.current) {
        reported.current = true
        onSubmit({ ok: true, filename: out.filename, pages: out.pages, bytes: out.bytes.length, filled: out.filled, unmapped: out.unmapped })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
      if (!reported.current) {
        reported.current = true
        onSubmit({ ok: false, error: message })
      }
    } finally {
      setBusy(false)
    }
  }, [form, onSubmit])

  // Built once, when the model asks; a widget restored from a saved run
  // builds again on request rather than on sight.
  React.useEffect(() => {
    if (!answered) void make()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async (which: "self" | "county") => {
    if (!built) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/forms/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: which === "self" ? to.trim() : county.trim(),
          cc: which === "county" ? to.trim() : undefined,
          county: which === "county" ? values?.["address.county"] : undefined,
          code: program?.code,
          filename: built.filename,
          pdf: toBase64(built.bytes),
        }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string; id?: string; to?: string }
      if (!response.ok) throw new Error(data.error ?? `Send failed (${response.status})`)
      setSent(which === "self" ? `Sent to ${data.to ?? to.trim()}.` : `Sent to ${data.to ?? county.trim()}, with a copy to ${to.trim()}.`)
      setMode(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const meta = built ? attachmentMeta({ pages: built.pages, bytes: built.bytes.length }) : answered?.pages && answered.bytes ? attachmentMeta({ pages: answered.pages, bytes: answered.bytes }) : null
  const filled = built?.filled ?? answered?.filled
  const filename = built?.filename ?? answered?.filename ?? `${program?.code ?? "form"}.pdf`

  return (
    <div data-slot="delivery-card" className="rounded-lg border bg-card p-3 text-sm">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{filename}</span>
        <span className="text-muted-foreground">
          {[meta, filled !== undefined ? `${filled} fields filled` : null].filter(Boolean).join(" · ")}
          {!meta && !built && !busy && " Not built yet."}
        </span>
      </div>
      <p className="mt-1.5 text-muted-foreground">A draft to read before filing. Nothing has been sent to any agency.</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {url && built ? (
          <Button size="sm" variant="outline" render={<a href={url} download={built.filename} />}>
            <DownloadIcon /> Download
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => void make()} disabled={busy}>
            <DownloadIcon /> {busy ? "Building…" : "Build again"}
          </Button>
        )}
        <Button size="sm" variant={mode === "self" ? "default" : "outline"} disabled={!built} onClick={() => setMode(mode === "self" ? null : "self")}>
          <MailIcon /> Email
        </Button>
        <Button size="sm" variant={mode === "county" ? "default" : "outline"} disabled={!built} onClick={() => setMode(mode === "county" ? null : "county")}>
          <MailIcon /> Send to the county
        </Button>
        {onSaveToInbox && (
          <Button
            size="sm"
            variant="outline"
            disabled={!built || !values || Boolean(saved)}
            onClick={() => {
              if (!built || !values) return
              const id = onSaveToInbox(built, values)
              if (id) setSaved(id)
            }}
          >
            <InboxIcon /> {saved ? "In the inbox" : "Save to inbox"}
          </Button>
        )}
      </div>

      {mode && (
        <div className={cn("mt-3 grid gap-2", !compact && mode === "county" && "sm:grid-cols-2")}>
          {mode === "county" && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <p className="text-muted-foreground">This emails the draft to the county office and copies you. Most New York districts still require a signed original, so it puts the paperwork in front of a caseworker; it does not file the application.</p>
            </div>
          )}
          {mode === "county" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${form}-county`}>County office email</Label>
              <Input id={`${form}-county`} type="email" value={county} onChange={(e) => setCounty(e.target.value)} placeholder="dss@county.gov" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${form}-to`}>{mode === "self" ? "Your email" : "Your email, for the copy"}</Label>
            <Input id={`${form}-to`} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Button size="sm" disabled={busy || !EMAIL.test(to.trim()) || (mode === "county" && !EMAIL.test(county.trim()))} onClick={() => void send(mode)}>
              {busy ? "Sending…" : mode === "self" ? "Send it to me" : "Send on my behalf"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {sent && <p className="mt-2 text-foreground">{sent}</p>}
      {error && <p className="mt-2 text-destructive">{error}</p>}

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2 text-muted-foreground">
        <span>The answers stay in this browser.</span>
        <Button
          size="xs"
          variant="ghost"
          className="text-muted-foreground"
          disabled={forgot}
          onClick={() => {
            forgetEverything()
            setForgot(true)
          }}
        >
          <Trash2Icon /> {forgot ? "Forgotten" : "Forget everything"}
        </Button>
      </div>
    </div>
  )
}
