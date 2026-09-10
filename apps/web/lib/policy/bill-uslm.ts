// A bill as the Government Publishing Office writes it, turned into the HTML
// the Typeset editor reads (Brendan, 2026-09-10). "Documents".url carries the
// USLM XML for every federal document GovInfo publishes, and USLM already has
// the structure a reader wants: a section carries an <enum> and a <header>,
// then <text>, then the levels beneath it. Handing that structure over as
// headings and paragraphs is the whole point of the editor — the flat text we
// store is the same document with its tags thrown away, so a bill built from
// it can only ever be a wall of preformatted lines.
//
// No XML dependency: USLM is well-formed, so a small recursive reader is
// enough and it costs nothing at install time.

import { esc } from "@/lib/policy/bill-html"

type Node = { tag: string; attrs: Record<string, string>; children: Child[] }
type Child = string | Node

const VOID = /\/\s*>$/

/** USLM, as a tree. Comments, the prolog and the doctype are skipped. */
export function parseXml(xml: string): Node {
  const src = xml
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?[^>]*>/g, "")
  const root: Node = { tag: "#root", attrs: {}, children: [] }
  const stack: Node[] = [root]
  let i = 0
  while (i < src.length) {
    const lt = src.indexOf("<", i)
    if (lt < 0) {
      pushText(stack[stack.length - 1], src.slice(i))
      break
    }
    if (lt > i) pushText(stack[stack.length - 1], src.slice(i, lt))
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
    const node: Node = { tag: m[1], attrs: attrsOf(m[2]), children: [] }
    stack[stack.length - 1].children.push(node)
    if (!VOID.test(raw)) stack.push(node)
  }
  return root
}

function pushText(parent: Node, text: string) {
  if (text) parent.children.push(text)
}

function attrsOf(rest: string) {
  const attrs: Record<string, string> = {}
  const re = /([\w:.-]+)\s*=\s*"([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(rest))) attrs[m[1]] = m[2]
  return attrs
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", ldquo: "“", rdquo: "”",
  lsquo: "‘", rsquo: "’", hellip: "…", sect: "§",
}

function decode(text: string) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, body: string) => {
    if (body[0] === "#")
      return String.fromCodePoint(
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10)
      )
    return ENTITIES[body] ?? all
  })
}

const find = (node: Node, tag: string) =>
  node.children.find(
    (c): c is Node => typeof c !== "string" && c.tag === tag
  ) ?? null

const kids = (node: Node) =>
  node.children.filter((c): c is Node => typeof c !== "string")

/** Everything under a node as one run of words, tags dropped. */
function plain(node: Child): string {
  if (typeof node === "string") return decode(node)
  return node.children.map(plain).join("")
}

const tidy = (text: string) => text.replace(/\s+/g, " ").trim()

// ---------------------------------------------------------------- inline ---

/** A <text> or <header>'s own markup, as the small set of tags a reader wants. */
function inline(node: Child): string {
  if (typeof node === "string") return esc(decode(node))
  const inner = node.children.map(inline).join("")
  switch (node.tag) {
    case "quote":
      return `“${inner}”`
    case "term":
    case "italic":
    case "emphasis":
      return `<em>${inner}</em>`
    case "bold":
      return `<strong>${inner}</strong>`
    case "external-xref": {
      const href = xrefHref(node)
      return href ? `<a href="${esc(href)}">${inner}</a>` : inner
    }
    case "linebreak":
      return " "
    default:
      return inner
  }
}

/** Where a citation points, when it is one we can address. */
function xrefHref(node: Node) {
  const cite = node.attrs["parsable-cite"]
  if (!cite) return null
  const usc = /^usc\/(\d+)\/(.+)$/.exec(cite)
  if (usc) return `https://www.law.cornell.edu/uscode/text/${usc[1]}/${usc[2]}`
  const pl = /^public-law\/(\d+)\/(\d+)$/.exec(cite)
  if (pl) return `https://www.congress.gov/${pl[1]}/plaws/publ${pl[2]}`
  return null
}

const html = (node: Child) => tidy(inline(node))

// ----------------------------------------------------------------- levels ---

// How deep a level sits. A section is an <h2> because the bill's number is the
// page's <h1>; everything under it steps down one, and nothing goes past <h6>
// because there is no <h7> — the deepest clauses lead with their number in
// bold instead, which is how the printed bill reads anyway.
const LEVEL: Record<string, number> = {
  division: 2, title: 2, subtitle: 2, chapter: 2, subchapter: 2, part: 2,
  subpart: 2, section: 2, subsection: 3, paragraph: 4, subparagraph: 5,
  clause: 6, subclause: 6, item: 6, subitem: 6, subsubitem: 6,
}

const CONTAINER = new Set([
  "quoted-block", "toc", "legis-body", "resolution-body", "amendment-block",
  "amendment", "appropriations-major", "appropriations-intermediate",
])

function level(node: Node, depth: number): string {
  const rank = Math.min(6, (LEVEL[node.tag] ?? 4) + depth)
  const enumNode = find(node, "enum")
  const headerNode = find(node, "header")
  const label = enumNode ? tidy(plain(enumNode)) : ""
  const out: string[] = []

  if (headerNode) {
    const heading = [label, html(headerNode)].filter(Boolean).join(" ")
    if (heading) out.push(`<h${rank}>${heading}</h${rank}>`)
  }

  // With no header of its own, the level leads its first paragraph with its
  // number, so "(i) such qualified net disaster loss, and" stays one thought.
  let lead = headerNode || !label ? "" : `<strong>${esc(label)}</strong> `
  for (const child of kids(node)) {
    if (child.tag === "enum" || child.tag === "header") continue
    if (child.tag === "text") {
      const body = html(child)
      out.push(`<p>${lead}${body}</p>`)
      lead = ""
      continue
    }
    out.push(render(child, depth))
  }
  if (lead) out.push(`<p>${lead.trim()}</p>`)
  return out.join("")
}

