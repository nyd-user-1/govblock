import { DocsPage } from "@/components/docs-page"
import { LawsList } from "@/components/policy/federal-lists"

const title = "Laws"
const description = "The public laws of this session, newest first, each with the bill it began as."

export const metadata = { title, description }
export const revalidate = 3600

export default function LawsPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/public-laws"
      previous={{ name: "The Record", url: "/record" }}
      next={{ name: "Finance", url: "/money" }}
    >
      <LawsList />
    </DocsPage>
  )
}
