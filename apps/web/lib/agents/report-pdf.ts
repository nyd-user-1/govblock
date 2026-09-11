import { sourceOf, stagesOf } from "@/lib/agents/trace-steps"
import type { Step } from "@/lib/agents/run-client"

// The report as paper, set in the browser.
//
// It is set here rather than on a server because this app runs on Amplify
// WEB_COMPUTE, which has no Chrome and no way to get one — a headless renderer
// is not a dependency this deployment can hold. jsPDF and its table plugin are
// already here for a member's voting record (components/policy/vote-record-pdf),
// they are loaded on demand rather than in the bundle, and the reader's own
// machine is where the file was going to end up anyway.
//
// What it sets is the markdown the agent wrote: headings, paragraphs, lists,
// and the pipe tables, which are the part a report actually needs to look like
// a report. Nothing is re-authored — the same words that are in the reading
// pane are in the file, which is the only way the two cannot disagree.
//
// The file is not stored. A blob URL does not survive a reload and a data URL
// of a ten-page report would eat the inbox's whole localStorage budget, so the
// attachment records what the file is and the file is made again the moment
// someone asks for it. That is honest in a way a dead link is not.

export type BuiltReport = { blob: Blob; pages: number; bytes: number; filename: string }

const MARGIN = 54
const BODY = 10
const LEAD = 13.5

const ROW = /^\s*\|(.+)\|\s*$/
const DIVIDER = /^\s*\|[\s:|-]+\|\s*$/
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g

// Markdown's punctuation, removed. A PDF has no asterisks in it.
//
// Bold is matched lazily rather than by "anything but an asterisk", because the
// agents nest — "**H.R. 155, *Let America Vote Act*, 119th Congress**" — and a
// greedy-safe character class stops at the inner emphasis and leaves the stars
// on the page.
function plain(text: string) {
  return text
    .replace(LINK, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/<\/?u>/g, "")
    .trim()
}

/** Under Sources a link is the citation, so the address is set with the label. */
function cited(text: string) {
  return plain(text.replace(LINK, (_, label: string, url: string) => `${label} — ${url}`))
}

function cells(line: string) {
  return (ROW.exec(line)?.[1] ?? "").split("|").map((cell) => plain(cell))
}

function slug(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "report"
  )
}

export function reportFilename(subject: string, at: number) {
  const day = new Date(at).toISOString().slice(0, 10)
  return `${slug(subject)}-${day}.pdf`
}

/** "PDF · 6 pages · 128 KB", which is what a mail client shows on a file. */
export function attachmentMeta(built: { pages: number; bytes: number }) {
  const size = built.bytes < 1024 * 1024 ? `${Math.max(1, Math.round(built.bytes / 1024))} KB` : `${(built.bytes / 1024 / 1024).toFixed(1)} MB`
  return `PDF · ${built.pages} page${built.pages === 1 ? "" : "s"} · ${size}`
}

/** A Trace Report's stages, as the text that goes above its report. */
function traceText(steps: Step[], body: string) {
  const { opening, stages, report } = stagesOf(steps, body)
  const lines: string[] = []
  if (opening) lines.push(opening, "")
  stages.forEach((stage, index) => {
    const labels = [...new Set(stage.tools.map((tool) => sourceOf(tool.name).label))]
    lines.push(`### ${index + 1}. ${labels.join(", ")} × Clerk`)
    for (const tool of stage.tools) {
      lines.push(`- ${tool.name} — ${tool.summary ?? "no result"}`)
    }
    if (stage.reasoning) lines.push("", `**Reasoning.** ${stage.reasoning}`)
    if (stage.output) lines.push("", `**Output.** ${stage.output}`)
    lines.push("")
  })
  lines.push("## Report", "", report)
  return lines.join("\n")
}

