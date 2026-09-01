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
      slug="/docs/laws"
      previous={{ name: "The Record", url: "/docs/record" }}
      next={{ name: "Finance", url: "/docs/money" }}
    >
      <LawsList />
    </DocsPage>
  )
}
