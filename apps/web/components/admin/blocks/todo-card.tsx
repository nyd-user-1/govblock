"use client"

import * as React from "react"
import { ChevronRightIcon } from "lucide-react"

import { TODO, type TodoItem } from "@/lib/xml/todo"
import { CardAnchor } from "@/components/admin/blocks/card-tools"
import { CopyButton } from "@/components/copy-button"
import { Card, CardContent, CardHeader } from "@govblock/ui/components/nova/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@govblock/ui/components/ny4/collapsible"
import { cn } from "@govblock/ui/lib/utils"

// The program's To Do (Brendan, 2026-09-14), in hq's shape: one accordion
// row per item, the prompt beneath in a mono field with a copy button that
// shows on hover. The rows are lib/xml/todo.ts; a window claims one by
// editing that file, so the card is a reading of the branch, not a store.

const STATUS: Record<TodoItem["status"], { dot: string; label: string }> = {
  open: { dot: "border-border", label: "open" },
  claimed: { dot: "border-amber-500 bg-amber-500/20", label: "claimed" },
  done: { dot: "border-green-600 bg-green-600/30", label: "done" },
}

function TodoRow({ item, index }: { item: TodoItem; index: number }) {
  const [open, setOpen] = React.useState(false)
  const status = STATUS[item.status]
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border bg-card">
      <CollapsibleTrigger className="group/row flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left">
        <span aria-label={status.label} title={status.label} className={cn("size-4 shrink-0 rounded-[3px] border", status.dot)} />
        <ChevronRightIcon className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{index}.</span>
        <span className={cn("min-w-0 flex-1 text-sm", item.status === "done" && "text-muted-foreground line-through")}>{item.title}</span>
        {item.claimedBy && <span className="shrink-0 rounded bg-amber-500/15 px-1.5 font-mono text-[10px] text-amber-700 dark:text-amber-300">{item.claimedBy}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="group/body relative border-t px-3.5 py-3">
          <CopyButton value={item.prompt} className="absolute top-2 right-2 opacity-0 transition group-hover/body:opacity-100" />
          <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/90">{item.prompt}</pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function TodoCard({ className }: { className?: string }) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardAnchor>To Do</CardAnchor>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {TODO.map((item, i) => (
          <TodoRow key={item.id} item={item} index={i + 1} />
        ))}
      </CardContent>
    </Card>
  )
}
