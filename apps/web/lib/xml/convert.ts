import { DOMSerializer, type Mark, type Node as PmNode } from "@tiptap/pm/model"
import { parseHTML } from "linkedom"

import { toXml, type IrNode } from "./ir"
import { isLevel, SMALL_LEVELS } from "./schema"
import { uslmToDoc, type DocOptions, type DocResult } from "./uslm-to-doc"

// One converter library, from the IR to every format (program brief, decision
// 7). The reader's document is the IR in the reader's schema, so every
// format is drawn from it and nothing converts text to text: HTML (the
// reader's first paint, the same markup the editor draws), Markdown, plain
// text, and XML out (the IR as USLM, lib/xml/ir.ts's toXml). Free of React
// and of `server-only`; the pipeline and scripts import these.

export { uslmToDoc, toXml }

// ------------------------------------------------------------------ HTML ---

let serializer: DOMSerializer | null = null

/** The document as the editor's markup: prosemirror-model's DOMSerializer, over linkedom's document. */
export function docToHtml(doc: PmNode): string {
  const { document } = parseHTML("<!doctype html><html><body></body></html>")
  serializer ??= DOMSerializer.fromSchema(doc.type.schema)
  const fragment = serializer.serializeFragment(doc.content, { document: document as unknown as Document })
  const wrap = document.createElement("div")
  wrap.appendChild(fragment as unknown as Node)
  return wrap.innerHTML
}

// ------------------------------------------------------------------ JSON ---

type Json = { type: string; attrs?: Record<string, unknown>; content?: Json[]; marks?: Json[]; text?: string }

/** The document as ProseMirror JSON with unset attributes left out; `Node.fromJSON` restores their defaults. */
export function docToJson(doc: PmNode): Json {
  const compact = (n: Json): Json => {
    if (n.attrs) {
      const attrs = Object.fromEntries(Object.entries(n.attrs).filter(([, v]) => v != null && v !== false && v !== ""))
      if (Object.keys(attrs).length) n.attrs = attrs
      else delete n.attrs
    }
    n.marks?.forEach(compact)
    n.content?.forEach(compact)
    return n
  }
  return compact(doc.toJSON() as Json)
}

// -------------------------------------------------------------- plain text ---

const RANK = new Map<string, number>((SMALL_LEVELS as readonly string[]).map((name, i) => [name, i + 1]))

/** How far a level's lines are indented when written as text: sections and above at the margin, each small level two spaces deeper. */
const indentOf = (node: PmNode) => "  ".repeat(RANK.get(node.type.name === "level" ? String(node.attrs.element ?? "") : node.type.name) ?? 0)

/** A text block's words, with inserted and struck words in the changelog's markers when asked. */
function blockText(node: PmNode, marked: boolean): string {
  if (!marked) return node.textContent
  let s = ""
  node.forEach((child) => {
    if (!child.isText) {
      s += child.textContent
      return
    }
    const t = child.text ?? ""
    const has = (n: string) => child.marks.some((m: Mark) => m.type.name === n)
    s += has("ins") ? `{+${t}+}` : has("del") ? `[-${t}-]` : t
  })
  return s
}

function lines(node: PmNode, indent: string, out: string[], quoted = "", marked = false) {
  const name = node.type.name
  if (isLevel(name)) {
    const pad = indentOf(node)
    const rawNum = node.firstChild?.type.name === "num" ? node.firstChild.textContent.trim() : ""
    // A small level's bare letter or number prints the way the page prints it, in parentheses.
    const num = pad && /^[A-Za-z0-9]{1,4}$/.test(rawNum) ? `(${rawNum})` : rawNum
    let lead = num
    let start = rawNum ? 1 : 0
    const heading = node.maybeChild(start)
    if (heading?.type.name === "heading") {
      lead = `${lead} ${heading.textContent}`.trim()
      start++
    }
    let first = true
    node.forEach((child, _, i) => {
      if (i < start) return
      if (first && lead && child.isTextblock) {
        out.push(`${quoted}${pad}${lead} ${blockText(child, marked)}`)
        first = false
        return
      }
      if (first && lead) {
        // The number goes on the first line its words print on, not a line of its own.
        const inner: string[] = []
        lines(child, pad, inner, quoted, marked)
        first = false
        if (inner.length && !isLevel(child.type.name)) {
          const head = inner[0].slice(quoted.length).trimStart()
          out.push(`${quoted}${pad}${lead} ${head}`, ...inner.slice(1))
          return
        }
        out.push(`${quoted}${pad}${lead}`, ...inner)
        return
      }
      lines(child, pad, out, quoted, marked)
    })
    if (first && lead) out.push(`${quoted}${pad}${lead}`)
    return
  }
  if (name === "quotedContent") {
    node.forEach((child) => lines(child, indent, out, `${quoted}    `, marked))
    return
  }
  if (name === "table") {
    node.forEach((row) => out.push(`${quoted}${indent}${row.content.content.map((c) => c.textContent).join("\t")}`))
    return
  }
  if (node.isTextblock) {
    const t = blockText(node, marked)
    if (t) out.push(`${quoted}${indent}${t}`)
    return
  }
  node.forEach((child) => lines(child, indent, out, quoted, marked))
}