function render(node: Node, depth: number): string {
  if (node.tag in LEVEL) return level(node, depth)
  switch (node.tag) {
    case "text":
    case "continuation-text": {
      const body = html(node)
      return body ? `<p>${body}</p>` : ""
    }
    case "header": {
      const body = html(node)
      return body ? `<h${Math.min(6, 3 + depth)}>${body}</h${Math.min(6, 3 + depth)}>` : ""
    }
    // An amendment quotes the law it is changing. A blockquote is exactly that,
    // and it keeps the quoted text from reading as the bill's own words.
    case "quoted-block": {
      const inner = kids(node)
        .filter((c) => c.tag !== "after-quoted-block")
        .map((c) => render(c, depth + 1))
        .join("")
      return `<blockquote>${inner}</blockquote>`
    }
    case "after-quoted-block":
      return ""
    case "toc":
      return kids(node).map((c) => render(c, depth)).join("")
    case "toc-entry":
      return `<p>${html(node)}</p>`
    case "attestation-date":
    case "attestor":
    case "role": {
      const body = html(node)
      return body ? `<p>${body}</p>` : ""
    }
    case "enum":
      return ""
    default: {
      if (CONTAINER.has(node.tag) || node.children.some((c) => typeof c !== "string"))
        return kids(node).map((c) => render(c, depth)).join("")
      const body = html(node)
      return body ? `<p>${body}</p>` : ""
    }
  }
}

// ---------------------------------------------------------------- document ---

export type BillDocument = { title: string | null; html: string }

/** A GovInfo USLM document as headings, paragraphs and quoted amendments. */
export function uslmToHtml(xml: string): BillDocument | null {
  const root = parseXml(xml)
  const bill =
    kids(root).find((c) => c.tag === "bill" || c.tag === "resolution") ??
    kids(root)[0]
  if (!bill) return null

  const out: string[] = []
  const form = find(bill, "form")
  const official = form ? find(form, "official-title") : null
  if (official) out.push(`<p>${html(official)}</p>`)

  const body = kids(bill).filter(
    (c) => c.tag === "legis-body" || c.tag === "resolution-body"
  )
  for (const b of body) out.push(...kids(b).map((c) => render(c, 0)))

  const attestation = find(bill, "attestation")
  if (attestation) out.push(render(attestation, 0))

  const cleaned = out.join("").replace(/<p>\s*<\/p>/g, "")
  if (!cleaned) return null
  const legis = form ? find(form, "legis-num") : null
  return { title: legis ? tidy(plain(legis)) : null, html: cleaned }
}

// ------------------------------------------------------------- flat text ---

// Not every document has USLM behind it: LegiScan's own captures and most
// state bills reach us as plain text. That text is still a bill, so it still
// has numbered levels — this reads them back rather than surrendering the
// document to one preformatted block.

const ENUM_ONLY =
  /^\(?(?:\d{1,3}|[A-Za-z]{1,3}|[ivxlcdmIVXLCDM]{1,6})\)?\.?$/

/** A line that names a level and nothing else. */
const isEnum = (line: string) => ENUM_ONLY.test(line) && line.length <= 8

/** A line short enough, and unpunctuated enough, to be a level's title. */
const looksLikeHeader = (line: string) =>
  line.length <= 90 && !/[.,;:—–]$/.test(line) && !/\b(and|or|of|the|to)$/i.test(line)

// A state bill arrives set to a fixed column width, so words are broken across
// lines with a hyphen ("ASSEM-\nBLY"). Rejoining them before the lines are
// collapsed is the difference between a sentence and a rash of stray hyphens.
const dehyphenate = (text: string) => text.replace(/([A-Za-z])-\n\s*([A-Za-z])/g, "$1$2")

// Where a level begins inside a run of prose: a section sign, or a
// parenthesised number or letter opening a new thought after a full stop or a
// semicolon. Splitting there is what gives a state bill its paragraphs, since
// nothing in the stored text marks them.
const LEVEL_BREAK = /(?<=[.;])\s+(?=(?:§\s*\d|\([0-9A-Za-z]{1,4}\)\s+[A-Z(]))/g

export function plainTextHtml(text: string): string {
  const blocks = dehyphenate(text)
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .flatMap((b) => b.split(LEVEL_BREAK))
    .map((b) => b.trim())
    .filter(Boolean)
  const out: string[] = []
  let pending = ""
  for (const block of blocks) {
    if (isEnum(block)) {
      if (pending) out.push(`<p><strong>${esc(pending)}</strong></p>`)
      pending = block
      continue
    }
    if (pending) {
      out.push(
        looksLikeHeader(block)
          ? `<h3>${esc(pending)} ${esc(block)}</h3>`
          : `<p><strong>${esc(pending)}</strong> ${esc(block)}</p>`
      )
      pending = ""
      continue
    }
    out.push(`<p>${esc(block)}</p>`)
  }
  if (pending) out.push(`<p><strong>${esc(pending)}</strong></p>`)
  return out.join("")
}

// ------------------------------------------------------------- fetching ---

const XML_URL = /\.xml($|\?)/i

/** GovInfo's copy of a document, when the record points at one. */
export async function fetchUslm(url: string | null | undefined) {
  if (!url || !XML_URL.test(url)) return null
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "govblock (+https://govblock.app)" },
      // The published text of a bill version never changes, so a day is
      // conservative and keeps GovInfo out of the request path.
      next: { revalidate: 86_400 },
    })
    if (!response.ok) return null
    return uslmToHtml(await response.text())
  } catch (error) {
    console.error("uslm: could not read", url, error)
    return null
  }
}
