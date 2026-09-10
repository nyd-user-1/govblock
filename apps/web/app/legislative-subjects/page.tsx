import { CalendarCard } from "@/components/cards/calendar"
import { DocsPage } from "@/components/docs-page"
import { TermsDirectory } from "@/components/subjects/terms-directory"

// The legislative subjects, on the committees doc's page (Brendan,
// 2026-09-09): the second of the two pages the subjects doc should have been.
// Grouped as that doc splits them — the general terms, then organizations,
// then places — so a body or a country is found by name.
const title = "Legislative Subjects"
const description =
  "The specific terms a bill touches, in the jurisdiction in scope: topics, organizations and places, with the bills under each."

export const metadata = { title, description }

export default function LegislativeSubjectsPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/legislative-subjects"
      previous={{ name: "Policy Areas", url: "/policy-areas" }}
      next={{ name: "Briefing", url: "/briefing" }}
      rail={<CalendarCard compact />}
    >
      <TermsDirectory kind="legislative" />
    </DocsPage>
  )
}
