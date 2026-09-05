"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

// The docs' help text for a command — `Usage: shadcn init [options]`, a line
// on what it does, then Arguments and Options in two aligned columns — in
// the docs' code figure with the copy button top right. The subjects page's
// command line wears it for the record's own query (Brendan, 2026-09-05).

export type UsageSpec = {
  usage: string
  summary: string
  arguments?: [string, string][]
  options?: [string, string][]
}

const pad = (rows: [string, string][]) => Math.max(...rows.map(([name]) => name.length)) + 2

/** `--subject <term>`: the flag in one colour, its placeholder in another, as the docs colour them. */
function Flag({ text }: { text: string }) {
  const parts = text.split(/(<[^>]+>|\[[^\]]+\])/g)
  return (
    <>
      {parts.map((part, i) =>
        /^<[^>]+>$/.test(part) ? (
          <span key={i} className="text-red-700 dark:text-red-400">
            {part}
          </span>
        ) : /^\[[^\]]+\]$/.test(part) ? (
          <span key={i} className="text-foreground">
            {part}
          </span>
        ) : (
          <span key={i} className="text-blue-700 dark:text-blue-400">
            {part}
          </span>
        )
      )}
    </>
  )
}

export function UsageBlock({ spec }: { spec: UsageSpec }) {
  const [copied, setCopied] = React.useState(false)
  const args = spec.arguments ?? []
  const options = spec.options ?? []
  const width = Math.max(args.length ? pad(args) : 0, options.length ? pad(options) : 0, 24)
  const plain = [
    `Usage: ${spec.usage}`,
    "",
    spec.summary,
    ...(args.length ? ["", "Arguments:", ...args.map(([name, text]) => `  ${name.padEnd(width)}${text}`)] : []),
    ...(options.length ? ["", "Options:", ...options.map(([name, text]) => `  ${name.padEnd(width)}${text}`)] : []),
  ].join("\n")

  async function copy() {
    await navigator.clipboard.writeText(plain)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const row = ([name, text]: [string, string], i: number) => (
    <span key={i} className="grid grid-cols-[var(--col)_1fr] gap-x-2">
      <span className="whitespace-pre">
        {"  "}
        <Flag text={name} />
      </span>
      <span className="text-foreground">{text}</span>
    </span>
  )

  return (
    <figure data-rehype-pretty-code-figure="" data-not-typeset="" className="m-0 mt-6 mb-12">
      <button
        type="button"
        data-slot="copy-button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy"}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-sm opacity-70 transition-all hover:bg-accent hover:text-accent-foreground hover:opacity-100 [&_svg]:size-4"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <pre className="no-scrollbar m-0 min-w-0 overflow-x-auto bg-transparent px-4 py-3.5 pr-12 font-mono text-sm leading-relaxed" style={{ "--col": `${width}ch` } as React.CSSProperties}>
        <code className="grid gap-y-0.5">
          <span>
            <span className="text-amber-800 dark:text-amber-300">Usage:</span> <span className="text-blue-700 dark:text-blue-400">{spec.usage}</span>
          </span>
          <span> </span>
          <span className="text-foreground">{spec.summary}</span>
          {args.length > 0 && (
            <>
              <span> </span>
              <span className="text-amber-800 dark:text-amber-300">Arguments:</span>
              {args.map(row)}
            </>
          )}
          {options.length > 0 && (
            <>
              <span> </span>
              <span className="text-amber-800 dark:text-amber-300">Options:</span>
              {options.map(row)}
            </>
          )}
        </code>
      </pre>
    </figure>
  )
}
