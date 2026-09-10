import { DocsPage } from "@/components/docs-page"
import { ReportsList } from "@/components/policy/federal-lists"

const title = "Reports"
const description = "Nonpartisan analysis written for legislators and their staff by CRS, the legislature's own research service."

export const metadata = { title, description }
export const revalidate = 3600

export default function ReportsPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/reports"
      previous={{ name: "Nominations", url: "/nominations" }}
      next={{ name: "The Record", url: "/record" }}
    >
      <ReportsList />
    </DocsPage>
  )
}
