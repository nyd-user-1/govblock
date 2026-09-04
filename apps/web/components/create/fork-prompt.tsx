"use client"

import * as React from "react"
import { GitForkIcon } from "lucide-react"

import { createFork } from "@/lib/policy/forks"
import type { Bill } from "@/lib/policy/types"
import { Button } from "@govblock/ui/components/nova/button"

// GitHub's page when you press Edit on a repository you cannot write to
// (Brendan, 2026-09-03, screenshot): "You need to fork this repository to
// propose changes." Put to a bill. The public owns the legislature; its
// versions are never edited in place. Fork the bill, then edit in the fork.

export function ForkPrompt({ bill, state, session, onForked }: { bill: Bill; state: string; session: number | null; onForked: (forkId: number) => void }) {
  const [busy, setBusy] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-start gap-3 px-6 pt-20 text-center">
      <GitForkIcon className="size-8 text-muted-foreground" />
      <h2 className="text-2xl font-semibold">You need to fork this bill to propose changes.</h2>
      <p className="max-w-2xl text-muted-foreground">Sorry, you&apos;re not able to edit {bill.bill_number} directly. The legislature&apos;s versions stay as they are on the record. Fork it and propose your changes from there instead.</p>
      <Button
        disabled={busy}
        className="mt-2 bg-[#1f883d] text-white hover:bg-[#1a7f37]"
        onClick={async () => {
          setBusy(true)
          setFailed(false)
          const fork = await createFork({ state, session_id: session, bill_id: bill.bill_id, bill_number: bill.bill_number, title: bill.title })
          setBusy(false)
          if (fork) onForked(fork.id)
          else setFailed(true)
        }}
      >
        {busy ? "Forking…" : "Fork this bill"}
      </Button>
      {failed && <p className="text-sm text-destructive">The fork could not be made. Try again in a moment.</p>}
      <p className="text-sm text-primary">A fork is your own copy: the bill&apos;s versions as the base, your commits on top.</p>
    </div>
  )
}
