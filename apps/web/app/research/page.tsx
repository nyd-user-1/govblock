import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { fmtNumber } from "@/lib/format"
import { partyLineStudy } from "@/lib/research/party-line"
import { RailsFrame } from "@/components/rails-frame"

// /research (Brendan, 2026-09-14): original studies from the data GovBlock
// holds, public and free to cite, on the pattern of autoclip.dev/research.
// Each study's numbers are counted from the database when the page is built,
// so a study stays true as new votes arrive.

export const metadata: Metadata = { title: "Research", description: "Data studies on how legislatures vote, stall and pass." }
export const revalidate = 86400

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

export default async function ResearchPage() {
  const s = await partyLineStudy().catch(() => null)
  return (
    <RailsFrame>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-14 py-12">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight">GovBlock Research</h1>
          <p className="text-lg text-muted-foreground">Data studies on how legislatures vote, stall and pass.</p>
          <p className="text-sm text-muted-foreground">Counted from the bills, votes and members GovBlock holds for Congress and all fifty states. Findings are public and free to cite.</p>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Published studies</h2>
          {s ? (
            <Link href="/research/party-line-votes" className="group flex flex-col gap-4 rounded-xl border bg-card p-6 no-underline transition-colors hover:bg-accent/40">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">September 2026 · votes through {s.last}</span>
                <span className="text-lg font-semibold">How often the House splits along party lines</span>
              </div>
              <p className="text-3xl font-bold tracking-tight tabular-nums">
                {pct(s.split, s.votes)}% <span className="text-base font-normal text-muted-foreground">of House roll calls in the {s.congress}th Congress split the parties</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {fmtNumber(s.votes)} roll calls, every member&apos;s vote on each. {fmtNumber(s.splitNoCrossing)} split with no member of either party crossing; votes that need two-thirds almost never split.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Roll calls", "Party unity", "House", "119th Congress"].map((t) => (
                  <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
              <span className="flex items-center gap-1 text-sm font-medium">
                Read the full study <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">The studies could not be counted just now.</p>
          )}
          <p className="text-sm text-muted-foreground">
            More at <Link href="/reports">Reports</Link>.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Methodology</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
            <li>Every study is counted from GovBlock&apos;s copy of the official sources: congress.gov and the House and Senate clerks for Congress, each legislature&apos;s own site for the states.</li>
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
