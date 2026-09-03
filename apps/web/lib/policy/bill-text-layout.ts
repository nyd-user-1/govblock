// The standard layout for a bill's text, whichever legislature printed it.
//
// Every text we hold is a PDF turned into plain text, and each print shop has
// its own habits: New York centres its headings with runs of spaces and numbers
// its lines in a six-column gutter; Alabama and Colorado number theirs too, and
// leave a blank line after every printed one; Minnesota numbers page.line and
// scatters zero-width spaces through the text; Texas fills its blank lines with
// non-breaking spaces; Indiana and Congress print page furniture — form feeds,
// page numbers, "VerDate" footers — between the pages. Rendered as one block
// with every character kept, they look like seven different things.
//
// Brendan, 2026-09-03: standardise the layout, lift the line numbers out into a
// real gutter, dim the furniture — and never re-wrap, re-indent or re-centre
// the body. "It moves things the document placed deliberately, and there's no
// way to know which spaces are layout and which are meaning in a statute."
//
// So every rule here is one of two kinds. A normalisation that cannot change
// what the text says (invisible characters, an extraction artefact that put a
// blank line after every line). Or a recognition — this column is a line
// number, this line is a page footer — that fails safe: a document the rule
// does not recognise is left exactly as it came.

export type LineKind = "body" | "blank" | "furniture" | "heading"

export type LayoutLine = {
  /** The document's own line number — "12", "1.7" — when the document prints one. */
  n: string | null
  /** The line, less the gutter when one was lifted. Every other character as printed. */
  text: string
  kind: LineKind
}

export type Heading = { line: number; label: string }

export type BillLayout = {
  lines: LayoutLine[]
  /** True when the document printed line numbers and they were lifted out. */
  gutter: boolean
  /** Characters the gutter column needs. */
  gutterWidth: number
  /** The lines as one string: what the code view edits and search runs over. */
  text: string
  /** Section headings, by zero-based line, for the outline and for folding. */
  headings: Heading[]
}

// ── Normalisation: characters that print as nothing ─────────────────────────

const ZERO_WIDTH = /\u200b|\u200c|\u200d|\ufeff/g
const NBSP = /\u00a0/g

/** Invisible characters out, non-breaking spaces to spaces, CRLF to LF. */
export function normalizeBillText(raw: string) {
  return String(raw ?? "").replace(/\r\n?/g, "\n").replace(ZERO_WIDTH, "").replace(NBSP, " ")
}

const isBlank = (line: string) => line.trim() === ""

// An extraction that put a blank line after every printed line (Alabama,
// Texas). The pattern is unmistakable — nearly every content line is followed
// by exactly one blank — and the blank carries nothing. Runs of two or more
// blanks are a paragraph break in such a document and collapse to one. A
// document without the pattern is not touched.
function collapseAlternatingBlanks(lines: string[]) {
  const content = lines.filter((l) => !isBlank(l)).length
  const blank = lines.length - content
  // Alabama's sample is 35% blank with half its printed lines followed by one;
  // a paragraph-broken statute (Indiana) is 4% blank. The gap is wide.
  if (lines.length < 12 || blank / lines.length < 0.3) return lines
  let followed = 0
  for (let i = 0; i < lines.length - 1; i++) if (!isBlank(lines[i]) && isBlank(lines[i + 1])) followed++
  if (followed / Math.max(1, content) < 0.5) return lines
  const out: string[] = []
  let run = 0
  for (const line of lines) {
    if (isBlank(line)) {
      run++
      continue
    }
    if (run >= 2 && out.length) out.push("")
    run = 0
    out.push(line)
  }
  return out
}

// ── Recognition: the gutter ─────────────────────────────────────────────────

// A printed line number: up to three digits, or page.line, in the left margin,
// then at least two spaces before the text. "1." with one space (a list item)
// and "(1)" (a subsection) do not match, which is the point.
const NUMBERED = /^(\s{0,8})(\d{1,3}(?:\.\d{1,3})?)(\s{2,}|\s*$)/

function numberValue(n: string) {
  const [page, line] = n.split(".")
  return Number(page) * 1000 + Number(line ?? 0)
}