export async function buildReport({
  subject,
  reportType,
  body,
  steps,
  at,
}: {
  subject: string
  reportType?: string
  body: string
  steps?: Step[]
  at: number
}): Promise<BuiltReport> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
  const doc = new jsPDF({ unit: "pt", format: "letter" })
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const measure = width - MARGIN * 2
  let y = MARGIN + 18

  const room = (needed: number) => {
    if (y + needed <= height - MARGIN - 18) return
    doc.addPage()
    y = MARGIN
  }

  const write = (text: string, { size = BODY, bold = false, gap = LEAD, indent = 0, grey = false } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setFontSize(size)
    doc.setTextColor(grey ? 110 : 20)
    for (const line of doc.splitTextToSize(text, measure - indent) as string[]) {
      room(gap)
      doc.text(line, MARGIN + indent, y)
      y += gap
    }
    doc.setTextColor(20)
  }

  // The masthead, once: the mark, who made it, what shape it is, and when.
  // The mark is Icons.logo redrawn in lines — three blocks in the flag's blue
  // as one L, the top-right block in its red — at 14pt on the baseline.
  {
    const s = 14 / 24
    const ox = MARGIN
    const oy = MARGIN - 11
    doc.setLineWidth(2 * s)
    doc.setLineCap("round")
    doc.setLineJoin("round")
    doc.setDrawColor(10, 49, 97)
    doc.roundedRect(ox + 2 * s, oy + 6 * s, 16 * s, 16 * s, 2 * s, 2 * s, "S")
    doc.line(ox + 10 * s, oy + 22 * s, ox + 10 * s, oy + 6 * s)
    doc.line(ox + 2 * s, oy + 14 * s, ox + 18 * s, oy + 14 * s)
    doc.setDrawColor(179, 25, 66)
    doc.roundedRect(ox + 14 * s, oy + 2 * s, 8 * s, 8 * s, 1 * s, 1 * s, "S")
    doc.setDrawColor(0)
  }
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("GovBlocks", MARGIN + 19, MARGIN)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(110)
  doc.text(
    [`Clerk`, reportType ?? "Report", new Date(at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })].join(" · "),
    width - MARGIN,
    MARGIN,
    { align: "right" }
  )
  doc.setTextColor(20)

  const source = (reportType === "Trace Report" && steps?.length ? traceText(steps, body) : body).split("\n")
  // Under Sources a link's address is set beside its label; everywhere else the
  // label alone is what a sentence wants.
  let sourcing = false

  for (let i = 0; i < source.length; i += 1) {
    const line = source[i] ?? ""

    // A pipe table is the one shape that spans lines, so it is taken whole.
    if (ROW.test(line)) {
      let end = i
      while (end + 1 < source.length && ROW.test(source[end + 1] ?? "")) end += 1
      const rows = source.slice(i, end + 1).filter((row) => !DIVIDER.test(row))
      if (rows.length >= 2) {
        const [head, ...rest] = rows
        room(60)
        autoTable(doc, {
          startY: y,
          margin: { left: MARGIN, right: MARGIN },
          head: [cells(head)],
          body: rest.map(cells),
          styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak", valign: "top", textColor: 20 },
          headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [247, 247, 248] },
        })
        y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 16
        i = end
        continue
      }
    }

    if (!line.trim()) {
      y += 6
      continue
    }
    // No decorative rules on paper, the same as on screen.
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) continue

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const text = plain(heading[2])
      sourcing = /^sources\b/i.test(text)
      y += level === 1 ? 12 : 10
      room(level === 1 ? 30 : 22)
      write(text, { size: level === 1 ? 18 : level === 2 ? 13 : 11, bold: true, gap: level === 1 ? 22 : 16 })
      y += level === 1 ? 4 : 2
      continue
    }

    const quote = /^\s*>\s?(.*)$/.exec(line)
    if (quote) {
      write(plain(quote[1]), { indent: 18, grey: true })
      continue
    }

    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line)
    const numbered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      const depth = Math.floor((bullet ? bullet[1] : numbered![1]).length / 2)
      const mark = bullet ? "•" : `${numbered![2]}.`
      const text = bullet ? bullet[2] : numbered![3]
      const indent = 14 + depth * 14
      room(LEAD)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(BODY)
      doc.text(mark, MARGIN + depth * 14, y)
      write(sourcing ? cited(text) : plain(text), { indent })
      continue
    }

    write(sourcing ? cited(line) : plain(line))
  }

  // Page numbers last, when the count is known.
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(130)
    doc.text(`${subject} · ${page} of ${pages}`, MARGIN, height - 28)
    doc.setTextColor(20)
  }

  const blob = doc.output("blob") as Blob
  return { blob, pages, bytes: blob.size, filename: reportFilename(subject, at) }
}

// One report built is one report kept, for as long as the tab lives: the card
// is drawn with the page count and the size, and a click should not spend two
// seconds setting the same pages again. A reload empties this and the file is
// built afresh, which is the whole reason nothing is stored.
const made = new Map<string, BuiltReport>()

export async function reportFor(key: string, args: Parameters<typeof buildReport>[0]) {
  const kept = made.get(key)
  if (kept) return kept
  const built = await buildReport(args)
  made.set(key, built)
  return built
}

/** Hand the reader the file, by the name the card shows. */
export function save(built: BuiltReport) {
  const url = URL.createObjectURL(built.blob)
  const link = document.createElement("a")
  link.href = url
  link.download = built.filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
