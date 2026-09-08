"use client"

import * as React from "react"

import { Prose } from "@/app/agents/transcript"
import type { Step } from "@/lib/agents/run-client"
import { args, sourceOf, stagesOf } from "@/lib/agents/trace-steps"
import { cn } from "@/lib/utils"

// A Trace Report, drawn from the run that produced it.
//
// Every other format is markdown and the reading pane renders it as markdown.
// This one is not a document the agent writes about its work; it is the work,
// laid out — which is why nothing here is parsed out of a finished report. The
// stages are the run's own tool calls, in the order they were made, and the
// prose between them is what the Clerk wrote in the round after each one. The
// shape is ported from the worked example at /reports/open-primaries-trace.html:
// a source paired with the Clerk, what the source returned, the reasoning over
// it, then what the stage established, and a synthesis at the end.
//
// The pairing is the point. A tool retrieves and cannot think; the Clerk thinks
// and cannot retrieve. Showing them as one step each, together, is the honest
// picture of how the answer was reached — and it is checkable, because the
// summary in each disclosure is what the call actually returned.

function Pile({ marks }: { marks: { mark: string; tone: string }[] }) {
  return (
    <span className="inline-flex">
      {marks.map((entry, i) => (
        <span
          key={i}
          className={cn(
            "-ml-2 inline-flex size-6 items-center justify-center rounded-full border-2 border-background text-[9px] font-bold text-white first:ml-0",
            entry.tone
          )}
        >
          {entry.mark}
        </span>
      ))}
    </span>
  )
}

const CLERK = { mark: "C", tone: "bg-amber-600" }

export function TraceReport({ steps, body, running }: { steps: Step[]; body: string; running?: boolean }) {
  const { opening, stages, report } = React.useMemo(() => stagesOf(steps, body), [steps, body])
  if (!stages.length) return <Prose text={body} />

  return (
    <div className="flex flex-col gap-3">
      {opening && <p className="text-sm text-muted-foreground">{opening}</p>}

      <div>
        {stages.map((stage, index) => {
          const sources = stage.tools.map((tool) => sourceOf(tool.name))
          const distinct = sources.filter((source, i) => sources.findIndex((s) => s.label === source.label) === i)
          const open = stage.tools.some((tool) => tool.summary === undefined)
          return (
            <div
              key={index}
              className={cn(
                "relative ml-3 border-l-2 pb-6 pl-8",
                index === stages.length - 1 ? "border-transparent" : "border-border"
              )}
            >
              <span className="bg-background text-muted-foreground absolute -left-3.5 top-0 flex size-6 items-center justify-center rounded-full border-2 text-xs tabular-nums">
                {index + 1}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <Pile marks={[...distinct, CLERK]} />
                <span className="text-sm font-medium">
                  {distinct.map((source) => source.label).join(", ")}
                  <span className="text-muted-foreground px-1.5 font-normal">×</span>
                  Clerk
                </span>
              </div>

              <details open={open} className="bg-muted/50 mt-2 rounded-lg border px-3 py-2">
                <summary className="text-muted-foreground cursor-pointer text-xs">
                  What {distinct.length === 1 ? distinct[0].label.toLowerCase() : "the sources"} returned
                </summary>
                <div className="flex flex-col gap-1.5 pt-2">
                  {stage.tools.map((tool) => (
                    <div key={tool.id} className="font-mono text-xs">
                      <span className="bg-background rounded px-1.5 py-0.5">{tool.name}</span>{" "}
                      <span className="text-muted-foreground">{args(tool.input)}</span>
                      {tool.summary !== undefined ? (
                        <div className={cn("pt-0.5", tool.ok ? "text-muted-foreground" : "text-destructive")}>
                          → {tool.summary}
                          {tool.ms !== undefined ? ` · ${tool.ms} ms` : ""}
                        </div>
                      ) : (
                        <span className="text-muted-foreground"> …</span>
                      )}
                    </div>
                  ))}
                </div>
              </details>

              {stage.reasoning && (
                <details className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/30">
                  <summary className="cursor-pointer text-xs text-amber-700 dark:text-amber-500">Reasoning</summary>
                  <div className="pt-2 text-sm whitespace-pre-wrap text-amber-900 dark:text-amber-200/90">
                    <Prose text={stage.reasoning} />
                  </div>
                </details>
              )}

              {stage.output && (
                <div className="bg-card mt-2 rounded-lg border px-3 py-2.5 text-sm whitespace-pre-wrap">
                  <Prose text={stage.output} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {report && (
        <div className="bg-card rounded-lg border-2 p-4 text-sm whitespace-pre-wrap">
          <Prose text={report} />
        </div>
      )}

      {running && !report && (
        <p className="text-muted-foreground text-sm">Gathering.</p>
      )}
    </div>
  )
}
