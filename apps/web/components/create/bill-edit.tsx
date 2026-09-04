"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import type { Bill } from "@/lib/policy/types"
import type { TextVersion } from "@/components/policy/bill-text-pane"
import { DiffView } from "@/components/policy/diff-view"
import { Button } from "@govblock/ui/components/nova/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@govblock/ui/components/nova/dialog"
import { NativeSelect, NativeSelectOption } from "@govblock/ui/components/nova/native-select"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { cn } from "@govblock/ui/lib/utils"

// GitHub's edit page, put to a bill (Brendan, 2026-09-03: "when you click
// edit let it be editable, same as github"). The file's name and `in main`
// across the top with Cancel changes and Commit changes… at the right; Edit
// | Preview at the left of the toolbar and GitHub's three selects — Spaces
// or Tabs, the indent size, No wrap or Soft wrap — at its right. Preview is
// the split diff of the draft against the version being edited, drawn by
// the same measured diff as Changes. Commit changes… opens GitHub's dialog:
// a message, an extended description, and the commit goes to the reader's
// fork — never to the legislature's own versions.

const CodeEditor = dynamic(() => import("@/components/policy/code-editor").then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => <Skeleton className="m-4 h-64 rounded-xl" />,
})

export function BillEdit({
  bill,
  base,
  baseText,
  onCancel,
  onCommit,
}: {
  bill: Bill
  /** The version being edited. */
  base: TextVersion
  /** Its text; null while it loads. */
  baseText: string | null
  onCancel: () => void
  onCommit: (commit: { message: string; description: string; text: string }) => void
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const text = draft ?? baseText ?? ""
  const dirty = draft !== null && draft !== baseText
  const [tab, setTab] = React.useState<"edit" | "preview">("edit")
  const [indent, setIndent] = React.useState<"spaces" | "tabs">("spaces")
  const [size, setSize] = React.useState<2 | 4 | 8>(2)
  const [wrap, setWrap] = React.useState(false)
  const [asking, setAsking] = React.useState(false)
  const [message, setMessage] = React.useState(`Update ${bill.bill_number}`)
  const [description, setDescription] = React.useState("")

  const cancel = () => {
    if (dirty && !window.confirm("Discard your changes to this bill?")) return
    onCancel()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The file's name, in main, and what to do with the changes. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
        <span className="rounded-md border bg-muted/40 px-3 py-1.5 font-mono text-sm">{bill.bill_number}</span>
        <span className="text-sm text-muted-foreground">in</span>
        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">your fork</span>
        <span className="ml-2 truncate text-sm text-muted-foreground">
          editing {base.version ?? "Original"}
          {"commit" in base && base.commit ? ` (your commit)` : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={cancel}>
            Cancel changes
          </Button>
          <Button size="sm" disabled={!dirty} className="bg-[#1f883d] text-white hover:bg-[#1a7f37]" onClick={() => setAsking(true)}>
            Commit changes…
          </Button>
        </div>
      </div>

      {/* Edit | Preview, and GitHub's three selects. */}
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {(["edit", "preview"] as const).map((t) => (
            <button key={t} type="button" data-active={tab === t} onClick={() => setTab(t)} className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm">
              {t === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <NativeSelect value={indent} onChange={(e) => setIndent(e.target.value as "spaces" | "tabs")} aria-label="Indent mode" className="h-8 text-xs">
            <NativeSelectOption value="spaces">Spaces</NativeSelectOption>
            <NativeSelectOption value="tabs">Tabs</NativeSelectOption>
          </NativeSelect>
          <NativeSelect value={String(size)} onChange={(e) => setSize(Number(e.target.value) as 2 | 4 | 8)} aria-label="Indent size" className="h-8 text-xs">
            {[2, 4, 8].map((n) => (
              <NativeSelectOption key={n} value={String(n)}>
                {n}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect value={wrap ? "soft" : "no"} onChange={(e) => setWrap(e.target.value === "soft")} aria-label="Line wrap mode" className="h-8 text-xs">
            <NativeSelectOption value="no">No wrap</NativeSelectOption>
            <NativeSelectOption value="soft">Soft wrap</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      <div className={cn("min-h-0 flex-1", tab === "preview" && "overflow-y-auto")}>
        {baseText === null ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
            ))}
          </div>
        ) : tab === "edit" ? (
          <CodeEditor initial={baseText} onChange={setDraft} indent={indent} size={size} wrap={wrap} />
        ) : dirty ? (
          <DiffView before={baseText} after={text} layout="split" anchor="edit-" />
        ) : (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">No changes yet. Edit the text, then preview what your commit would change.</p>
        )}
      </div>

      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Commit changes</DialogTitle>
            <DialogDescription>Your change becomes a commit in your fork of {bill.bill_number}. The legislature&apos;s versions are never altered.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Commit message</span>
              <input value={message} onChange={(e) => setMessage(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Extended description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add an optional extended description…" className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked readOnly className="accent-[#1f883d]" />
              Commit directly to <span className="rounded bg-primary/10 px-1.5 font-mono text-xs text-primary">your fork</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button
              disabled={!message.trim() || !dirty}
              className="bg-[#1f883d] text-white hover:bg-[#1a7f37]"
              onClick={() => {
                setAsking(false)
                onCommit({ message: message.trim(), description: description.trim(), text })
              }}
            >
              Commit changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
