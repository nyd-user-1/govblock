import { DirectoryList } from "@/components/directory-list"
import { DocsPage } from "@/components/docs-page"

// The members doc, on the docs shell (components/docs-page.tsx) since
// 2026-09-20; until then it carried a copy of the shell's markup.
const title = "Members"
const description = "Every sitting member of the legislature in scope."

export const metadata = { title, description }

export default function DirectoryPage() {
  return (
    <DocsPage title={title} description={description} slug="/members" previous={{ name: "Subjects", url: "/tags" }} next={{ name: "Finance", url: "/money" }}>
      <DirectoryList />
    </DocsPage>
  )
}
