import { JurisdictionIndex } from "@/components/library/jurisdiction-index"

// The Bulk Datasets doc: a session at a time, as a file, one page per
// jurisdiction (Brendan, 2026-09-05: "dataset/new-york/2025/bills").
const title = "Bulk Datasets"
const description = "A session at a time, as a file: bills, sponsors, members, committees, roll calls, votes and history, as JSON or CSV."

export const metadata = { title, description }

export default function DatasetsIndexPage() {
  return (
    <JurisdictionIndex
      title={title}
      description={description}
      slug="/docs/datasets"
      previous={{ name: "API", url: "/docs/api" }}
      next={{ name: "Bills", url: "/docs/bills" }}
      base="/docs/datasets"
    >
    </JurisdictionIndex>
  )
}
