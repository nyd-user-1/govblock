import { DocsPage } from "@/components/docs-page"
import { RecordList } from "@/components/policy/federal-lists"

const title = "The Record"
const description = "The daily proceedings of both chambers, issue by issue, each with that day's Digest."

export const metadata = { title, description }
export const revalidate = 3600

export default function RecordPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/docs/record"
      previous={{ name: "Reports", url: "/docs/reports" }}
      next={{ name: "Laws", url: "/docs/laws" }}
    >
      <RecordList />
    </DocsPage>
  )
}
