import { CommitteesList } from "@/components/committees-list"
import { DocsPage } from "@/components/docs-page"

// The committees doc, on the docs shell (components/docs-page.tsx) since
// 2026-09-20; until then it carried a copy of the shell's markup.
const title = "Committees"
const description = "The standing committees of the jurisdiction in scope, each with the bills before it."

export const metadata = { title, description }

export default function CommitteesPage() {
  return (
    <DocsPage title={title} description={description} slug="/committees" previous={{ name: "Laws", url: "/laws" }} next={{ name: "Subjects", url: "/tags" }}>
      <CommitteesList />
    </DocsPage>
  )
}