/** The document as plain text, one block a line, small levels indented by rank. */
export function docToText(doc: PmNode, { marked = false }: { marked?: boolean } = {}): string {
  const out: string[] = []
  doc.forEach((child) => lines(child, "", out, "", marked))
  // A drop cap the source set apart ("B" then "e it enacted") rejoins its word.
  for (let i = out.length - 2; i >= 0; i--) {
    if (/^\s*[A-Z]$/.test(out[i]) && /^\s*[a-z]/.test(out[i + 1])) out.splice(i, 2, out[i].trimEnd() + out[i + 1].trimStart())
  }
  return out.join("\n") + "\n"
}

// ----------------------------------------------------------------- Markdown ---

const mdEscape = (s: string) => s.replace(/([\\`*_[\]#<>|])/g, "\\$1")

function mdInline(block: PmNode): string {
  let out = ""
  block.forEach((child) => {
    if (child.type.name === "br") {
      out += "  \n"
      return
    }
    if (!child.isText) return
    let t = mdEscape(child.text ?? "")
    const has = (n: string) => child.marks.some((m: Mark) => m.type.name === n)
    if (has("b")) t = `**${t}**`
    if (has("i") || has("term")) t = `*${t}*`
    if (has("del")) t = `~~${t}~~`
    const ref = child.marks.find((m: Mark) => m.type.name === "ref")
    if (ref?.attrs.href) t = `[${t}](${ref.attrs.href})`
    out += t
  })
  return out
}

function md(node: PmNode, depth: number, out: string[], quote: string) {
  const name = node.type.name
  const push = (line: string) => out.push(line ? `${quote}${line}` : quote.trimEnd())
  if (isLevel(name)) {
    const small = RANK.has(name) || (name === "level" && RANK.has(String(node.attrs.element ?? "")))
    const num = node.firstChild?.type.name === "num" ? node.firstChild.textContent : ""
    let start = num ? 1 : 0
    const heading = node.maybeChild(start)?.type.name === "heading" ? node.maybeChild(start)! : null
    if (heading) start++
    if (!small) {
      push(`${"#".repeat(Math.min(6, depth + 2))} ${mdEscape([num, heading?.textContent].filter(Boolean).join(" "))}`)
      push("")
      node.forEach((child, _, i) => i >= start && md(child, depth + 1, out, quote))
      return
    }
    const lead = [num && `**${mdEscape(num)}**`, heading && `*${mdEscape(heading.textContent)}*`].filter(Boolean).join(" ")
    let led = false
    node.forEach((child, _, i) => {
      if (i < start) return
      if (!led && child.isTextblock) {
        push(`${lead} ${mdInline(child)}`.trim())
        push("")
        led = true
        return
      }
      if (!led && lead) {
        push(lead)
        push("")
        led = true
      }
      md(child, depth, out, quote)
    })
    if (!led && lead) {
      push(lead)
      push("")
    }
    return
  }
  if (name === "quotedContent") {
    node.forEach((child) => md(child, depth, out, `${quote}> `))
    push("")
    return
  }
  if (name === "table") {
    node.forEach((row, _, i) => {
      push(`| ${row.content.content.map(mdInline).join(" | ")} |`)
      if (i === 0) push(`|${" --- |".repeat(row.childCount)}`)
    })
    push("")
    return
  }
  if (name === "toc") {
    node.forEach((item) => push(`- ${mdInline(item)}`))
    push("")
    return
  }
  if (node.isTextblock) {
    const t = mdInline(node)
    if (t) {
      push(name === "docTitle" || name === "officialTitle" ? `**${t}**` : t)
      push("")
    }
    return
  }
  node.forEach((child) => md(child, depth, out, quote))
}

/** The document as Markdown: big levels and sections as headings, small levels as paragraphs led by their number, quotations as block quotes. */
export function docToMarkdown(doc: PmNode): string {
  const out: string[] = []
  if (doc.attrs.title) out.push(`# ${mdEscape(String(doc.attrs.title))}`, "")
  doc.forEach((child) => md(child, 0, out, ""))
  return out.join("\n").replace(/\n{3,}/g, "\n\n")
}

// ----------------------------------------------------------- from the IR ---

/** The IR straight to each format, for a caller holding a front end's output. */
export const irToDoc = (ir: IrNode, options?: DocOptions): DocResult => uslmToDoc(ir, options)
export const irToHtml = (ir: IrNode, options?: DocOptions) => docToHtml(uslmToDoc(ir, options).doc)
export const irToMarkdown = (ir: IrNode, options?: DocOptions) => docToMarkdown(uslmToDoc(ir, options).doc)
export const irToText = (ir: IrNode, options?: DocOptions) => docToText(uslmToDoc(ir, options).doc)
export const irToXml = (ir: IrNode) => toXml(ir)
