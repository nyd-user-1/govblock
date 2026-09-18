import { DocsPage } from "@/components/docs-page"
import { ReportsList } from "@/components/policy/federal-lists"
import { ReportCards } from "@/components/reports/report-cards"
import { H2 } from "@/components/typeset"

const title = "Reports"
const description = "GovBlock's reports, counted from the record, and the Congressional Research Service's nonpartisan analysis for legislators and their staff."

export const metadata = { title, description }
export const revalidate = 3600

// GovBlock's own reports as cards first (Brendan, 2026-09-17), then the CRS
// reports the page has always listed.
export default function ReportsPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/reports"
      previous={{ name: "Nominations", url: "/nominations" }}
      next={{ name: "The Record", url: "/record" }}
    >
      <ReportCards />
      <H2 id="crs">Congressional Research Service</H2>
      <ReportsList />
    </DocsPage>
  )
}
