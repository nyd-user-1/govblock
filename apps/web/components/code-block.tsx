import { FileText } from "lucide-react"

import { CodeCollapsibleWrapper } from "@/components/code-collapsible-wrapper"
import { CopyButton } from "@/components/copy-button"

// A docs code block for plain text: the same pre/line markup the docs'
// highlighter emits (line numbers, highlighted lines) without the highlighter —
// bill text has no tokens to colour.

const MARKER = /\{\+([\s\S]*?)\+\}|\[-([\s\S]*?)-\]/g

/** The printed form (matter added in place, matter removed in brackets) and the 1-based numbers of amended lines. */
export function printedWithChanges(text: string) {
  const lines = text.replace(/\r/g, "").split("\n")
  const changed = new Set<number>()
  lines.forEach((line, index) => {
    if (/\{\+|\+\}|\[-|-\]/.test(line)) changed.add(index + 1)
  })
  const code = lines.map((line) => line.replace(MARKER, (_, added, deleted) => (added !== undefined ? added : `[${deleted}]`))).join("\n")
  return { code, changed }
}

export function CodeLines({ code, highlighted }: { code: string; highlighted?: Set<number> }) {
  return (
    <pre
      data-language="text"
      className="no-scrollbar min-w-0 overflow-x-auto overflow-y-auto overscroll-x-contain overscroll-y-auto px-4 py-3.5 outline-none has-[[data-highlighted-line]]:px-0 has-[[data-line-numbers]]:px-0 !bg-transparent"
    >
      <code data-line-numbers="" data-language="text">
        {code.split("\n").map((line, index) => (
          <span key={index} data-line="" {...(highlighted?.has(index + 1) ? { "data-highlighted-line": "" } : {})}>
            {line || " "}
          </span>
        ))}
      </code>
    </pre>
  )
}

export function CodeFigure({
  title,
  code,
  highlighted,
  collapsible = false,
  className,
}: {
  title?: string
  code: string
  highlighted?: Set<number>
  collapsible?: boolean
  className?: string
}) {
  const figure = (
    <figure data-rehype-pretty-code-figure="" className={className ?? "[&>pre]:max-h-96"}>
      {title && (
        <figcaption
          data-rehype-pretty-code-title=""
          className="flex items-center gap-2 text-code-foreground [&_svg]:size-4 [&_svg]:text-code-foreground [&_svg]:opacity-70"
          data-language="txt"
        >
          <FileText />
          {title}
        </figcaption>
      )}
      <CopyButton value={code} />
      <div data-not-typeset="">
        <CodeLines code={code} highlighted={highlighted} />
      </div>
    </figure>
  )
  return collapsible ? <CodeCollapsibleWrapper>{figure}</CodeCollapsibleWrapper> : figure
}
