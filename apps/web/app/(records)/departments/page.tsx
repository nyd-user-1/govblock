import { DocsPage } from "@/components/docs-page"
import { DepartmentsList } from "@/components/policy/departments-list"

// The departments doc: every department, agency and authority of the
// jurisdiction in scope, each with a page of its own (Brendan, 2026-09-06).
const title = "Departments"
const description = "The departments, agencies and authorities of the jurisdiction in scope — what each does, its budget, the bills that name it, its nominations and its forms."

export const metadata = { title, description }
export const revalidate = 3600

export default function DepartmentsPage() {
  return (
    <DocsPage title={title} description={description} slug="/departments" previous={{ name: "Committees", url: "/committees" }} next={{ name: "Hearings", url: "/hearings" }}>
      <DepartmentsList />
    </DocsPage>
  )
}
