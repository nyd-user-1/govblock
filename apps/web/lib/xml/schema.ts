import { Schema, type DOMOutputSpec, type Mark, type MarkSpec, type Node as PmNode, type NodeSpec } from "@tiptap/pm/model"

// The reader's ProseMirror schema: USLM's element set as node and mark types,
// named as USLM names them (docs/xml/schema.md, section 2). One table drives
// both the schema the server and scripts build here and the Tiptap extensions
// the browser's reader builds (components/workspace/typeset-xml-extensions.ts),
// so the snapshot a page paints first and the editor that takes over draw the
// same markup. No React, no `server-only`, no `@/` imports: scripts bundle it.
//
// The hierarchy is the schema's, not the renderer's: a level accepts only the
// levels of lower rank, so a clause cannot hold a clause. USLM's XSD allows any
// level inside any level; rank is the rule a reader of the law already knows.
// Where a source breaks it, uslmToDoc reaches for USLM's own generic `level`
// and says so; the schema never repairs.

export const BIG_LEVELS = [
  "preliminary", "title", "subtitle", "division", "subdivision", "chapter", "subchapter", "part", "subpart",
  "article", "subarticle", "compiledAct", "courtRules", "courtRule", "reorganizationPlans", "reorganizationPlan",
] as const
export const SMALL_LEVELS = ["subsection", "paragraph", "subparagraph", "clause", "subclause", "item", "subitem", "subsubitem"] as const
export const LEVELS: readonly string[] = [...BIG_LEVELS, "section", ...SMALL_LEVELS, "level"]
const LEVEL_SET = new Set(LEVELS)
export const isLevel = (name: string) => LEVEL_SET.has(name)

/** The levels a level of this element may hold, by rank. `level` holds any. */
export function allowedLevels(element: string): readonly string[] {
  if (element === "level") return LEVELS
  if ((BIG_LEVELS as readonly string[]).includes(element)) return [...BIG_LEVELS.filter((b) => b !== element), "section", "level"]
  if (element === "section") return [...SMALL_LEVELS, "level"]
  const rank = (SMALL_LEVELS as readonly string[]).indexOf(element)
  if (rank >= 0) return [...SMALL_LEVELS.slice(rank + 1), "level"]
  return []
}

/** What a level holds besides its levels: GovInfo's Bill DTD mixes content with chapeau and child levels, so the choice is not exclusive. */
const LEVEL_PARTS = "content | chapeau | continuation | proviso | crossHeading | note | toc"

/** Attributes every block carries from its source, plus `xml` for the ones the node does not model. */
const BLOCK_ATTRS = { id: { default: null }, identifier: { default: null }, class: { default: null }, role: { default: null }, status: { default: null }, element: { default: null }, xml: { default: null } }

type Attrs = Record<string, unknown>

/** The HTML attributes a node's source attributes become: data attributes a parse rule can read back. */
function dataAttrs(name: string, attrs: Attrs, extra: Record<string, string> = {}) {
  const out: Record<string, string> = { "data-uslm": name, ...extra }
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === "" || k === "xml") continue
    out[`data-${k.toLowerCase()}`] = String(v)
  }
  if (attrs.xml) out["data-xml"] = JSON.stringify(attrs.xml)
  if (attrs.identifier) out.id = String(attrs.identifier)
  return out
}

const cls = (...names: (string | null | undefined | false)[]) => names.filter(Boolean).join(" ")

function block(name: string, tag: string, spec: Partial<NodeSpec> & { className?: (attrs: Attrs) => string } = {}): NodeSpec {
  const { className, ...rest } = spec
  return {
    attrs: BLOCK_ATTRS,
    ...rest,
    toDOM: (node: PmNode): DOMOutputSpec => [tag, dataAttrs(name, node.attrs, { class: cls(`uslm-${name}`, className?.(node.attrs)) }), 0],
    parseDOM: [{ tag: `[data-uslm="${name}"]`, getAttrs: readAttrs }],
  }
}

function readAttrs(dom: HTMLElement): Attrs {
  const attrs: Attrs = {}
  for (const key of Object.keys(BLOCK_ATTRS)) {
    const v = dom.getAttribute(`data-${key}`)
    if (v != null) attrs[key] = key === "xml" ? JSON.parse(v) : v
  }
  return attrs
}

const textblock = (name: string, tag: string, extra: Partial<NodeSpec> = {}) => block(name, tag, { content: "inline*", ...extra })

function levelSpec(name: string): NodeSpec {
  const allowed = allowedLevels(name).join(" | ")
  const small = (SMALL_LEVELS as readonly string[]).includes(name)
  return block(name, "section", {
    group: "anyLevel",
    content: name === "level" ? `(num | heading | subheading | ${LEVEL_PARTS} | ${allowed})*` : `num? heading? subheading* (${LEVEL_PARTS} | ${allowed})*`,
    defining: true,
    className: (attrs) => cls("uslm-level", small ? "uslm-small" : name === "section" ? "uslm-primary" : name === "level" ? "uslm-generic" : "uslm-big", name === "level" && attrs.element ? `uslm-${attrs.element}` : null),
  })
}

const BODY = `(anyLevel | content | quotedContent | toc | note | p)*`