function detectGutter(lines: string[]) {
  const numbered: { index: number; value: number; prefix: number }[] = []
  let content = 0
  for (let i = 0; i < lines.length; i++) {
    if (isBlank(lines[i])) continue
    content++
    const m = NUMBERED.exec(lines[i])
    if (m) numbered.push({ index: i, value: numberValue(m[2]), prefix: m[1].length + m[2].length + Math.min(m[3].length, 2) })
  }
  if (content < 8 || numbered.length / content < 0.3) return null
  // The numbers must mostly climb. A document that merely starts many lines
  // with a small number and two spaces is not numbered.
  let climbs = 0
  for (let i = 1; i < numbered.length; i++) if (numbered[i].value >= numbered[i - 1].value) climbs++
  if (numbered.length > 1 && climbs / (numbered.length - 1) < 0.7) return null
  const width = Math.min(12, Math.max(...numbered.map((n) => n.prefix)))
  return { width }
}

// ── Recognition: furniture ──────────────────────────────────────────────────

const FURNITURE = [
  /^\s*Page\s+\d+\s*$/i, // Alabama
  /^\s*VerDate\b/, // Congress (GPO)
  /^\s*[A-Z]{2,4}\s+\d{1,5}\s+—\s+[A-Z]{1,3}\s+\d+\s*$/, // Indiana: "HEA 1210 — CC 1"
  /^\s*(\/\/|\/\*|\*\/|function\s|var\s|if\s*\(|\}\s*$|html\s*\{|window\.|top\.location|document\.getElementById)/, // a scraped page's script (California)
]
const PAGE_NUMBER = /^\s*\d{1,4}\s*$/

// ── Recognition: headings ───────────────────────────────────────────────────

const HEADING = /^\s*(?:(SECTION|Section|Sec\.|§|ARTICLE|Article|CHAPTER|Chapter|TITLE|Title|PART|Part|Subdivision|SUBDIVISION)\s*(\d+[A-Za-z]?(?:\.\d+)*)|(WHEREAS|RESOLVED|BE IT ENACTED|BE IT RESOLVED|AN ACT|A BILL)\b)/

export function layoutBillText(raw: string): BillLayout {
  const normalized = normalizeBillText(raw).replace(/\s+$/, "")
  const lines = collapseAlternatingBlanks(normalized.split("\n"))
  const gutter = detectGutter(lines)
  const out: LayoutLine[] = []
  const headings: Heading[] = []
  let afterFormFeed = false

  for (const original of lines) {
    let line = original
    let kind: LineKind = "body"
    let n: string | null = null

    // A form feed is a page break: the line it sits on is the top of a page,
    // and what follows it on that line (a running head) is furniture.
    if (line.includes("\f")) {
      line = line.replace(/\f/g, "")
      kind = "furniture"
      afterFormFeed = true
    } else if (afterFormFeed && PAGE_NUMBER.test(line)) {
      kind = "furniture"
      afterFormFeed = false
    } else if (!isBlank(line)) {
      afterFormFeed = false
    }

    if (isBlank(line)) {
      out.push({ n: null, text: "", kind: kind === "furniture" ? "furniture" : "blank" })
      continue
    }

    if (kind !== "furniture" && FURNITURE.some((rule) => rule.test(line))) kind = "furniture"

    if (gutter) {
      const m = NUMBERED.exec(line)
      if (m) {
        n = m[2]
        line = line.slice(m[1].length + m[2].length + Math.min(m[3].length, 2))
      } else if (/^\s+/.test(line)) {
        // An unnumbered line — a heading, a title — printed across the gutter
        // column. Take the same columns off it so it stays aligned with the
        // body; a line indented less than the gutter is left alone.
        const leading = /^\s*/.exec(line)![0].length
        if (leading >= gutter.width) line = line.slice(gutter.width)
      }
    }

    if (kind === "body") {
      const h = HEADING.exec(line)
      if (h) {
        kind = "heading"
        if (h[1]) headings.push({ line: out.length, label: `${h[1]} ${h[2]}`.replace(/\s+/g, " ") })
      }
    }

    out.push({ n, text: line, kind })
  }

  // Trailing blanks say nothing.
  while (out.length && out[out.length - 1].kind === "blank") out.pop()

  return {
    lines: out,
    gutter: !!gutter,
    gutterWidth: gutter ? Math.max(2, ...out.map((l) => (l.n ? l.n.length : 0))) : 0,
    text: out.map((l) => l.text).join("\n"),
    headings: headings.slice(0, 2000),
  }
}

// LegiScan encodes an amended text's changes as {+added+} and [-deleted-].
// Printed, additions read as text and deletions in brackets, which is how a
// printed bill shows them. The code view keeps the marks and colours them.
export const CHANGE_MARK = /\{\+([\s\S]*?)\+\}|\[-([\s\S]*?)-\]/g

export function printChangeMarks(text: string) {
  return text.replace(CHANGE_MARK, (_, added, deleted) => (added !== undefined ? added : `[${deleted}]`))
}
