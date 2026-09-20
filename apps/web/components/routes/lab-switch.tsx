"use client"

import * as React from "react"

import { Switch } from "@govblock/ui/components/ny4/switch"

// A route's switch on /routes (Brendan, 2026-09-20): on is published, off is
// the lab. It writes lib/lab-routes.json through /api/routes/lab, and a
// refusal puts the switch back where it was.
export function LabSwitch({ path, lab, disabled }: { path: string; lab: boolean; disabled?: boolean }) {
  const [published, setPublished] = React.useState(!lab)
  const [busy, setBusy] = React.useState(false)
  const move = async (next: boolean) => {
    setPublished(next)
    setBusy(true)
    const ok = await fetch("/api/routes/lab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, lab: !next }) })
      .then((r) => r.ok)
      .catch(() => false)
    if (!ok) setPublished(!next)
    setBusy(false)
  }
  return <Switch size="sm" checked={published} disabled={disabled || busy} onCheckedChange={move} aria-label={`${path}: ${published ? "published" : "in the lab"}`} />
}
