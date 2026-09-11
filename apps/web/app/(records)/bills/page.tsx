import { JurisdictionCards } from "@/components/jurisdiction-cards"
import { DocsPage } from "@/components/docs-page"

// /bills (Brendan, 2026-09-11): the jurisdictions, each a flag card opening its
// own bills page — /bills/us, /bills/ny — since the record is scoped per
// jurisdiction and one list under "the jurisdiction in scope" hid that.
const title = "Bills"
const description = "Every jurisdiction with a record: Congress, the fifty states and the District, each with its bills and their full text."

export const metadata = { title, description }

export default function BillsPage() {
  return (
    <DocsPage title={title} description={description} slug="/bills" next={{ name: "Amendments", url: "/amendments" }}>
      <JurisdictionCards base="/bills" />
    </DocsPage>
  )
}
