import type { Metadata } from "next"
import Link from "next/link"

import { memberHref } from "@/lib/filters"
import { fmtDate, fmtNumber } from "@/lib/format"
import { partyLineStudy } from "@/lib/research/party-line"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2, Table } from "@/components/typeset"

// The first study (2026-09-14): how often a House roll call in the 119th
// Congress splits the parties, which kinds of vote split, and who crosses.

export const metadata: Metadata = { title: "How often the House splits along party lines", description: "Every House roll call of the 119th Congress, counted by party." }
export const revalidate = 86400

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)
const SUSPENSION = /suspend the rules/i

export default async function PartyLineStudyPage() {
  const s = await partyLineStudy()
  const suspension = s.byQuestion.filter((q) => SUSPENSION.test(q.question)).reduce((a, q) => ({ votes: a.votes + q.votes, split: a.split + q.split }), { votes: 0, split: 0 })
  const passage = s.byQuestion.find((q) => q.question === "On Passage")
  const top = s.crossers[0]
  const topR = s.crossers.find((c) => c.party === "R")

  return (
    <DocsPage
      title="How often the House splits along party lines"
      description={`Every House roll call of the ${s.congress}th Congress, ${s.first ? fmtDate(s.first) : ""} to ${s.last ? fmtDate(s.last) : ""}, counted by party.`}
      slug="/research/party-line-votes"
      previous={{ name: "Research", url: "/research" }}
      next={{ name: "Roll call votes", url: "/roll-call-votes" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Key takeaways", url: "#takeaways", depth: 2 },
            { title: "1. Split votes", url: "#split", depth: 2 },
            { title: "2. Kinds of vote", url: "#kinds", depth: 2 },
            { title: "3. Members who cross", url: "#crossers", depth: 2 },
            { title: "4. Counting rules", url: "#rules", depth: 2 },
          ]}
        />
      }
    >
      <div id="takeaways" className="rounded-xl border bg-card p-5">
        <p className="mt-0 font-semibold">Key takeaways</p>
        <ul className="mb-0">
          <li>
            {pct(s.split, s.votes)}% of House roll calls ({fmtNumber(s.split)} of {fmtNumber(s.votes)}) split the parties, and {fmtNumber(s.splitNoCrossing)} of those split with no member of either party crossing.
          </li>
          {suspension.votes > 0 && (
            <li>
              Votes that need two-thirds almost never split: {fmtNumber(suspension.split)} of {fmtNumber(suspension.votes)} motions to suspend the rules{passage ? `, against ${fmtNumber(passage.split)} of ${fmtNumber(passage.votes)} ordinary passage votes` : ""}.
            </li>
          )}
          {top && (
            <li>
              {top.name} ({top.party}-{top.state}) crossed most often: {fmtNumber(top.crossed)} of {fmtNumber(top.cast)} split votes{topR && topR !== top ? `; among Republicans, ${topR.name} (${topR.state}), ${fmtNumber(topR.crossed)}` : ""}.
            </li>
          )}
        </ul>
      </div>

      <H2 id="split">1. Split votes</H2>
      <p>
        Of {fmtNumber(s.votes)} roll calls, {fmtNumber(s.split)} split the parties: a majority of voting Republicans and a majority of voting Democrats answered opposite ways. {fmtNumber(s.bothYes)} passed with majorities of both parties voting yes, and{" "}
        {fmtNumber(s.votes - s.split - s.bothYes)} saw both majorities vote no or a party tied.
      </p>

      <H2 id="kinds">2. Kinds of vote</H2>
      <p>What the House was asked decides whether it splits. Procedural votes on a majority&apos;s rules split nearly every time; suspension votes, which need two-thirds, almost never do.</p>
      <Table>
        <thead>
          <tr>
            <th className="w-[55%]">Question</th>
            <th className="text-right">Roll calls</th>
            <th className="text-right">Split</th>
            <th className="pr-8 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {s.byQuestion.map((q) => (
            <tr key={q.question}>
              <td>{q.question}</td>
              <td className="text-right tabular-nums">{fmtNumber(q.votes)}</td>
              <td className="text-right tabular-nums">{fmtNumber(q.split)}</td>
              <td className="pr-8 text-right tabular-nums">{pct(q.split, q.votes)}%</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="crossers">3. Members who cross</H2>
      <p>A member crosses on a split vote by voting with the other party&apos;s majority. The fifteen who did it most:</p>
      <Table>
        <thead>
          <tr>
            <th className="w-[45%]">Member</th>
            <th>Party</th>
            <th className="text-right">Crossed</th>
            <th className="text-right">Split votes cast</th>
            <th className="pr-8 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {s.crossers.map((c) => (
            <tr key={`${c.peopleId}-${c.name}`}>
              <td>{c.peopleId ? <Link href={memberHref(c.peopleId, "US")}>{c.name}</Link> : c.name}</td>
              <td>
                {c.party}-{c.state}
              </td>
              <td className="text-right tabular-nums">{fmtNumber(c.crossed)}</td>
              <td className="text-right tabular-nums">{fmtNumber(c.cast)}</td>
              <td className="pr-8 text-right tabular-nums">{pct(c.crossed, c.cast)}%</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="rules">4. Counting rules</H2>
      <ul>
        <li>Source: the House Clerk&apos;s roll call votes as congress.gov publishes them, with every member&apos;s position.</li>
        <li>Yea and Aye count as yes; Nay and No as no. Present and Not Voting count for neither side.</li>
        <li>A roll call splits the parties when the majorities of voting Republicans and voting Democrats are on opposite sides. Independents are left out of the party count.</li>
        <li>Recounted when the page is built, at most once a day. Data and findings are CC BY 4.0.</li>
      </ul>
    </DocsPage>
  )
}
