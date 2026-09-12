"use client"

import * as React from "react"

import { CardHead, CardShell, type CardBodyProps } from "@/components/cards/card-shell"
import { Button } from "@govblock/ui/components/button"
import { CardContent, CardFooter } from "@govblock/ui/components/card"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@govblock/ui/components/field"
import { Input } from "@govblock/ui/components/input"

// Subscribe — what to hear about, and one button that becomes the address
// field when pressed; Enter sends it (Brendan, 2026-09-07). The card posts
// { email, topics, …extra } to `endpoint` and expects { ok } back; hand it
// `onSubscribe` instead to send it anywhere.
export type Topic = { id: string; label: string; description: string; defaultChecked?: boolean }

export const DEFAULT_TOPICS: Topic[] = [
  { id: "bills", label: "Bill alerts", description: "Get amendment, status, and votes updates.", defaultChecked: true },
  { id: "committees", label: "Committee alerts", description: "Get agenda, hearing, and vote updates.", defaultChecked: true },
  { id: "members", label: "Member alerts", description: "Get Member-specific updates.", defaultChecked: true },
  { id: "votes", label: "Vote alerts", description: "Get itemized vote results.", defaultChecked: false },
]

export function SubscribeCardBody({
  topics = DEFAULT_TOPICS,
  endpoint = "/api/subscribe",
  extra,
  onSubscribe,
  title = "Subscribe",
  action,
}: CardBodyProps & { topics?: Topic[]; endpoint?: string; /** Anything else to send with the address — the jurisdiction, a list id. */ extra?: Record<string, unknown>; onSubscribe?: (email: string, topics: string[]) => Promise<void> }) {
  const [checked, setChecked] = React.useState<Record<string, boolean>>(Object.fromEntries(topics.map((n) => [n.id, !!n.defaultChecked])))
  const [mode, setMode] = React.useState<"button" | "input" | "busy" | "done" | "error">("button")
  const [email, setEmail] = React.useState("")
  const [message, setMessage] = React.useState<string | null>(null)
  const input = React.useRef<HTMLInputElement>(null)
  const allChecked = topics.every((n) => checked[n.id])
  const someChecked = topics.some((n) => checked[n.id]) && !allChecked

  React.useEffect(() => {
    if (mode === "input") input.current?.focus()
  }, [mode])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!email.trim()) return
    setMode("busy")
    const picked = topics.filter((n) => checked[n.id]).map((n) => n.id)
    try {
      if (onSubscribe) await onSubscribe(email.trim(), picked)
      else {
        const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, topics: picked, ...extra }) })
        const data = (await res.json()) as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not subscribe.")
      }
      setMode("done")
      setMessage(`Subscribed ${email.trim()}.`)
    } catch (error) {
      setMode("input")
      setMessage(error instanceof Error ? error.message : "Could not subscribe.")
    }
  }

  return (
    <form onSubmit={submit}>
      <CardHead title={title} action={action} />
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
            <Checkbox id="notify-all" checked={allChecked} indeterminate={someChecked} onCheckedChange={(v) => setChecked(Object.fromEntries(topics.map((n) => [n.id, !!v])))} />
            <FieldContent>
              <FieldLabel htmlFor="notify-all">Select all</FieldLabel>
            </FieldContent>
          </Field>
          {topics.map((n) => (
            <Field key={n.id} orientation="horizontal">
              <Checkbox id={`notify-${n.id}`} checked={checked[n.id]} onCheckedChange={(v) => setChecked((prev) => ({ ...prev, [n.id]: !!v }))} />
              <FieldContent>
                <FieldLabel htmlFor={`notify-${n.id}`}>{n.label}</FieldLabel>
                <FieldDescription>{n.description}</FieldDescription>
              </FieldContent>
            </Field>
          ))}
        </FieldGroup>
      </CardContent>
      <CardFooter className="mt-4 flex-col items-stretch gap-2">
        {mode === "button" ? (
          <Button type="button" className="w-full" onClick={() => setMode("input")}>
            Subscribe
          </Button>
        ) : mode === "done" ? (
          <Button type="button" className="w-full" disabled>
            Subscribed
          </Button>
        ) : (
          // The button's place, as an address field: type, then Enter.
          <Input
            ref={input}
            type="email"
            name="email"
            placeholder="m@example.com, then Enter"
            aria-label="Email"
            required
            value={email}
            disabled={mode === "busy"}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !email) setMode("button")
            }}
            className="h-9 w-full rounded-full text-center"
          />
        )}
        {message && <p className={mode === "done" ? "text-center text-xs text-muted-foreground" : "text-center text-xs text-destructive"}>{message}</p>}
      </CardFooter>
    </form>
  )
}

export function SubscribeCard(props: React.ComponentProps<typeof SubscribeCardBody>) {
  return (
    <CardShell>
      <SubscribeCardBody {...props} />
    </CardShell>
  )
}
