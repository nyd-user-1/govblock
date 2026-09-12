import { FileText } from "lucide-react"
import { codeToHtml, type ShikiTransformer } from "shiki"

import { CodeCollapsibleWrapper } from "@/components/code-collapsible-wrapper"
import { CopyButton } from "@/components/copy-button"
import { cn } from "@govblock/ui/lib/utils"

// The docs code block (rebuilt 2026-09-12, Brendan: "our code blocks look like
// shit"): shiki's tokens in both themes, the shape of the command block —
// a rounded surface, a caption row with the file's name and the copy button
// when it has a title, the bare code with the button at its corner when it
// has none — line numbers only on a titled file, and one Expand, in the
// caption, for a long source. Async, so it renders on the server; a client
// component that needs a code block takes `CodeLines`, which is the same
// markup without the tokens.

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

/** The language a file name says it is, for the highlighter. */
export function languageOf(title?: string, fallback = "tsx") {
  const ext = title?.match(/\.([a-z]+)$/i)?.[1]?.toLowerCase()
  if (!ext) return fallback
  return ({ ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", mjs: "js", json: "json", css: "css", md: "md", mdx: "mdx", sh: "bash", bash: "bash", txt: "txt", xml: "xml", html: "html", yaml: "yaml", yml: "yaml", sql: "sql" } as Record<string, string>)[ext] ?? "txt"
}

/** Plain lines in the figure's markup, for client components and for text with no tokens to colour. */
export function CodeLines({ code, highlighted, numbers = true }: { code: string; highlighted?: Set<number>; numbers?: boolean }) {
  return (
    <pre data-language="txt" className="min-w-0 overflow-x-auto px-4 py-3.5 font-mono text-[13px] leading-6 outline-none">
      <code {...(numbers ? { "data-line-numbers": "" } : {})}>
        {code.split("\n").map((line, index) => (
          <span key={index} data-line="" {...(highlighted?.has(index + 1) ? { "data-highlighted-line": "" } : {})}>
            {line || " "}
          </span>
        ))}
      </code>
    </pre>
  )
}

const marks = (highlighted?: Set<number>, numbers?: boolean): ShikiTransformer => ({
  name: "govblock:lines",
  pre(node) {
    node.properties.class = "min-w-0 overflow-x-auto px-4 py-3.5 font-mono text-[13px] leading-6 outline-none"
    delete node.properties.style
  },
  code(node) {
    if (numbers) node.properties["data-line-numbers"] = ""
  },
  line(node, line) {
    node.properties["data-line"] = ""
    if (highlighted?.has(line)) node.properties["data-highlighted-line"] = ""
  },
})

async function highlight(code: string, lang: string, highlighted?: Set<number>, numbers?: boolean) {
  try {
    return await codeToHtml(code, {
      lang,
      themes: { light: "github-light-default", dark: "github-dark-default" },
      defaultColor: false,
      transformers: [marks(highlighted, numbers)],
    })
  } catch {
    return null
  }
}

/** The figure's chrome, shared by the highlighted and the plain forms. */
export function CodeFrame({ title, code, icon, children, className, action }: { title?: string; code: string; icon?: React.ReactNode; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <figure data-rehype-pretty-code-figure="" data-titled={title ? "" : undefined} className={cn("not-typeset relative mt-6 mb-6 overflow-hidden rounded-xl border border-border/50 bg-surface text-surface-foreground", className)}>
      {title ? (
        <figcaption data-rehype-pretty-code-title="" className="flex h-9 items-center gap-2 border-b border-border/50 px-3 font-mono text-[13px] text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:opacity-70">
          {icon ?? <FileText />}
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {action}
          <CopyButton value={code} className="static! size-7" />
        </figcaption>
      ) : (
        <CopyButton value={code} className="absolute top-2 right-2 z-10 size-7" />
      )}
      <div data-not-typeset="" className={title ? undefined : "pr-10"}>
        {children}
      </div>
    </figure>
  )
}

export async function CodeFigure({
  title,
  code,
  lang,
  highlighted,
  collapsible = false,
  className,
}: {
  title?: string
  code: string
  /** The highlighter's language; read off the title's extension when absent, tsx for a bare snippet. */
  lang?: string
  highlighted?: Set<number>
  collapsible?: boolean
  className?: string
}) {
  const language = lang ?? languageOf(title)
  const numbers = !!title
  const html = language === "txt" ? null : await highlight(code, language, highlighted, numbers)
  const body = html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <CodeLines code={code} highlighted={highlighted} numbers={numbers} />
  if (!collapsible) {
    return (
      <CodeFrame title={title} code={code} className={className}>
        {body}
      </CodeFrame>
    )
  }
  return (
    <CodeCollapsibleWrapper title={title} code={code} className={className}>
      {body}
    </CodeCollapsibleWrapper>
  )
}
