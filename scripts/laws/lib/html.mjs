// Enough HTML for a law. The same bargain xml.mjs makes: no document tree, no
// dependency, everything on the source string — because a state that publishes
// its code as one file per chapter publishes some chapters at a megabyte, and
// a node object per element costs more than the box has.

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  sect: "§",
  para: "¶",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  deg: "°",
  middot: "·",
  bull: "•",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  ldquor: "„",
  eacute: "é",
  times: "×",
}

export function decode(text) {
  return String(text).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, name) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[name] ?? whole
  })
}

const CUT = /<(script|style|noscript|head|svg)\b[\s\S]*?<\/\1\s*>/gi
const BREAK = /<\/?(p|div|br|li|tr|h[1-6]|blockquote|section|article|table|ul|ol|dd|dt|pre)\b[^>]*>/gi

// A tag, counting its quoted attribute values rather than stopping at the
// first `>`. Wisconsin's chapter list carries a whole escaped anchor inside a
// `data-pdf-link="…"` attribute, raw `>` characters and all, and a stripper
// that ends a tag at the first `>` spills the attribute into the prose.
const TAG = /<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?)*\s*\/?>/g

/**
 * A fragment as prose: block elements become breaks, everything else goes, and
 * the wrapping a publisher keeps for its own printing is dropped so that a
 * paragraph is the unit a reader gets.
 */
export function text(fragment, { keepIndent = false } = {}) {
  const stripped = decode(
    String(fragment)
      .replace(CUT, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(BREAK, "\n")
      .replace(TAG, "")
      .replace(/<[^>]+>/g, "")
  )
  return stripped
    .split("\n")
    .map((line) => (keepIndent ? line.replace(/\s+$/, "").replace(/\t/g, "    ") : line.replace(/\s+/g, " ").trim()))
    .filter((line, i, all) => line.trim() || (i > 0 && all[i - 1].trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** One line of prose — a heading, a catchline — with every break flattened. */
export function line(fragment) {
  return text(fragment).replace(/\s*\n\s*/g, " ").trim()
}

/**
 * Every match of a tag, as `{ head, inner, index, end }`, without building a
 * tree. Nesting of the same tag is counted, so a `<div>` inside a `<div>`
 * closes the right one.
 */
export function* elements(html, tag, attribute) {
  const open = new RegExp(`<${tag}(?=[\\s/>])[^>]*>`, "gi")
  let m
  while ((m = open.exec(html))) {
    const head = m[0]
    if (attribute && !attribute.test(head)) continue
    if (head.endsWith("/>")) {
      yield { head, inner: "", index: m.index, end: m.index + head.length }
      continue
    }
    const end = closeOf(html, tag, m.index + head.length)
    yield { head, inner: html.slice(m.index + head.length, end.at), index: m.index, end: end.past }
    open.lastIndex = end.past
  }
}

function closeOf(html, tag, from) {
  const find = new RegExp(`<(/?)${tag}(?=[\\s/>])[^>]*>`, "gi")
  find.lastIndex = from
  let depth = 1
  let m
  while ((m = find.exec(html))) {
    if (m[0].endsWith("/>")) continue
    depth += m[1] ? -1 : 1
    if (depth === 0) return { at: m.index, past: m.index + m[0].length }
  }
  return { at: html.length, past: html.length }
}

/** The attributes of a start tag. */
export function attrs(head) {
  const out = {}
  for (const m of String(head).matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s">]+))/g)) {
    out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? m[5] ?? "")
  }
  return out
}

/**
 * A test for one class on a start tag, whichever way the publisher quotes its
 * attributes — West Virginia writes `class='sectiontext hid'` and Florida
 * writes `class="Section"`, and both are the same thing.
 */
export const hasClass = (name) => new RegExp(`class\\s*=\\s*["'][^"']*\\b${name}\\b[^"']*["']`, "i")

/** Every `<a href>` in a fragment, as `{ href, text }`, in document order. */
export function links(html, base) {
  const out = []
  for (const a of elements(html, "a")) {
    const href = attrs(a.head).href
    if (!href || /^(#|javascript:|mailto:)/i.test(href)) continue
    out.push({ href: base ? new URL(href, base).toString() : href, text: line(a.inner) })
  }
  return out
}

/** Everything between two indexes of the source, as prose. */
export const between = (html, from, to) => text(html.slice(from, to))
