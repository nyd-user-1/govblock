import { layoutBillText } from "@/lib/policy/bill-text-layout"

// One way to print a bill's text in a code block (Brendan, 2026-09-15: "they
// are all still very inconsistent"). Sources set their text for paper: GPO's
// header lines and <DOC> tags, Pennsylvania's centred title page, New York's
// and Indiana's printed line numbers, hard breaks every seventy characters,
// runs of spaces for centring, stray glyphs from a PDF's fonts. This keeps the
// words and drops the paper: no source line numbers or page furniture, no
// centring, no blank lines, every paragraph on one line that the code block
// wraps, and a unit (SEC. 2., (a), (1)) always starting its own line. Inserted
// and struck words keep their {+ +} and [- -] markers.

const BOILERPLATE = [
  /^\[(Congressional Bills|From the U\.S\. Government Publishing Office|Congressional Record|Public Law)[^\]]*\]$/i,
  /^\[[^\]]*\((ih|is|rh|rs|eh|es|eah|eas|enr|pcs|pch|rfs|rfh|rds|rdh|rts|rth|ats|ath|cps|cph|pp|pap)\)\]$/i,
  /^<\/?(DOC|all)>$/i,
  /^[_\-=*]{3,}$/,
  // GPO's XML metadata when a printing was stored as its XML's text.
  /^\d{3} (HR|S|HRES|SRES|HJRES|SJRES|HCONRES|SCONRES) \d+ [A-Z]{2,4}: /,
  /^U\.S\. (House of Representatives|Senate) \d{4}-\d{2}-\d{2}( text\/xml)?$/,
  /^(text\/xml|EN|[A-Z])$/,
  /^Pursuant to Title 17 Section 105 of the United States Code/,
]

// A line that begins a unit rather than continuing the sentence above it.
const UNIT_START =
  /^(\{\+|\[-)?\s*(SEC(TION)?\.?\s|Sec\.\s|Section\s+\d|§|\(\s*[A-Za-z0-9]{1,5}\s*\)|\d+(\.\d+)*\.\s|[A-Z]\.\s|(ARTICLE|Article|CHAPTER|Chapter|TITLE|Title|PART|Part|DIVISION|Division|SUBTITLE|Subtitle)\s|Be it enacted|BE IT ENACTED|The People of the State|Resolved|RESOLVED|WHEREAS|Whereas|AN ACT|A BILL|AN ORDINANCE)/

const TERMINAL = /[.;:!?]["”’)\]]*\s*(\+\}|-\])?$/

// The replacement character, private-use glyphs a PDF font left behind, and control characters other than tab and newline.
const GLYPHS = new RegExp("[\\uFFFD\\uE000-\\uF8FF\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]", "g")

const headingLike = (line: string) => line.length <= 80 && !/[a-z]/.test(line) && /[A-Z]/.test(line)

export function printBillText(raw: string): string {
  const layout = layoutBillText(String(raw ?? ""))
  const lines: string[] = []
  for (const line of layout.lines) {
    if (line.kind === "furniture" || line.kind === "blank") continue
    // GPO quotes ``like this''; print them as quotation marks.
    const text = line.text.replace(GLYPHS, "").replace(/\t/g, " ").replace(/``/g, "“").replace(/''/g, "”").replace(/ {2,}/g, " ").trim()
    if (!text || BOILERPLATE.some((rule) => rule.test(text))) continue
    lines.push(text)
  }
  const out: string[] = []
  for (const line of lines) {
    const prev = out[out.length - 1]
    const joins =
      prev !== undefined &&
      !TERMINAL.test(prev) &&
      (!headingLike(prev) || /,$/.test(prev)) &&
      !UNIT_START.test(line) &&
      (/^[a-z(\d“"'‘$%&,]/.test(line) ||
        /,$/.test(prev) ||
        /\b(and|or|of|the|to|a|an|in|for|by|with|as|that|shall|under|on|at|from)$/i.test(prev) ||
        // A capitalised word carrying on a long sentence ("…Integrated" / "Food and Nutrition Services…").
        (prev.length >= 40 && /[a-z]/.test(prev)))
    if (joins) out[out.length - 1] = `${prev} ${line}`
    else out.push(line)
  }
  return indentByMarker(out).join("\n")
}

const ROMAN = new Set(["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv"])
const SECTION = /^(\{\+|\[-)?\s*(SEC(TION)?\.?\s|Sec\.\s|Section\s+\d|§|(ARTICLE|Article|CHAPTER|Chapter|TITLE|Title|PART|Part|DIVISION|Division|SUBTITLE|Subtitle)\s)/

// Each level two spaces in, the way the XML printer indents by rank: the
// kinds of marker a section uses — (a), (1), (A), (i) — take their depth in
// the order they first appear in it, so Congress's (a)(1)(A)(i) and Ohio's
// (A)(1)(a) both step in the way their own sections do. A paragraph without a
// marker keeps the depth of the unit it follows.
function indentByMarker(lines: string[]): string[] {
  let order: string[] = []
  let depth = 0
  let lastLower = ""
  return lines.map((line) => {
    if (SECTION.test(line)) {
      order = []
      depth = 0
      lastLower = ""
      return line
    }
    const m = /^(?:\{\+|\[-)?\s*\(\s*([A-Za-z0-9]{1,5})\s*\)/.exec(line)
    if (!m) return depth ? `${"  ".repeat(depth)}${line}` : line
    const mark = m[1]
    let kind: string
    if (/^\d+$/.test(mark)) kind = "digit"
    else if (/^[a-z]+$/.test(mark)) {
      const roman = ROMAN.has(mark) && !(mark.length === 1 && lastLower && lastLower.charCodeAt(0) === mark.charCodeAt(0) - 1)
      kind = roman ? "roman" : "lower"
      if (!roman) lastLower = mark
    } else if (/^[A-Z]+$/.test(mark)) kind = mark.length > 1 && /^[IVX]+$/.test(mark) ? "ROMAN" : "upper"
    else kind = "other"
    let at = order.indexOf(kind)
    if (at < 0) {
      order.push(kind)
      at = order.length - 1
    }
    depth = at + 1
    return `${"  ".repeat(depth)}${line}`
  })
}

/** Text the XML printer made, checked for the marks a state's grammar left when it misread the source. */
export function printedLooksParsed(text: string): boolean {
  for (const line of text.split("\n")) {
    if (/^\s*[A-Z]\s*$/.test(line)) return false // a drop cap on its own line
    if (/^\s*\d{1,4} \d/.test(line)) return false // a section number split in two
    if (/^\d{1,2} (That|Be it|The|A |An )/.test(line)) return false // a stray section digit before the enacting words
  }
  return true
}