export const NODES: Record<string, NodeSpec> = {
  doc: {
    // An engrossed amendment prints its endorsement after the signatures, so the body and the back matter interleave.
    content: `preface? (longTitle | enactingFormula | resolvingClause | preamble)* (anyLevel | content | quotedContent | toc | note | p | signatures | appendix)*`,
    attrs: { element: { default: "bill" }, identifier: { default: null }, expression: { default: null }, dialect: { default: null }, title: { default: null }, fidelity: { default: null } },
  },
  text: { group: "inline" },

  ...Object.fromEntries(LEVELS.map((name) => [name, levelSpec(name)])),

  num: textblock("num", "span", { attrs: { ...BLOCK_ATTRS, value: { default: null } } }),
  heading: textblock("heading", "span"),
  subheading: textblock("subheading", "span"),
  chapeau: textblock("chapeau", "p"),
  continuation: textblock("continuation", "p"),
  proviso: textblock("proviso", "p"),
  crossHeading: textblock("crossHeading", "p"),
  content: block("content", "div", { content: "(p | quotedContent | toc | table | note)+" }),
  p: textblock("p", "p", { attrs: { ...BLOCK_ATTRS, implicit: { default: false } } }),

  quotedContent: block("quotedContent", "blockquote", { content: "(anyLevel | content | chapeau | continuation | toc | table | note | p)+", attrs: { ...BLOCK_ATTRS, origin: { default: null } } }),

  preface: block("preface", "header", { content: "p+" }),
  longTitle: block("longTitle", "div", { content: "(docTitle | officialTitle)+" }),
  docTitle: textblock("docTitle", "p"),
  officialTitle: textblock("officialTitle", "p"),
  enactingFormula: textblock("enactingFormula", "p"),
  resolvingClause: textblock("resolvingClause", "p"),
  preamble: block("preamble", "div", { content: "(recital | p)+" }),
  recital: textblock("recital", "p"),
  signatures: block("signatures", "footer", { content: "(signature | p)+" }),
  signature: textblock("signature", "p"),
  appendix: block("appendix", "section", { content: `${BODY}` }),

  toc: block("toc", "nav", { content: "referenceItem+" }),
  referenceItem: textblock("referenceItem", "p"),
  note: block("note", "aside", { content: "(heading | p | content)+" }),
  table: block("table", "table", { content: "tr+" }),
  tr: block("tr", "tr", { content: "(th | td)+" }),
  th: textblock("th", "th", { attrs: { ...BLOCK_ATTRS, colspan: { default: null }, rowspan: { default: null } } }),
  td: textblock("td", "td", { attrs: { ...BLOCK_ATTRS, colspan: { default: null }, rowspan: { default: null } } }),

  br: { inline: true, group: "inline", selectable: false, toDOM: () => ["br"], parseDOM: [{ tag: "br" }] },
  img: {
    inline: true,
    group: "inline",
    atom: true,
    attrs: { src: { default: null }, alt: { default: null } },
    toDOM: (node) => ["img", { src: node.attrs.src ?? "", alt: node.attrs.alt ?? "" }],
    parseDOM: [{ tag: "img[src]", getAttrs: (dom) => ({ src: (dom as HTMLElement).getAttribute("src"), alt: (dom as HTMLElement).getAttribute("alt") }) }],
  },
}

// Marks stack freely: `inline` sits inside `inline`, a `ref` inside a `quotedText`.
function markSpec(name: string, tag: string, attrs: string[] = []): MarkSpec {
  return {
    excludes: "",
    attrs: Object.fromEntries([...attrs, "class", "xml"].map((a) => [a, { default: null }])),
    toDOM: (mark: Mark): DOMOutputSpec => {
      const out: Record<string, string> = { "data-uslm": name, class: cls(`uslm-${name}`, mark.attrs.class as string | null) }
      for (const a of attrs) if (mark.attrs[a] != null) out[`data-${a.toLowerCase()}`] = String(mark.attrs[a])
      if (mark.attrs.xml) out["data-xml"] = JSON.stringify(mark.attrs.xml)
      if (name === "ref" && typeof mark.attrs.href === "string" && mark.attrs.href.startsWith("/")) out.href = `/workspace/typeset/address${mark.attrs.href}`
      return [tag, out, 0]
    },
    parseDOM: [
      {
        tag: `[data-uslm="${name}"]`,
        getAttrs: (dom) => {
          const el = dom as HTMLElement
          const out: Attrs = {}
          for (const a of [...attrs, "class", "xml"]) {
            const v = el.getAttribute(`data-${a.toLowerCase()}`)
            if (v != null) out[a] = a === "xml" ? JSON.parse(v) : v
          }
          if (out.class) out.class = String(out.class).replace(`uslm-${name}`, "").trim() || null
          return out
        },
      },
    ],
  }
}

export const MARKS: Record<string, MarkSpec> = {
  b: markSpec("b", "b"),
  i: markSpec("i", "i"),
  sub: markSpec("sub", "sub"),
  sup: markSpec("sup", "sup"),
  ins: markSpec("ins", "ins"),
  del: markSpec("del", "del"),
  inline: markSpec("inline", "span"),
  span: markSpec("span", "span"),
  term: markSpec("term", "dfn"),
  shortTitle: markSpec("shortTitle", "span", ["role"]),
  headingText: markSpec("headingText", "span"),
  quotedText: markSpec("quotedText", "q", ["origin"]),
  ref: markSpec("ref", "a", ["href", "idref", "portion"]),
  date: markSpec("date", "time", ["date"]),
  amendingAction: markSpec("amendingAction", "span", ["type"]),
  designator: markSpec("designator", "span"),
  label: markSpec("label", "span"),
}

export const xmlSchema = new Schema({ nodes: NODES, marks: MARKS, topNode: "doc" })

/** Every node and mark name the schema has, for a report that counts what a parse produced. */
export const SCHEMA_NAMES: ReadonlySet<string> = new Set([...Object.keys(NODES), ...Object.keys(MARKS)])
