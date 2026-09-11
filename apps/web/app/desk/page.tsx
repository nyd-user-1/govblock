import { DocsPage } from "@/components/docs-page"
import { JurisdictionCards } from "@/components/jurisdiction-cards"

// /desk (Brendan, 2026-09-11; /newsroom until then): the desks, one per
// jurisdiction, each a flag card opening /desk/us, /desk/ny.
const title = "Desk"
const description = "What each legislature did, newest first: a desk for every jurisdiction with a record."

export const metadata = { title, description }

export default function DeskIndexPage() {
  return (
    <DocsPage title={title} description={description} slug="/desk" previous={{ name: "News", url: "/news" }} next={{ name: "Bills", url: "/bills" }}>
      <JurisdictionCards base="/desk" />
    </DocsPage>
  )
}
