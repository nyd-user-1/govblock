import type { Metadata } from "next"
import Link from "next/link"

import { RailsFrame } from "@/components/rails-frame"
import { ReportCards } from "@/components/reports/report-cards"

// /research (Brendan, 2026-09-14): original studies from the data GovBlock
// holds, public and free to cite, on the pattern of autoclip.dev/research.
// Each study's numbers are counted from the database when the page is built,
// so a study stays true as new votes arrive.

export const metadata: Metadata = { title: "Research", description: "Data studies on how legislatures vote, stall and pass." }
export const revalidate = 86400

export default async function ResearchPage() {
  return (
    <RailsFrame>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-14 py-12">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight">GovBlock Research</h1>
          <p className="text-lg text-muted-foreground">Data studies on how legislatures vote, stall and pass.</p>
          <p className="text-sm text-muted-foreground">Counted from the bills, votes and members GovBlock holds for Congress and all fifty states. Findings are public and free to cite.</p>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Published reports</h2>
          <ReportCards />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Methodology</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
            <li>Every report is counted from GovBlock&apos;s copy of the official sources: congress.gov, the House and Senate clerks, each legislature&apos;s own site, the FEC, lobbying disclosures, election returns and agency forms. A trace report shows each source it read and what it made of it.</li>
            <li>A study reports whole populations, not samples: every roll call, every member, every bill in its scope.</li>
            <li>Numbers are recounted when a page is built, at most a day old, and each study names the last date it covers.</li>
            <li>The counting rules are written out on each study&apos;s page, so any figure can be checked against the source.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Citing</h2>
          <p className="text-sm text-muted-foreground">The data and findings are licensed CC BY 4.0. Cite a study as:</p>
          <code className="rounded-md bg-muted px-3 py-2 text-xs">GovBlock, &ldquo;How often the House splits along party lines,&rdquo; September 2026, gov.nysgpt.com/research/party-line-votes</code>
        </section>
      </div>
    </RailsFrame>
  )
}
