import { JurisdictionIndex } from "@/components/library/jurisdiction-index"

// The Laws index, on the Bulk Datasets doc's design: a line, then every
// jurisdiction as a link to its own law.
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
