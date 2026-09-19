import { JurisdictionIndex } from "@/components/library/jurisdiction-index"

// The Laws index, on the Bulk Datasets doc's design: every jurisdiction as a
// link to its own law. The "On file today" line that listed each
// jurisdiction's section count went on 2026-09-19 (Brendan), and its query
// with it: every jurisdiction holds law now, so the line only repeated the
// list below it at length.
const title = "Laws"
const description = "The standing law of every jurisdiction — every section, searchable, free to read."

export const metadata = { title, description }

export default function LawsIndexPage() {
  return (
    <JurisdictionIndex
      title={title}
      description={description}
      slug="/laws"
      previous={{ name: "Amendments", url: "/amendments" }}
      next={{ name: "Committees", url: "/committees" }}
      base="/laws"
    />
  )
}
