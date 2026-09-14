import type { Mark, Node as PmNode, NodeType } from "@tiptap/pm/model"

import { isNode, tidy, text as irText, type IrChild, type IrNode } from "./ir"
import { allowedLevels, isLevel, xmlSchema } from "./schema"

// uslmToDoc: the IR (a USLM-named tree, lib/xml/ir.ts) walked into a
// ProseMirror document of the reader's schema (lib/xml/schema.ts). This is
// the step lib/policy/bill-uslm.ts's `render` never took: the tree becomes
// levels with their num, heading, chapeau, content and continuation, not
// headings and paragraphs.
//
// Every child is placed where the schema accepts it. Loose text in a level
// goes into a `content`, as USLM would have it; a quoted block a Bill DTD
// printing hangs straight off a level goes into one too. A level nested
// where its rank is not allowed becomes USLM's generic `level`, carrying
// its element's name, and the report says where. An element nobody knows is
// counted with the first path it was seen at, and its text is kept.

export type Fidelity = "native-xml" | "structured-html" | "plain-text" | "pdf"

export type DocOptions = {
  /** The front end's dialect ("uslm", "bill-dtd", "text"). */
  dialect?: string
  /** The Work's address, from which portions without an identifier of their own are named. */
  identifier?: string | null
  expression?: string | null
  title?: string | null
  fidelity?: Fidelity
}

export type DocReport = {
  dialect: string | null
  /** Node type → count in the document. */
  nodes: Record<string, number>
  /** Mark type → count of text runs carrying it. */
  marks: Record<string, number>
  /** Element → count and the first path, for elements the reader does not know. */
  unknown: Record<string, { count: number; path: string }>
  /** Where the schema refused a nesting: "clause>clause" → count and first path. */
  violations: Record<string, { count: number; path: string }>
  /** Containers read through (main, amendment, notes): element → count. */
  unwrapped: Record<string, number>
  /** Known and deliberately not drawn (meta, page markers): element → count. */
  skipped: Record<string, number>
  notes: string[]
}

export type DocResult = { doc: PmNode; report: DocReport }

const S = xmlSchema
const N = S.nodes

// ------------------------------------------------------------ vocabulary ---

const TEXTBLOCKS = new Set(["num", "heading", "subheading", "chapeau", "continuation", "proviso", "crossHeading"])
const MARK_OF: Record<string, string> = {
  b: "b", i: "i", sub: "sub", sup: "sup", ins: "ins", del: "del", inline: "inline", span: "span", term: "term",
  shortTitle: "shortTitle", headingText: "headingText", quotedText: "quotedText", ref: "ref", date: "date",
  amendingAction: "amendingAction", designator: "designator", label: "label",
  // A heading set inside running text is a heading's words, not a block.
  heading: "headingText", u: "inline", em: "i", strong: "b",
}
const NOTE_ELEMENTS = new Set([
  "note", "sourceCredit", "statutoryNote", "editorialNote", "changeNote", "authority", "authorityNote", "source", "effectiveDateNote",
  "citationNote", "explanationNote", "findingAidsNote", "footnote", "sidenote", "endnote", "uscNote", "elided",
])
const TRANSPARENT = new Set(["#root", "main", "amendment", "amendmentInstruction", "notes", "lawDoc", "bill", "resolution", "uscDoc", "pLaw", "statute", "document", "legislativeHistory", "collection", "component", "block", "div", "tbody", "thead", "tfoot", "fragment"])
const SKIPPED = new Set(["meta", "property", "page", "line", "leftRunningHead", "rightRunningHead", "centerRunningHead", "ear", "endMarker", "marker", "processedBy", "processedDate", "citableAs", "colspec", "colgroup", "col", "caption"])
const FRONT = new Set(["preface", "engrossed-amendment-form", "form"])
const KNOWN_BLOCKS = new Set([
  ...TEXTBLOCKS, "content", "p", "quotedContent", "toc", "tocItem", "referenceItem", "headingItem", "groupItem", "table", "tr", "td", "th", "layout", "header", "row", "column",
  "longTitle", "docTitle", "officialTitle", "enactingFormula", "resolvingClause", "preamble", "recital", "signatures", "signature", "appendix", "schedule", "br", "img",
  // A signature's parts, read as its one line.
  "name", "role", "affiliation", "signatureDate", "notation", "autograph",
])
/** What a `content` holds as a block; anything else in it is running text. */
const CONTENT_BLOCKS = new Set(["p", "quotedContent", "toc", "table", "note"])

