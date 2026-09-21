"use client"

import * as React from "react"
import { ChevronRightIcon } from "lucide-react"

import { LESSONS, type RunLesson } from "@/lib/pipeline/lessons"
import { CardAnchor } from "@/components/admin/blocks/card-tools"
import { Card, CardContent, CardHeader } from "@govblock/ui/components/nova/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@govblock/ui/components/ny4/collapsible"
import { cn } from "@govblock/ui/lib/utils"

// What each run taught (Brendan, 2026-09-20: "document the lessons learned on the
// database dashboard underneath the todo list module"). To Do's shape: a row a
// run, newest first, its numbers and its lessons beneath. The rows are
// lib/pipeline/lessons.ts, written after a run from what Aurora then held.

const OUTCOME: Record<RunLesson["outcome"], { dot: string; label: string }> = {
  clean: { dot: "border-green-600 bg-green-600/30", label: "clean" },
  partial: { dot: "border-amber-500 bg-amber-500/20", label: "partial" },
  failed: { dot: "border-red-600 bg-red-600/30", label: "failed" },
}

function LessonRow({ run }: { run: RunLesson }) {
  const [open, setOpen] = React.useState(false)
  const outcome = OUTCOME[run.outcome]
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border bg-card">
      <CollapsibleTrigger className="group/row flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left">
        <span aria-label={outcome.label} title={outcome.label} className={cn("size-4 shrink-0 rounded-[3px] border", outcome.dot)} />
        <ChevronRightIcon className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="min-w-0 flex-1 truncate text-sm">{run.title}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{run.headline}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{run.when}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 border-t px-3.5 py-3">
          <pre className="m-0 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{run.ran.join("\n")}</pre>
          {run.result.length > 0 && (
            <table className="w-full text-sm tabular-nums">
              <tbody>
                {run.result.map((r) => (
                  <tr key={r.label} className="border-t first:border-t-0">
                    <td className="py-1 pr-3 text-muted-foreground">{r.label}</td>
                    <td className="py-1 pr-3 text-right">{r.before}</td>
                    <td className="py-1 pr-3 text-right font-medium">{r.after}</td>
                    <td className={cn("py-1 text-right", r.diff?.startsWith("+") ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>{r.diff ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed">
            {run.lessons.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function LessonsCard({ className }: { className?: string }) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardAnchor>Lessons Learned</CardAnchor>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {LESSONS.map((run) => (
          <LessonRow key={run.id} run={run} />
        ))}
      </CardContent>
    </Card>
  )
}
