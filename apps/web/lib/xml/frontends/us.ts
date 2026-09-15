import { isNode, kids, walk, type FrontEnd, type FrontEndResult, type IrNode, type ParseReport, type Source } from "../ir"
import { parseXml } from "../ir"
import { DTD_TO_USLM, LEVEL_NAMES, isUslm } from "../uslm-elements"
import { parseText } from "./text"

// The federal front end. Two dialects reach the corpus from GovInfo and the
// OLRC: native USLM (the US Code by title, and enrolled bills and public laws
// in the newer schema), which passes through with validation; and the Bill
// DTD the BILLS collection still uses for most printings (enum, header,
// text, quoted-block), which is renamed element by element to USLM's names
// so one reader path draws both. Anything that arrives as plain text (every
// printing before the 113th Congress, LegiScan's captures) takes the text
// front end at the lowest tier.

function dialectOf(top: IrNode | null): "uslm" | "bill-dtd" | "unknown" {
  if (!top) return "unknown"
  const ns = Object.entries(top.attrs).find(([k]) => k === "xmlns" || k.startsWith("xmlns:"))
  if (top.tag === "lawDoc" || top.tag === "uscDoc" || (ns && /uslm/i.test(ns[1]))) return "uslm"
  if (["bill", "resolution", "amendment-doc", "amendment"].includes(top.tag)) return "bill-dtd"
  return "unknown"
}

/**
 * A GovInfo parsable-cite as an address in the scheme of
 * apps/web/docs/xml/schema.md (USLM's path form): usc/42/1437f →
 * /us/usc/t42/s1437f, public-law/117/58 → /us/pl/117/58. Anything else is
 * kept as it came, so nothing is lost and the resolver window can extend it.
 */
export function addressOf(cite: string): string {
  const usc = /^usc\/(\d+[a-z]?)\/(.+)$/i.exec(cite)
  if (usc) return `/us/usc/t${usc[1].toLowerCase()}/s${usc[2].replace(/^s/i, "")}`
  const pl = /^public-law\/(\d+)\/(\d+)$/i.exec(cite)
  if (pl) return `/us/pl/${pl[1]}/${pl[2]}`
  const stat = /^statutes-at-large\/(\d+)\/(\d+)$/i.exec(cite)
  if (stat) return `/us/stat/${stat[1]}/${stat[2]}`
  return cite
}

/** The Bill DTD's names to USLM's, in place, with the chapeau rule. */
function normalize(top: IrNode, renamed: Record<string, number>): IrNode {
  const rename = (n: IrNode) => {
    const isLevel = LEVEL_NAMES.has(n.tag)
    const hasChildLevels = isLevel && kids(n).some((c) => LEVEL_NAMES.has(c.tag))
    let firstText = true
    for (const c of n.children) {
      if (!isNode(c)) continue
      const from = c.tag
      let to = DTD_TO_USLM[from]
      if (from === "text" && isLevel) {
        // The first text of a level that goes on to child levels introduces
        // them: the chapeau. A later one, or one in a leaf, is content.
        to = firstText && hasChildLevels ? "chapeau" : "content"
        firstText = false
      }
      if (from === "external-xref" || from === "internal-xref") {
        const cite = c.attrs["parsable-cite"] ?? c.attrs["idref"]
        if (cite && !c.attrs.href) c.attrs.href = addressOf(cite)
      }
      if (to && to !== from) {
        c.tag = to
        renamed[from] = (renamed[from] ?? 0) + 1
      }
      rename(c)
    }
  }
  const renamedTop = DTD_TO_USLM[top.tag]
  if (renamedTop) {
    renamed[top.tag] = (renamed[top.tag] ?? 0) + 1
    top.tag = renamedTop
  }
  rename(top)
  return top
}

function validate(doc: IrNode, dialect: string, renamed: Record<string, number>, notes: string[]): ParseReport {
  let elements = 0
  let known = 0
  const unknown: Record<string, number> = {}
  walk(doc, (n) => {
    if (n.tag === "#root") return
    elements++
    if (isUslm(n.tag)) known++
    else unknown[n.tag] = (unknown[n.tag] ?? 0) + 1
  })
  return { dialect, elements, known, unknown, renamed, coverage: elements ? known / elements : 0, notes }
}

export function parseUs(source: Source): FrontEndResult {
  if (source.kind === "text") return parseText(source)
  const root = parseXml(source.body)
  const top = kids(root)[0] ?? null
  const dialect = dialectOf(top)
  const renamed: Record<string, number> = {}
  const notes: string[] = []
  if (!top || dialect === "unknown") {
    notes.push(`unrecognised root <${top?.tag ?? "none"}>`)
    return { doc: root, report: validate(root, "unknown", renamed, notes) }
  }
  const doc = dialect === "bill-dtd" ? normalize(top, renamed) : top
  return { doc, report: validate(doc, dialect, renamed, notes) }
}

export const us: FrontEnd = {
  profile: {
    jurisdiction: "US",
    name: "Congress and the United States Code",
    dialects: ["uslm", "bill-dtd", "text"],
    units: [
      { name: "title … subsubitem", uslm: "title … subsubitem", signal: "USLM level elements; in the Bill DTD the same names with <enum> and <header>" },
      { name: "num", uslm: "num", signal: "<num> (USLM) or <enum> (Bill DTD)" },
      { name: "heading", uslm: "heading", signal: "<heading> (USLM) or <header> (Bill DTD)" },
      { name: "chapeau", uslm: "chapeau", signal: "<chapeau>, or the first <text> of a Bill DTD level that has child levels" },
      { name: "continuation", uslm: "continuation", signal: "<continuation>, <continuation-text>, <after-quoted-block>" },
      { name: "quoted content", uslm: "quotedContent", signal: "<quotedContent> or <quoted-block>: the law an amendment quotes" },
      { name: "reference", uslm: "ref", signal: "<ref>, <external-xref parsable-cite>, <internal-xref idref>" },
    ],
  },
  parse: parseUs,
}
