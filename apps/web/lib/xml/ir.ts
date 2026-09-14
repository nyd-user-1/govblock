// The intermediate representation the compiler targets (program brief, "The
// compiler"): a legislative document as a tree of elements named the way
// USLM names them. Every front end lifts a jurisdiction's surface text into
// this shape; the reader, the converters and the amendment engine read it
// and never the raw text. Free of React, of `server-only` and of any import
// into lib/policy, so scripts bundle it with esbuild and run it on the box
// (scripts/xml/bundle.mjs). The parser began as lib/policy/bill-uslm.ts's;
// text is decoded here at parse time so a text node is plain words.

export type IrAttrs = Record<string, string>
export type IrNode = { tag: string; attrs: IrAttrs; children: IrChild[] }
export type IrChild = string | IrNode

export const isNode = (c: IrChild): c is IrNode => typeof c !== "string"
export const kids = (n: IrNode): IrNode[] => n.children.filter(isNode)
export const find = (n: IrNode, tag: string): IrNode | null => n.children.find((c): c is IrNode => isNode(c) && c.tag === tag) ?? null
export const node = (tag: string, attrs: IrAttrs = {}, children: IrChild[] = []): IrNode => ({ tag, attrs, children })

export function walk(n: IrNode, visit: (node: IrNode, depth: number, parent: IrNode | null) => void, depth = 0, parent: IrNode | null = null) {
  visit(n, depth, parent)
  for (const c of n.children) if (isNode(c)) walk(c, visit, depth + 1, n)
}

/** Everything under a node as one run of words. */
export function text(c: IrChild): string {
  return typeof c === "string" ? c : c.children.map(text).join("")
}
export const tidy = (s: string) => s.replace(/\s+/g, " ").trim()

/** One element per line, for a report or a test. */
export function outline(n: IrNode, depth = 0, out: string[] = []): string[] {
  const num = find(n, "num")
  const heading = find(n, "heading")
  out.push(`${"  ".repeat(depth)}${n.tag}${num ? ` ${tidy(text(num))}` : ""}${heading ? ` ${tidy(text(heading)).slice(0, 60)}` : ""}`)
  for (const c of kids(n)) if (!["num", "heading"].includes(c.tag)) outline(c, depth + 1, out)
  return out
}

// ------------------------------------------------------------------ parse ---

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", hellip: "…", sect: "§", para: "¶", cent: "¢", deg: "°", frac12: "½", times: "×", copy: "©", reg: "®",
}

export function decode(s: string) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z0-9]+);/g, (all, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : all
    }
    return ENTITIES[body] ?? all
  })
}

function attrsOf(rest: string): IrAttrs {
  const attrs: IrAttrs = {}
  const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let m: RegExpExecArray | null
  while ((m = re.exec(rest))) attrs[m[1]] = decode(m[2] ?? m[3] ?? "")
  return attrs
}

/**
 * XML as an IR tree. The prolog, the doctype, comments and processing
 * instructions are skipped; CDATA is text. USLM and the Bill DTD are
 * well-formed, so a small reader is enough and it costs nothing at install.
 */
export function parseXml(xml: string): IrNode {
  const src = xml
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?[^>]*>/g, "")
  const root: IrNode = { tag: "#root", attrs: {}, children: [] }
  const stack: IrNode[] = [root]
  const push = (t: string) => {
    if (t) stack[stack.length - 1].children.push(decode(t))
  }
  let i = 0
  while (i < src.length) {
    const lt = src.indexOf("<", i)
    if (lt < 0) {
      push(src.slice(i))
      break
    }
    if (lt > i) push(src.slice(i, lt))
    if (src.startsWith("<![CDATA[", lt)) {
      const end = src.indexOf("]]>", lt)
      const stop = end < 0 ? src.length : end
      stack[stack.length - 1].children.push(src.slice(lt + 9, stop))
      i = stop + 3
      continue
    }
    const gt = src.indexOf(">", lt)
    if (gt < 0) break
    const raw = src.slice(lt, gt + 1)
    i = gt + 1
    if (raw.startsWith("</")) {
      const name = raw.slice(2, -1).trim()
      for (let d = stack.length - 1; d > 0; d--) {
        if (stack[d].tag === name) {
          stack.length = d
          break
        }
      }
      continue
    }
    const m = /^<([A-Za-z_][\w:.-]*)([\s\S]*?)\/?>$/.exec(raw)
    if (!m) continue
    const el: IrNode = { tag: m[1], attrs: attrsOf(m[2]), children: [] }
    stack[stack.length - 1].children.push(el)
    if (!/\/\s*>$/.test(raw)) stack.push(el)
  }
  return root
}

// -------------------------------------------------------------- contract ---

export type SourceKind = "xml" | "html" | "text"
/** What a front end is handed: the stored body of one document and where it came from. */
export type Source = { kind: SourceKind; body: string; url?: string | null; jurisdiction?: string; meta?: Record<string, unknown> }

export type ParseReport = {
  /** The surface syntax the front end recognised: "uslm", "bill-dtd", "text", … */
  dialect: string
  /** Elements in the output. */
  elements: number
  /** Elements whose name is in the USLM vocabulary after normalisation. */
  known: number
  /** Element name → count, for names the vocabulary does not know. */
  unknown: Record<string, number>
  /** Source name → count, for elements the front end renamed. */
  renamed: Record<string, number>
  /** known / elements, 0 to 1. The document's own coverage. */
  coverage: number
  notes: string[]
}

export type FrontEndResult = { doc: IrNode; report: ParseReport }

/** A structural unit a jurisdiction uses, how it is signalled, and the USLM element it maps to. */
export type Unit = { name: string; uslm: string; signal: string }
export type Profile = { jurisdiction: string; name: string; dialects: string[]; units: Unit[] }
export type FrontEnd = { profile: Profile; parse(source: Source): FrontEndResult }

/** A coverage line as scripts/xml/coverage.mjs writes it to lib/xml/coverage.generated.json. */
export type CoverageLine = {
  jurisdiction: string
  name: string
  source: string
  sampled: number
  clean: number
  coverage: number
  dialects: Record<string, number>
  unknown: Record<string, number>
  measuredAt: string
}
