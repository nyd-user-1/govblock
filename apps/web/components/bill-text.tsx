import { layoutBillText, printChangeMarks } from "@/lib/policy/bill-text-layout"
import { cn } from "@govblock/ui/lib/utils"

// A bill's text, the standard way, wherever bill text appears: the bill page,
// the Documents block, the typeset article, the drill-down.
//
// Set the way the Government Publishing Office set it and congress.gov shows
// it: monospace, every space and line break the document's own, the whole
// block centred in its container (Brendan, 2026-09-02: format it as Congress
// does, "the only difference being that you can center it").
//
// Since 2026-09-03 the layout runs through `lib/policy/bill-text-layout`
// first, which is what makes New York, Alabama, Minnesota and Congress read as
// one thing: the document's own line numbers are lifted into a real gutter,
// page furniture is dimmed rather than deleted, invisible characters are gone,
// and an extraction's blank-line-after-every-line artefact is collapsed. The
// body is never re-wrapped, re-indented or re-centred.

// congress.gov writes the version date American-style in parentheses:
// "Introduced in House (08/27/2026)".
function stamp(date?: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date ?? ""))
  return match ? `(${match[2]}/${match[3]}/${match[1]})` : null
}

export function BillText({
  text,
  version,
  date,
  className,
  highlight = null,
}: {
  text: string
  /** "Introduced in House" — drawn above the text, as congress.gov does. */
  version?: string | null
  /** The document's own date, not the night we fetched it. */
  date?: string | null
  className?: string
  /** A zero-based line to highlight — the outline's hover or pick. */
  highlight?: number | null
}) {
  const shown = [version, stamp(date)].filter(Boolean).join(" ")
  const layout = layoutBillText(printChangeMarks(text))
  return (
    <div className={cn("flex w-full justify-center", className)}>
      <div className="w-fit max-w-full">
        {shown && (
          // congress.gov's two bold lines above the text. They are the page's
          // own type, not the document's, which is why they are not in the pre.
          <div className="mb-2 text-sm leading-snug font-bold text-foreground">
            <div>Shown Here:</div>
            <div>{shown}</div>
          </div>
        )}
        <pre data-slot="bill-text" className="m-0 max-w-full overflow-x-auto p-0 font-mono text-[13px] leading-[1.35] whitespace-pre text-foreground">
          {layout.lines.map((line, index) => (
            <div key={index} data-kind={line.kind} data-target={highlight === index || undefined} className="flex data-[kind=furniture]:opacity-40 data-[kind=heading]:font-semibold data-[target]:bg-yellow-300/50">
              {layout.gutter && (
                <span aria-hidden className="shrink-0 pr-4 text-right text-muted-foreground select-none" style={{ width: `${layout.gutterWidth + 4}ch` }}>
                  {line.n ?? ""}
                </span>
              )}
              <span className="min-h-[1.35em]">{line.text}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}
