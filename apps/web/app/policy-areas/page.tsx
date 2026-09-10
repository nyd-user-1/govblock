import { CalendarCard } from "@/components/cards/calendar"
import { DocsPage } from "@/components/docs-page"
import { TermsDirectory } from "@/components/subjects/terms-directory"

// The policy areas, on the committees doc's page (Brendan, 2026-09-09): one
// card per area, the count beside it. The subjects doc kept both browses on
// one page; this is the first of the two it should have been.
const title = "Policy Areas"
const description =
  "The one broad term every bill is filed under, in the jurisdiction in scope, with the bills under each."

export const metadata = { title, description }

export default function PolicyAreasPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/policy-areas"
      previous={{ name: "Tags", url: "/tags" }}
      next={{ name: "Legislative Subjects", url: "/legislative-subjects" }}
      rail={<CalendarCard compact />}
    >
      <TermsDirectory kind="policy" />
    </DocsPage>
  )
}
