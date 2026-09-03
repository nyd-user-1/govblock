import { DocsPage } from "@/components/docs-page"
import { NominationsList } from "@/components/policy/federal-lists"

// The Senate's confirmation docket. The description avoids naming the
// legislature: this shell is prerendered once and shared by every reader, so
// anything in it is what a reader who asked for Texas sees before the scope
// resolves. The page names itself in the body, once it knows who is asking.
const title = "Nominations"
const description = "The Senate's confirmation docket — who was sent up, for what office, and where it stands."

export const metadata = { title, description }
export const revalidate = 3600

export default function NominationsPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/docs/nominations"
      previous={{ name: "Members", url: "/docs/directory" }}
      next={{ name: "Reports", url: "/docs/reports" }}
    >
      <NominationsList />
    </DocsPage>
  )
}
