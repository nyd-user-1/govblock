import * as React from "react"

import { CodeFigure } from "@/components/code-block"
import { PreviewFrame } from "@/components/preview-frame"
import { cn } from "@govblock/ui/lib/utils"

// Ported from livingston-v3 components/bill-text.tsx: the official form of a
// bill in the docs' component-preview frame — the title page rendered in the
// preview pane (headings centred, matter added underscored, matter removed
// struck), and the whole text as the code panel beneath, line-numbered.

type Segment = { kind: "plain" | "add" | "del"; text: string }
const MARKER = /\{\+([\s\S]*?)\+\}|\[-([\s\S]*?)-\]/g

function tokenize(text: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  for (const match of text.matchAll(MARKER)) {
    if (match.index! > last) segments.push({ kind: "plain", text: text.slice(last, match.index) })
    if (match[1] !== undefined) segments.push({ kind: "add", text: match[1] })
    else segments.push({ kind: "del", text: match[2]! })
    last = match.index! + match[0].length
  }
  if (last < text.length) segments.push({ kind: "plain", text: text.slice(last) })
  return segments
}

function toLines(segments: Segment[]): Segment[][] {
  const lines: Segment[][] = [[]]
  for (const segment of segments) {
    segment.text.split("\n").forEach((part, index) => {
      if (index > 0) lines.push([])
      if (part) lines[lines.length - 1]!.push({ kind: segment.kind, text: part })
    })
  }
  return lines
}

const NUMBERED = /^\s{0,8}\d{1,3}\s{2,}\S/
const HEADING = /^(STATE OF NEW YORK|IN SENATE|IN ASSEMBLY|SENATE - ASSEMBLY|IN THE HOUSE OF REPRESENTATIVES|IN THE SENATE OF THE UNITED STATES|A BILL|A RESOLUTION|RESOLUTION)$/
const CENTERED = /^(\d{1,6}(-[A-Za-z])?|[A-Z][a-z]+ \d{1,2}, \d{4}|[A-Z]+ \d{1,2}, \d{4}|_{4,40}|\(Prefiled\)|Cal\. No\. \d+|\d{3}[A-Z]{2} CONGRESS|\d[A-Z]{2} SESSION|H\. ?R\. \d+|H\. RES\. \d+|S\. \d+|S\. RES\. \d+|[IVX]+)$/

const plain = (line: Segment[]) => line.map((s) => s.text).join("")
const printed = (text: string) => text.replace(MARKER, (_, added, deleted) => (added !== undefined ? added : `[${deleted}]`))

function Page({ lines, headingEnd, gutter, columns, onlyHeading }: { lines: Segment[][]; headingEnd: number; gutter: number; columns: number; onlyHeading: boolean }) {
  const shown = onlyHeading ? lines.slice(0, headingEnd) : lines
  return (
    <pre data-slot="bill-text" className="w-full overflow-x-auto font-mono leading-relaxed whitespace-pre text-foreground" style={{ fontSize: `clamp(0.5rem, calc((100cqw - 2.5rem) / ${(columns * 0.6).toFixed(2)}), 0.9rem)` }}>
      <div className="mx-auto w-fit">
        {shown.map((line, index) => {
          const trimmed = plain(line).trim()
          const heading = index < headingEnd && HEADING.test(trimmed)
          const centered = index < headingEnd && (heading || CENTERED.test(trimmed))
          return (
            <div key={index} className={cn("min-h-[1lh]", centered && "text-center", heading && "font-bold")} style={centered ? { paddingInlineStart: `${gutter}ch` } : undefined}>
              {line.map((segment, position) => {
                const content = centered && position === 0 ? segment.text.trimStart() : segment.text
                if (segment.kind === "add") return <span key={position} className="text-green-700 underline decoration-green-700/70 decoration-1 underline-offset-[3px] dark:text-green-400 dark:decoration-green-400/70">{content}</span>
                if (segment.kind === "del") return <span key={position} className="text-red-600 line-through decoration-red-600/80 dark:text-red-400 dark:decoration-red-400/80">{content}</span>
                return <React.Fragment key={position}>{content}</React.Fragment>
              })}
            </div>
          )
        })}
      </div>
    </pre>
  )
}

export function BillText({ text, className }: { text: string; className?: string }) {
  const rawLines = text.replace(/\r/g, "").split("\n")
  const indent = Math.min(...rawLines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length))
  const dedented = rawLines.map((l) => (l.trim() ? l.slice(indent) : "")).join("\n")
  const lines = toLines(tokenize(dedented))
  const firstNumbered = lines.findIndex((line) => NUMBERED.test(plain(line)))
  const headingEnd = firstNumbered === -1 ? Math.min(lines.length, 24) : firstNumbered
  const columns = Math.max(...lines.map((line) => plain(line).length), 40)
  const gutter = Math.max(0, 8 - indent)
  const code = printed(dedented)
  return (
    <div className={cn("not-prose @container", className)}>
      <PreviewFrame
        align="center"
        previewClassName="h-auto min-h-72 @container"
        component={<Page lines={lines} headingEnd={headingEnd} gutter={gutter} columns={columns} onlyHeading />}
        source={<CodeFigure code={code} className="[&>pre]:max-h-96" />}
        sourcePreview={<CodeFigure code={code.split("\n").slice(0, 3).join("\n")} className="[&>pre]:max-h-96" />}
      />
    </div>
  )
}
