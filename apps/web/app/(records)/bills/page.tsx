import { BILLS_PAGE } from "@/components/bills-index"
import { JurisdictionCards } from "@/components/jurisdiction-cards"
import { DocsPage } from "@/components/docs-page"

export const metadata = { title: BILLS_PAGE.title, description: BILLS_PAGE.description }

export default function BillsPage() {
  return (
    <DocsPage {...BILLS_PAGE}>
      <JurisdictionCards base="/bills" />
    </DocsPage>
  )
}
