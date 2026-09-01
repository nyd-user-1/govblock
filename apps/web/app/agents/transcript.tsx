"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { runMeta, type RunState, type Step } from "@/lib/agents/run-client"

// How a run is shown: the tool calls it made, the prose it wrote, and what the
// exchange cost. Shared by the chat panel on /agents and the Agentic Inbox,
// because a run is the same thing in both and a second renderer would drift.

// The models write **bold**, *italic*, `code`, [label](url), and plain markdown
// headings, and the panel used to print the punctuation. This renders those and
// nothing else — not a markdown library, and deliberately not lists or tables,
// which would start dictating the shape of an answer.
const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(INLINE).map((piece, i) => {
        if (piece.startsWith("**") && piece.endsWith("**") && piece.length > 4)
          return <strong key={i}>{piece.slice(2, -2)}</strong>
        if (piece.startsWith("`") && piece.endsWith("`") && piece.length > 2)
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">
              {piece.slice(1, -1)}
            </code>
          )
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(piece)
        if (link)
          return (
            <a
              key={i}
              href={link[2]}
              className="underline underline-offset-4"
              target={link[2].startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
            >
              {/* A link's label is often bold too — render it, do not print it. */}
              <Inline text={link[1]} />
            </a>
          )
        if (piece.startsWith("*") && piece.endsWith("*") && piece.length > 2)
          return <em key={i}>{piece.slice(1, -1)}</em>
        return <React.Fragment key={i}>{piece}</React.Fragment>
      })}
    </>
  )
}

const HEADING = /^(#{1,4})\s+(.*)$/

export function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i, all) => {
        const end = i === all.length - 1 ? "" : "\n"
        const heading = HEADING.exec(line)
        if (heading)
          return (
            <React.Fragment key={i}>
              <strong className={heading[1].length <= 2 ? "text-base" : undefined}>
                <Inline text={heading[2]} />
              </strong>
              {end}
            </React.Fragment>
          )
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line))
          return <hr key={i} className="my-2 border-border" />
        return (
          <React.Fragment key={i}>
            <Inline text={line} />
            {end}
          </React.Fragment>
        )
      })}
    </>
  )
}

export function StepLine({ step }: { step: Step }) {
  if (step.kind === "note") return <div className="text-xs text-muted-foreground">{step.text}</div>
  const args = Object.entries((step.input ?? {}) as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ")
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
      <code className="rounded bg-muted px-1.5 py-0.5">{step.name}</code>
      {args && <span className="min-w-0 truncate text-muted-foreground">{args}</span>}
      {step.summary !== undefined ? (
        <span className={cn("tabular-nums", step.ok ? "text-muted-foreground" : "text-destructive")}>
          → {step.summary}
          {step.ms !== undefined ? ` · ${step.ms} ms` : ""}
        </span>
      ) : (
        <span className="text-muted-foreground">…</span>
      )}
    </div>
  )
}

export function RunSteps({ steps }: { steps: Step[] }) {
  if (!steps.length) return null
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed p-3">
      {steps.map((step, i) => (
        <StepLine key={i} step={step} />
      ))}
    </div>
  )
}

export function RunMeta({ run }: { run: RunState }) {
  if (!run.rounds) return null
  return <div className="text-xs text-muted-foreground tabular-nums">{runMeta(run)}</div>
}
