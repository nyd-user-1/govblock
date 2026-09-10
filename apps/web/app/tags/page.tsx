import { CalendarCard } from "@/components/cards/calendar"
import { DocsPage } from "@/components/docs-page"
import { TermsDirectory } from "@/components/subjects/terms-directory"

// The tags index, on the committees doc's page (Brendan, 2026-09-09; it began
// the day on the datasets index's link grid and was moved the same day): every
// term the jurisdiction in scope files a bill under, the policy areas first
// and the legislative subjects after, one card each.
const title = "Tags"
const description =
  "Every subject the record files a bill under, in the jurisdiction in scope, with the bills under each."

export const metadata = { title, description }

export default function TagsPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/tags"
      previous={{ name: "News", url: "/news" }}
      next={{ name: "Policy Areas", url: "/policy-areas" }}
      rail={<CalendarCard compact />}
    >
      <TermsDirectory kind="all" />
    </DocsPage>
  )
}