// --------------------------------------------------------------- report ---

class Recorder {
  report: DocReport
  constructor(dialect: string | null) {
    this.report = { dialect, nodes: {}, marks: {}, unknown: {}, violations: {}, unwrapped: {}, skipped: {}, notes: [] }
  }
  unknown(tag: string, path: string) {
    const u = (this.report.unknown[tag] ??= { count: 0, path })
    u.count++
  }
  violation(key: string, path: string) {
    const v = (this.report.violations[key] ??= { count: 0, path })
    v.count++
  }
  bump(map: Record<string, number>, key: string) {
    map[key] = (map[key] ?? 0) + 1
  }
}

// ------------------------------------------------------------ attributes ---

const MODELED = new Set(["id", "identifier", "class", "role", "status", "value", "href", "idref", "portion", "type", "date", "origin", "colspan", "rowspan", "src", "alt"])

/** A source element's attributes as a block's: the modeled ones by name, the rest kept in `xml`. `style` is GPO's locator furniture and is left behind. */
function blockAttrs(el: IrNode, extra: Record<string, unknown> = {}) {
  const attrs: Record<string, unknown> = { ...extra }
  let xml: Record<string, string> | null = null
  for (const [k, v] of Object.entries(el.attrs)) {
    if (k === "style" || k.startsWith("xmlns")) continue
    if (k === "id" || k === "identifier" || k === "class" || k === "role" || k === "status") attrs[k] = v
    else if (!MODELED.has(k)) (xml ??= {})[k] = v
  }
  if (xml) attrs.xml = xml
  return attrs
}

