// Enough XML for a law. No dependency and no document tree: the titles of the
// United States Code run past 100 MB of markup each, and building a node
// object per element would cost more memory than the machine doing the load
// has. Everything here works on the source string and a cursor.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }

export function decode(text) {
  return String(text).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, name) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[name] ?? whole
  })
}

/** The attributes of a start tag, given the whole `<tag ...>` string. */
export function attrs(tag) {
  const out = {}
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = decode(m[2])
  return out
}

/**
 * Where the element opened at `from` ends, counting nesting. Returns the index
 * just past its close tag, or the end of the string if it never closes.
 */
export function endOf(xml, name, from) {
  const open = new RegExp(`<${name}(?=[\\s/>])`, "g")
  const close = new RegExp(`</${name}\\s*>`, "g")
  // A tag that closes itself has no body.
  const first = xml.indexOf(">", from)
  if (first < 0) return xml.length
  if (xml[first - 1] === "/") return first + 1
  let depth = 1
  let at = first + 1
  while (depth > 0) {
    open.lastIndex = at
    close.lastIndex = at
    const nextOpen = open.exec(xml)
    const nextClose = close.exec(xml)
    if (!nextClose) return xml.length
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1
      at = nextOpen.index + 1
      continue
    }
    depth -= 1
    at = nextClose.index + nextClose[0].length
  }
  return at
}

/** The first child element of `name` inside a fragment, as its inner text. */
export function childText(fragment, name) {
  const at = fragment.search(new RegExp(`<${name}(?=[\\s/>])`))
  if (at < 0) return null
  const openEnd = fragment.indexOf(">", at)
  if (fragment[openEnd - 1] === "/") return ""
  const end = endOf(fragment, name, at)
  const closeAt = fragment.lastIndexOf(`</${name}`, end)
  return plain(fragment.slice(openEnd + 1, closeAt))
}

const BLOCK = /<\/?(p|heading|num|chapeau|continuation|subsection|paragraph|subparagraph|clause|subclause|item|subitem|content|section|toc|tocItem|tr|sourceCredit|quotedContent|layout|column)(?=[\s/>])[^>]*>/gi

/**
 * A fragment as prose. Block elements become line breaks, everything else is
 * dropped, and the indentation the source carries for its own printing is
 * normalised — a paragraph is the unit, not a line.
 */
export function plain(fragment) {
  const text = decode(
    String(fragment)
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(BLOCK, "\n")
      .replace(/<[^>]+>/g, "")
  )
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t\r]+/g, " ").trim())
    .filter((line, i, all) => line || (i > 0 && all[i - 1]))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Every region of the given elements cut out, so a scan never sees inside them. */
export function without(xml, names) {
  let out = xml
  for (const name of names) {
    let at = 0
    let next = ""
    const find = new RegExp(`<${name}(?=[\\s/>])`, "g")
    let cursor = 0
    while (true) {
      find.lastIndex = cursor
      const m = find.exec(out)
      if (!m) break
      const end = endOf(out, name, m.index)
      next += out.slice(at, m.index)
      at = end
      cursor = end
    }
    if (at) out = next + out.slice(at)
  }
  return out
}

/**
 * The immediate children of a fragment, in document order.
 *
 * For a document small enough to hold — one section of a code, not a title of
 * the United States Code — walking children is easier to read than scanning
 * for tags and tracking depth by hand.
 */
export function children(fragment) {
  const out = []
  let at = 0
  while (at < fragment.length) {
    const lt = fragment.indexOf("<", at)
    if (lt < 0) break
    const m = /^<([A-Za-z][\w:.-]*)/.exec(fragment.slice(lt, lt + 60))
    if (!m) {
      at = lt + 1
      continue
    }
    const tag = m[1]
    const end = endOf(fragment, tag, lt)
    const openEnd = fragment.indexOf(">", lt)
    const selfClosing = fragment[openEnd - 1] === "/"
    const closeAt = selfClosing ? openEnd + 1 : fragment.lastIndexOf(`</${tag}`, end)
    out.push({
      tag,
      head: fragment.slice(lt, openEnd + 1),
      inner: selfClosing ? "" : fragment.slice(openEnd + 1, closeAt),
    })
    at = end
  }
  return out
}
