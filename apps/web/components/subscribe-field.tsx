"use client"

import * as React from "react"

import { Button } from "@govblock/ui/components/nova/button"
import { Input } from "@govblock/ui/components/input"

// The subscribe field, said once (2026-09-21): the footer's, and the lab card's (components/lab-gate.tsx). It posts
// to /api/subscribe, which keeps the address and what it asked to hear about and sends nothing yet.
export function SubscribeField({ id, label, topics }: { id: string; label: string; topics: string[] }) {
  const [email, setEmail] = React.useState("")
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "error">("idle")
  const [message, setMessage] = React.useState<string | null>(null)
  const subscribe = async (event: React.FormEvent) => {
    event.preventDefault()
    if (state === "busy") return
    setState("busy")
    try {
      const response = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, topics }) })
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? "That did not go through.")
      setState("done")
      setMessage(`${email} is on the list.`)
      setEmail("")
    } catch (error) {
      setState("error")
      setMessage(error instanceof Error ? error.message : "That did not go through.")
    }
  }
  return (
    <form onSubmit={subscribe} className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <Input id={id} type="email" required autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background" />
        <Button type="submit" disabled={state === "busy"}>
          Subscribe
        </Button>
      </div>
      {message && (
        <p role="status" className={state === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message}
        </p>
      )}
    </form>
  )
}