/** The bare number a num carries: "SEC. 101." → "101", "(a)" → "a", "TITLE I—" → "I". */
export function numValue(label: string): string {
  return label
    .replace(/^\s*(?:sec(?:tion)?s?\.?|§+|title|subtitle|chapter|subchapter|part|subpart|division|subdivision|article|subarticle|rule|paragraph|clause)\s*/i, "")
    .replace(/^[\s(“"]+|[\s).:—–-]+$/g, "")
    .replace(/[)(]/g, "")
    .trim()
}

const PREFIX: Record<string, string> = {
  title: "t", subtitle: "st", chapter: "ch", subchapter: "sch", part: "pt", subpart: "spt", division: "d", subdivision: "sd",
  article: "art", subarticle: "sart", section: "s", courtRule: "r",
}

// ------------------------------------------------------------ converter ---

type Ctx = { path: string; identifier: string | null }

class Converter {
  rec: Recorder
  dtd: boolean
  constructor(rec: Recorder, dialect: string | null) {
    this.rec = rec
    this.dtd = dialect === "bill-dtd"
  }

  // ----- inline

  /** Text runs and inline atoms from an element's children, marks carried down. */
  inline(children: IrChild[], marks: readonly Mark[], path: string, out: { text: string; marks: readonly Mark[] }[] | PmNode[] = []): (PmNode | { text: string; marks: readonly Mark[] })[] {
    const runs = out as (PmNode | { text: string; marks: readonly Mark[] })[]
    for (const c of children) {
      if (!isNode(c)) {
        runs.push({ text: c, marks })
        continue
      }
      const here = `${path}>${c.tag}`
      if (c.tag === "br") {
        runs.push(N.br.create())
        continue
      }
      if (c.tag === "img") {
        runs.push(N.img.create({ src: c.attrs.src ?? null, alt: c.attrs.alt ?? null }))
        continue
      }
      if (SKIPPED.has(c.tag)) {
        this.rec.bump(this.rec.report.skipped, c.tag)
        continue
      }
      const markName = MARK_OF[c.tag]
      if (markName) {
        const type = S.marks[markName]
        const attrs: Record<string, unknown> = {}
        for (const a of Object.keys(type.spec.attrs ?? {})) if (a !== "xml" && c.attrs[a] != null) attrs[a] = c.attrs[a]
        const rest = Object.fromEntries(Object.entries(c.attrs).filter(([k]) => !(k in (type.spec.attrs ?? {})) && k !== "style"))
        if (Object.keys(rest).length) attrs.xml = rest
        const mark = type.create(attrs)
        // A Bill DTD <quote> prints its quotation marks; USLM writes them as text outside <quotedText>, which is where they go.
        const quote = this.dtd && c.tag === "quotedText"
        if (quote) runs.push({ text: "“", marks })
        this.inline(c.children, mark.addToSet(marks), here, runs as never)
        if (quote) runs.push({ text: "”", marks })
        continue
      }
      if (!KNOWN_BLOCKS.has(c.tag) && !isLevel(c.tag) && !NOTE_ELEMENTS.has(c.tag) && !TRANSPARENT.has(c.tag)) this.rec.unknown(c.tag, here)
      this.inline(c.children, marks, here, runs as never)
    }
    return runs
  }

  /** Runs as text nodes: whitespace collapsed as XML's pretty-printing asks, trimmed at the block's edges. */
  textNodes(runs: (PmNode | { text: string; marks: readonly Mark[] })[]): PmNode[] {
    const out: PmNode[] = []
    let pending = ""
    let pendingMarks: readonly Mark[] = []
    let lastSpace = true
    const flush = () => {
      if (pending) {
        out.push(S.text(pending, pendingMarks))
        for (const m of pendingMarks) this.rec.bump(this.rec.report.marks, m.type.name)
      }
      pending = ""
    }
    for (const r of runs) {
      if ("type" in r) {
        flush()
        out.push(r)
        lastSpace = r.type.name === "br"
        continue
      }
      let t = r.text.replace(/\s+/g, " ")
      if (lastSpace && t.startsWith(" ")) t = t.slice(1)
      if (!t) continue
      const same = pendingMarks.length === r.marks.length && pendingMarks.every((m, i) => m.eq(r.marks[i]))
      if (!same) {
        flush()
        pendingMarks = r.marks
      }
      pending += t
      lastSpace = t.endsWith(" ")
    }
    if (pending.endsWith(" ")) pending = pending.slice(0, -1)
    flush()
    // A trailing space left in an earlier run, before a mark change at the very end.
    const last = out[out.length - 1]
    if (last?.isText && last.text!.endsWith(" ")) out[out.length - 1] = S.text(last.text!.replace(/ +$/, ""), last.marks)
    return out.filter((n) => !n.isText || n.text)
  }

  textblock(name: string, el: IrNode, ctx: Ctx, extra: Record<string, unknown> = {}): PmNode | null {
    const content = this.textNodes(this.inline(el.children, [], `${ctx.path}>${el.tag}`))
    if (!content.length && name !== "num") return null
    return this.make(name, blockAttrs(el, extra), content)
  }

  make(name: string, attrs: Record<string, unknown>, content: PmNode[]): PmNode {
    this.rec.bump(this.rec.report.nodes, name)
    return N[name].create(attrs, content)
  }

  // ----- blocks

  /** One element in a block context: zero or more nodes, not yet placed. */
  block(el: IrNode, ctx: Ctx, parentLevel: string | null): PmNode[] {
    const path = `${ctx.path}>${el.tag}`
    const tag = el.tag

    if (SKIPPED.has(tag) || tag.startsWith("dc:")) {
      this.rec.bump(this.rec.report.skipped, tag)
      return []
    }
    if (TRANSPARENT.has(tag)) {
      if (tag !== "#root") this.rec.bump(this.rec.report.unwrapped, tag)
      return this.blocks(el.children, { ...ctx, path }, parentLevel)
    }
    if (isLevel(tag)) return [this.level(el, ctx, parentLevel)]
    if (TEXTBLOCKS.has(tag)) {
      const extra = tag === "num" ? { value: el.attrs.value ?? numValue(tidy(irText(el))) } : {}
      const n = this.textblock(tag, el, ctx, extra)
      return n ? [n] : []
    }
    if (NOTE_ELEMENTS.has(tag)) {
      const kids = this.place("note", this.blocks(el.children, { ...ctx, path }, null), path)
      return kids.length ? [this.make("note", blockAttrs(el, { element: tag === "note" ? null : tag }), kids)] : []
    }
    switch (tag) {
      case "content": {
        const kids = this.place("content", this.blocks(el.children, { ...ctx, path }, null), path)
        return kids.length ? [this.make("content", blockAttrs(el), kids)] : []
      }
      case "p": {
        const n = this.textblock("p", el, ctx)
        return n ? [n] : []
      }
      case "quotedContent": {
        // A quotation holds whatever the law it quotes holds: any level at its top.
        const kids = this.place("quotedContent", this.blocks(el.children, { path, identifier: null }, "level"), path)
        return kids.length ? [this.make("quotedContent", blockAttrs(el, { origin: el.attrs.origin ?? null }), kids)] : []
      }
      case "toc": {
        const items: PmNode[] = []
        const collect = (n: IrNode) => {
          for (const c of n.children) {
            if (!isNode(c)) continue
            if (["tocItem", "referenceItem", "headingItem", "groupItem"].includes(c.tag)) {
              const item = this.textblock("referenceItem", c, { ...ctx, path }, { element: c.tag === "referenceItem" ? null : c.tag })
              if (item) items.push(item)
            } else if (c.tag === "layout" || c.tag === "row" || c.tag === "header" || c.tag === "column") collect(c)
            else {
              const item = this.textblock("referenceItem", c, { ...ctx, path }, { element: c.tag })
              if (item) items.push(item)
            }
          }
        }
        collect(el)
        return items.length ? [this.make("toc", blockAttrs(el), items)] : []
      }
      case "table":
      case "layout": {
        const rows: PmNode[] = []
        const collect = (n: IrNode, head: boolean) => {
          for (const c of n.children) {
            if (!isNode(c)) continue
            if (c.tag === "tr" || c.tag === "row" || c.tag === "header") {
              const cells: PmNode[] = []
              for (const cell of c.children) {
                if (!isNode(cell)) continue
                const name = cell.tag === "th" || head || c.tag === "header" ? "th" : "td"
                const colspan = cell.attrs.colspan ?? null
                const made = this.textblock(name, cell, { ...ctx, path }, { colspan, rowspan: cell.attrs.rowspan ?? null }) ?? this.make(name, {}, [])
                cells.push(made)
              }
              if (cells.length) rows.push(this.make("tr", blockAttrs(c), cells))
            } else if (SKIPPED.has(c.tag)) this.rec.bump(this.rec.report.skipped, c.tag)
            else collect(c, head || c.tag === "thead")
          }
        }
        collect(el, false)
        return rows.length ? [this.make("table", blockAttrs(el, { element: tag === "table" ? null : tag }), rows)] : []
      }
      case "longTitle": {
        const parts: PmNode[] = []
        const loose: IrChild[] = []
        for (const c of el.children) {
          if (isNode(c) && (c.tag === "docTitle" || c.tag === "officialTitle")) {
            const n = this.textblock(c.tag, c, { ...ctx, path })
            if (n) parts.push(n)
          } else loose.push(c)
        }
        const rest = this.textNodes(this.inline(loose, [], path))
        if (rest.length) parts.push(this.make("officialTitle", {}, rest))
        return parts.length ? [this.make("longTitle", blockAttrs(el), parts)] : []
      }
      case "docTitle":
      case "officialTitle":
      case "enactingFormula":
      case "resolvingClause":
      case "recital": {
        const n = this.textblock(tag, el, ctx)
        return n ? [n] : []
      }
      case "preamble": {
        const kids = this.place("preamble", this.blocks(el.children, { ...ctx, path }, null), path)
        return kids.length ? [this.make("preamble", blockAttrs(el), kids)] : []
      }
      case "signatures": {
        const kids: PmNode[] = []
        const collect = (n: IrNode) => {
          for (const c of n.children) {
            if (!isNode(c)) {
              if (c.trim()) kids.push(this.make("p", { implicit: true }, [S.text(tidy(c))]))
              continue
            }
            if (c.tag === "signatures") collect(c)
            else {
              const made = this.textblock(c.tag === "signature" ? "signature" : "p", c, { ...ctx, path }, c.tag === "signature" ? {} : { element: c.tag })
              if (made) kids.push(made)
            }
          }
        }
        collect(el)
        return kids.length ? [this.make("signatures", blockAttrs(el), kids)] : []
      }
      case "appendix":
      case "schedule": {
        const kids = this.place("appendix", this.blocks(el.children, { ...ctx, path }, "level"), path)
        return kids.length ? [this.make("appendix", blockAttrs(el, { element: tag === "appendix" ? null : tag }), kids)] : []
      }
    }
    if (FRONT.has(tag)) {
      // The printing's front matter: which Congress, which chamber, the action. One line each.
      const lines: PmNode[] = []
      if (tag !== "preface") this.rec.unknown(tag, path)
      for (const c of el.children) {
        if (!isNode(c)) continue
        if (SKIPPED.has(c.tag) || c.tag.startsWith("dc:")) {
          this.rec.bump(this.rec.report.skipped, c.tag)
          continue
        }
        const n = this.textblock("p", c, { ...ctx, path }, { element: c.tag })
        if (n) lines.push(n)
      }
      return lines.length ? [this.make("preface", blockAttrs(el, { element: tag === "preface" ? null : tag }), lines)] : []
    }
    // An element the reader does not know: its structure read through, its words kept.
    this.rec.unknown(tag, path)
    if (el.children.some(isNode)) return this.blocks(el.children, { ...ctx, path }, parentLevel)
    const n = this.textblock("p", el, ctx, { element: tag })
    return n ? [n] : []
  }

  /** A run of children in a block context; running text between blocks becomes an implicit paragraph. */
  blocks(children: IrChild[], ctx: Ctx, parentLevel: string | null): PmNode[] {
    const out: PmNode[] = []
    let run: IrChild[] = []
    const flushRun = () => {
      if (!run.length) return
      const content = this.textNodes(this.inline(run, [], ctx.path))
      if (content.length) out.push(this.make("p", { implicit: true }, content))
      run = []
    }
    for (const c of children) {
      if (!isNode(c) || MARK_OF[c.tag] || c.tag === "br" || c.tag === "img") {
        // `heading` is a block here, not the inline heading text MARK_OF means.
        if (isNode(c) && c.tag === "heading") {
          flushRun()
          out.push(...this.block(c, ctx, parentLevel))
          continue
        }
        run.push(c)
        continue
      }
      flushRun()
      out.push(...this.block(c, ctx, parentLevel))
    }
    flushRun()
    return out
  }

  level(el: IrNode, ctx: Ctx, parentLevel: string | null): PmNode {
    const path = `${ctx.path}>${el.tag}`
    let name = el.tag
    if (parentLevel && !allowedLevels(parentLevel).includes(name)) {
      this.rec.violation(`${parentLevel}>${el.tag}`, path)
      name = "level"
    }
    const num = el.children.find((c): c is IrNode => isNode(c) && c.tag === "num")
    const value = num ? (num.attrs.value ?? numValue(tidy(irText(num)))) : null
    const prefix = PREFIX[el.tag] ?? ""
    const identifier = el.attrs.identifier ?? (ctx.identifier && value ? `${ctx.identifier}/${prefix}${value.replace(/[^A-Za-z0-9.-]+/g, "-")}` : null)
    const kids = this.blocks(el.children, { path, identifier }, el.tag)
    const attrs = blockAttrs(el, { identifier, element: name === "level" && el.tag !== "level" ? el.tag : (el.attrs.element ?? null) })
    const placed = this.place(name, kids, path)
    if (placed === null || !N[name].validContent(N[name].create(attrs, placed).content)) {
      // Out of order for its type (a heading after its text): USLM's generic level takes any order.
      if (name !== "level") this.rec.violation(`${el.tag}:order`, path)
      const loose = this.place("level", kids, path) ?? kids
      return this.make("level", { ...attrs, element: el.tag }, loose)
    }
    return this.make(name, attrs, placed)
  }

  /**
   * Children placed into a parent of this type: kept where the parent's
   * content expression accepts them, gathered into a `content` where it
   * accepts a content and not them. Null when the order itself is refused.
   */
  place(parent: string, kids: PmNode[], path: string): PmNode[] {
    const type = N[parent]
    const accepts = acceptedTypes(type)
    const out: PmNode[] = []
    let gather: PmNode[] = []
    const flush = () => {
      if (!gather.length) return
      out.push(this.make("content", {}, gather))
      gather = []
    }
    for (const k of kids) {
      const name = k.type.name
      if (accepts.has(name)) {
        flush()
        out.push(k)
      } else if (accepts.has("content") && CONTENT_BLOCKS.has(name)) {
        gather.push(k)
      } else if (name === "content" && !accepts.has("content") && accepts.has("p")) {
        flush()
        out.push(...k.content.content)
      } else if (accepts.has("content") && (TEXTBLOCKS.has(name) || name === "referenceItem")) {
        // A num or chapeau where the parent takes none: its words, as a paragraph of content.
        this.rec.violation(`${parent}>${name}`, path)
        gather.push(this.make("p", { element: name }, k.content.content as PmNode[]))
      } else if (accepts.has("p") && k.isTextblock) {
        flush()
        this.rec.violation(`${parent}>${name}`, path)
        out.push(this.make("p", { element: name }, k.content.content as PmNode[]))
      } else if (accepts.has("level") && isLevel(name)) {
        flush()
        out.push(k)
      } else {
        flush()
        // Nowhere to put it in this parent: its words, so nothing is lost, and the report names it.
        this.rec.violation(`${parent}>${name}`, path)
        const words = k.textContent.trim()
        if (words && accepts.has("p")) out.push(this.make("p", { element: name }, [S.text(words)]))
        else if (words && accepts.has("content")) gather.push(this.make("p", { element: name }, [S.text(words)]))
      }
    }
    flush()
    return out
  }
}

const accepted = new Map<NodeType, Set<string>>()
/** Every node type a parent's content expression mentions, anywhere in it. */
function acceptedTypes(type: NodeType): Set<string> {
  let set = accepted.get(type)
  if (set) return set
  set = new Set()
  const seen = new Set<unknown>()
  const visit = (m: typeof type.contentMatch) => {
    if (seen.has(m)) return
    seen.add(m)
    for (let i = 0; i < m.edgeCount; i++) {
      const { type: t, next } = m.edge(i)
      set!.add(t.name)
      visit(next)
    }
  }
  visit(type.contentMatch)
  accepted.set(type, set)
  return set
}

// ---------------------------------------------------------------- entry ---

/** The IR as a document of the reader's schema, and what the walk found. */
export function uslmToDoc(ir: IrNode, options: DocOptions = {}): DocResult {
  const rec = new Recorder(options.dialect ?? null)
  const conv = new Converter(rec, options.dialect ?? null)
  const top = ir.tag === "#root" ? (ir.children.find(isNode) ?? ir) : ir
  const element = TRANSPARENT.has(top.tag) && top.tag !== "#root" && top.tag !== "main" ? top.tag : "bill"
  const body = conv.blocks(top.tag === "main" ? [top] : top.children, { path: top.tag, identifier: options.identifier ?? null }, "level")
  const placed = conv.place("doc", body, top.tag)
  // Front matter after the body has begun (a second preface, a title set
  // below the first section) is read as paragraphs where it stands.
  const kids: PmNode[] = []
  let match = N.doc.contentMatch
  for (const k of placed) {
    const next = match.matchType(k.type)
    if (next) {
      kids.push(k)
      match = next
      continue
    }
    rec.violation(`doc>${k.type.name}:order`, top.tag)
    const lines: PmNode[] = []
    if (k.isTextblock) lines.push(k)
    else k.descendants((d) => (d.isTextblock ? (lines.push(d), false) : true))
    for (const line of lines) {
      const p = conv.make("p", { element: line.type.name }, line.content.content as PmNode[])
      kids.push(p)
      match = match.matchType(p.type) ?? match
    }
  }
  const title = options.title ?? metaTitle(top)
  const attrs = { element, identifier: options.identifier ?? null, expression: options.expression ?? null, dialect: options.dialect ?? null, title, fidelity: options.fidelity ?? null }
  const doc = N.doc.create(attrs, kids)
  doc.check()
  if (conv.dtd) rec.report.notes.push("Bill DTD quotations: quotation marks written as text around quotedText, as USLM 2 prints them")
  return { doc, report: rec.report }
}

function metaTitle(top: IrNode): string | null {
  let found: string | null = null
  const visit = (n: IrNode, depth: number) => {
    if (found || depth > 3) return
    for (const c of n.children) {
      if (!isNode(c)) continue
      if (c.tag === "dc:title" || c.tag === "docNumber") {
        found = tidy(irText(c))
        return
      }
      if (c.tag === "meta" || c.tag === "preface" || c.tag === "property" || c.tag === "engrossed-amendment-form" || c.tag === "form") visit(c, depth + 1)
    }
  }
  visit(top, 0)
  return found
}
