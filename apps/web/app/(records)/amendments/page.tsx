import { DocsPage } from "@/components/docs-page"
import { AmendmentsList } from "@/components/policy/federal-lists"

// The amendments index. Until now an amendment could only be reached from the
// bill it was filed against, so the 7,038 on the record were unfindable unless
// a reader already knew which bill carried the one they wanted.
const title = "Amendments"
const description = "Every amendment filed against a bill, what it would change, who filed it and how far it got."

export const metadata = { title, description }
export const revalidate = 3600

export default function AmendmentsPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/amendments"
      previous={{ name: "Bills", url: "/bills" }}
      next={{ name: "Committees", url: "/committees" }}
    >
      <AmendmentsList />
    </DocsPage>
  )
}
