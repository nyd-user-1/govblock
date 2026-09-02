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
const INLINE =
  /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|<u>[^<\n]+<\/u>|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(INLINE).map((piece, i) => {
        if (piece.startsWith("**") && piece.endsWith("**") && piece.length > 4)
          return <strong key={i}>{piece.slice(2, -2)}</strong>
        if (piece.startsWith("~~") && piece.endsWith("~~") && piece.length > 4)
          return <s key={i}>{piece.slice(2, -2)}</s>
        // The composer has an underline button because Gmail does, and markdown
        // has no underline, so it travels as the HTML it is.
        if (piece.startsWith("<u>") && piece.endsWith("</u>"))
          return <u key={i}>{piece.slice(3, -4)}</u>
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

const ROW = /^\s*\|(.+)\|\s*$/
const DIVIDER = /^\s*\|[\s:|-]+\|\s*$/

function cells(line: string) {
  return (ROW.exec(line)?.[1] ?? "").split("|").map((cell) => cell.trim())
}

/** A pipe table, drawn. The agents write them when there really are columns. */
function Table({ lines }: { lines: string[] }) {
  const [head, ...body] = lines.filter((line) => !DIVIDER.test(line))
  return (
    <span className="my-2 block overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            {cells(head ?? "").map((cell, i) => (
              <th key={i} className="py-1.5 pr-4 font-medium">
                <Inline text={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="border-b border-border/50 last:border-0">
              {cells(row).map((cell, c) => (
                <td key={c} className="py-1.5 pr-4 align-top">
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </span>
  )
}

export function Prose({ text }: { text: string }) {
  // Pull whole tables out first: they are the one shape that spans lines, and
  // a line-at-a-time renderer would draw their pipes.
  const source = text.split("\n")
  const blocks: { table?: string[]; from: number }[] = []
  for (let i = 0; i < source.length; i += 1) {
    if (!ROW.test(source[i] ?? "")) continue
    let end = i
    while (end + 1 < source.length && ROW.test(source[end + 1] ?? "")) end += 1
    // Two rows and a divider is the least that is meaningfully a table.
    if (end - i >= 2 && source.slice(i, end + 1).some((line) => DIVIDER.test(line))) {
      blocks.push({ table: source.slice(i, end + 1), from: i })
      i = end
    }
  }
  const tableAt = new Map(blocks.map((block) => [block.from, block.table!]))
  const inTable = new Set(blocks.flatMap((block) => block.table!.map((_, n) => block.from + n)))

  return (
    <>
      {source.map((line, i, all) => {
        if (tableAt.has(i)) return <Table key={i} lines={tableAt.get(i)!} />
        if (inTable.has(i)) return null
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
        // Lists are drawn now that the reader writes them too — the composer
        // serialises "- item" and "1. item", and printing the punctuation back
        // at them would be the same failure as printing the asterisks. The rule
        // against lists was always about the agents' prompts, which still ask
        // for plain prose; this is only about not lying about what was written.
        const quote = /^\s*>\s?(.*)$/.exec(line)
        if (quote)
          return (
            <React.Fragment key={i}>
              <span className="block border-l-2 border-border pl-3 text-muted-foreground">
                <Inline text={quote[1]} />
              </span>
              {end}
            </React.Fragment>
          )
        const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line)
        const numbered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line)
        if (bullet || numbered) {
          const indent = (bullet ? bullet[1] : numbered![1]).length
          const marker = bullet ? "•" : `${numbered![2]}.`
          const body = bullet ? bullet[2] : numbered![3]
          return (
            <React.Fragment key={i}>
              <span className="flex gap-2" style={{ paddingLeft: `${indent * 0.5 + 0.75}rem` }}>
                <span className="shrink-0 text-muted-foreground tabular-nums">{marker}</span>
                <span className="min-w-0">
                  <Inline text={body} />
                </span>
              </span>
              {end}
            </React.Fragment>
          )
        }
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
