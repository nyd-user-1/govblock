"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"

// shadcn's file block — the titled code figure with line numbers, the copy
// button, and Expand over a collapsed body — first built for a member's staff
// on 2026-09-05, now one component so a bill's text wears the same figure.
//
// The caption is the glyph, the file name and the controls: whatever the
// caller hands in at the right (a Versions menu), then Expand, a rule, and
// Copy. The body is numbered `lines` or, for a document that lays itself out,
// any children.

export function FileBlock({
  icon,
  title,
  lines,
  children,
  text,
  menu,
  collapsed = "data-[state=closed]:max-h-64",
  limit,
  className,
}: {
  /** What sits where shadcn puts the file-type glyph: a chamber seal. */
  icon?: React.ReactNode
  /** The file name, in mono: `staff/adams.csv`, `hb6500/enrolled-bill.txt`. */
  title: React.ReactNode
  /** Numbered lines, each rendered in a gutter-and-line grid. */
  lines?: string[]
  /** A body that lays itself out, instead of `lines`. */
  children?: React.ReactNode
  /** What the copy button puts on the clipboard. */
  text: () => string
  /** A control at the caption's right, before Expand. */
  menu?: React.ReactNode
  /** How tall the figure stands until expanded — a whole class, so Tailwind
      sees it: `data-[state=closed]:max-h-64`. */
  collapsed?: string
  /** A body that never shows whole: `closed` pixels until expanded, then
      `open` pixels with the rest scrolling inside — the subject chips
      (Brendan, 2026-09-05: "double in size and scroll within the container"). */
  limit?: { closed: number; open: number } | null
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  // Expand only when there is something to expand: a two-paragraph summary
  // shows whole, a forty-page bill shows its first screen.
  const root = React.useRef<HTMLDivElement>(null)
  const body = React.useRef<HTMLDivElement>(null)
  const [tall, setTall] = React.useState(true)
  React.useEffect(() => {
    if (open) return
    if (limit) {
      const el = body.current
      if (el) setTall(el.scrollHeight > limit.closed + 1)
      return
    }
    const el = root.current
    if (el) setTall(el.scrollHeight > el.clientHeight + 1)
  }, [children, lines, open, limit])
  const closed = !open && tall
  const bodyStyle: React.CSSProperties | undefined = limit
    ? open
      ? { maxHeight: limit.open, overflowY: "auto" }
      : { maxHeight: limit.closed, overflowY: "hidden" }
    : undefined

  async function copy() {
    await navigator.clipboard.writeText(text())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      ref={root}
      data-state={closed ? "closed" : "open"}
      className={cn(
        "not-typeset group/collapsible relative mt-6 mb-12 overflow-hidden rounded-xl border border-border/50 bg-surface text-surface-foreground",
        !limit && collapsed,
        className
      )}
    >
      <figure className="m-0">
        <figcaption className="flex items-center gap-2 border-b border-border/50 py-2 pr-2 pl-4 font-mono text-sm text-foreground [&_svg]:size-4 [&_svg]:opacity-70">
          {icon}
          <span className="min-w-0 truncate">{title}</span>
          <div className="ml-auto flex items-center gap-1 text-muted-foreground">
            {menu}
            {(tall || open) && (
              <>
                <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-md px-2 py-1 text-sm hover:text-foreground">
                  {open ? "Collapse" : "Expand"}
                </button>
                <span className="h-4 w-px bg-border" />
              </>
            )}
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Copied" : "Copy"}
              className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground [&_svg]:size-4"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        </figcaption>
        {lines ? (
          <pre className="no-scrollbar m-0 min-w-0 overflow-x-auto bg-transparent px-4 py-3.5 font-mono text-sm leading-relaxed">
            <code className="grid">
              {lines.map((line, i) => (
                <span key={i} className="grid grid-cols-[2ch_1fr] gap-4">
                  <span className="text-right text-muted-foreground select-none">{i + 1}</span>
                  <span className="whitespace-pre">{line}</span>
                </span>
              ))}
            </code>
          </pre>
        ) : (
          <div className="min-w-0 px-4 py-3.5">
            <div ref={body} className="no-scrollbar min-w-0 overflow-x-auto" style={bodyStyle}>
              {children}
            </div>
          </div>
        )}
      </figure>
      {closed && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute inset-x-0 -bottom-2 flex h-20 items-center justify-center rounded-b-lg bg-gradient-to-b from-surface/70 to-surface text-sm text-muted-foreground"
        >
          Expand
        </button>
      )}
    </div>
  )
}
