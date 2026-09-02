import { cn } from "@govblock/ui/lib/utils"

// A bill's text, set the way the Government Publishing Office set it and
// congress.gov shows it: one `<pre>`, monospace, every space and line break the
// document's own.
//
// It used to be two things at once — a "preview" that drew only the title page,
// with our own centring and bold applied line by line on top of the text's, and
// a "View Code" strip beneath that repeated the whole bill as numbered code
// lines. Brendan, 2026-09-02: format it as Congress does
// (https://www.congress.gov/bill/119th-congress/house-bill/10150/text/ih?format=txt),
// "the only difference being that you can center it".
//
// So: no re-wrapping, no re-indenting, no per-line rules of our own — the
// document already centres its own headings with spaces, and re-centring them
// moved them. And no code strip: bill text is not code.
//
// The one permitted difference is that the whole block is centred in its
// container rather than sitting against the left margin.

// LegiScan encodes an amended text's changes as {+added+} and [-deleted-].
// congress.gov's .txt has no such markers; printing the encoding raw would be
// verbatim about the transport and wrong about the document. Additions read as
// text, deletions in brackets, which is how a printed bill shows them.
const MARKER = /\{\+([\s\S]*?)\+\}|\[-([\s\S]*?)-\]/g
const printed = (text: string) =>
  text.replace(/\r/g, "").replace(MARKER, (_, added, deleted) => (added !== undefined ? added : `[${deleted}]`))

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
}: {
  text: string
  /** "Introduced in House" — drawn above the text, as congress.gov does. */
  version?: string | null
  /** The document's own date, not the night we fetched it. */
  date?: string | null
  className?: string
}) {
  const shown = [version, stamp(date)].filter(Boolean).join(" ")
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
        <pre
          data-slot="bill-text"
          className="m-0 max-w-full overflow-x-auto p-0 font-mono text-[13px] leading-[1.35] whitespace-pre text-foreground"
        >
          {printed(text)}
        </pre>
      </div>
    </div>
  )
}
