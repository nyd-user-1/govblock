import { DocsPage } from "@/components/docs-page"
import {
  BriefingPanel,
  BriefingProvider,
  BriefingRail,
} from "@/components/news/briefing"

// /briefing, on daily.dev's Presidential Briefings (Brendan, 2026-09-09): the
// week on the desk in scope — the whole record and the press on it — read and
// written up by the Reporter. The body and the rail share one state, so the
// provider sits around both.
const title = "Briefing"
const description =
  "The week on your desk — every bill, vote, hearing and headline — read and written up by the Reporter, with a source on every line."

export const metadata = { title, description }

export default function BriefingPage() {
  return (
    <BriefingProvider>
      <DocsPage
        title={title}
        description={description}
        slug="/briefing"
        previous={{ name: "News", url: "/news" }}
        next={{ name: "Reporter", url: "/agents/reporter" }}
        rail={<BriefingRail />}
      >
        <BriefingPanel />
      </DocsPage>
    </BriefingProvider>
  )
}
