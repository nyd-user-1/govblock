import type { Metadata } from "next"

import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportCards } from "@/components/reports/report-cards"
import { H2 } from "@/components/typeset"
import { REPORTS } from "@/lib/reports/registry"

// /research (Brendan, 2026-09-14): original studies from the data GovBlock
// holds, public and free to cite, on the pattern of autoclip.dev/research.
// Each study's numbers are counted from the database when the page is built,
// so a study stays true as new votes arrive.
//
// On the docs shell (Brendan, 2026-09-20), where its reports already were:
// the shell's head, its headings and rules, and the index of the page in the
// right rail. Until then it wore the root's frame, and the root's three
// sheets with it.

export const metadata: Metadata = { title: "Research", description: "Data studies on how legislatures vote, stall and pass." }
export const revalidate = 86400

export default async function ResearchPage() {
  const first = REPORTS[0]
  return (
    <DocsPage
      title="GovBlock Research"
      description="Data studies on how legislatures vote, stall and pass."
      slug="/research"
      next={first ? { name: first.title, url: first.href } : { name: "Reports", url: "/reports" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Published reports", url: "#published-reports", depth: 2 },
            { title: "Methodology", url: "#methodology", depth: 2 },
            { title: "Citing", url: "#citing", depth: 2 },
          ]}
        />
      }
    >
      <p>Counted from the bills, votes and members GovBlock holds for Congress and all fifty states. Findings are public and free to cite.</p>
      <H2>Published reports</H2>
      <div className="mt-6">
        <ReportCards />
      </div>
      <hr />
      <H2>Methodology</H2>
      <ul>
        <li>Every report is counted from GovBlock&apos;s copy of the official sources: congress.gov, the House and Senate clerks, each legislature&apos;s own site, the FEC, lobbying disclosures, election returns and agency forms. A trace report shows each source it read and what it made of it.</li>
        <li>A study reports whole populations, not samples: every roll call, every member, every bill in its scope.</li>
        <li>Numbers are recounted when a page is built, at most a day old, and each study names the last date it covers.</li>
        <li>The counting rules are written out on each study&apos;s page, so any figure can be checked against the source.</li>
      </ul>
      <hr />
      <H2>Citing</H2>
      <p>The data and findings are licensed CC BY 4.0. Cite a study as:</p>
      <p>
        <code>GovBlock, &ldquo;How often the House splits along party lines,&rdquo; September 2026, gov.nysgpt.com/research/party-line-votes</code>
      </p>
    </DocsPage>
  )
}
