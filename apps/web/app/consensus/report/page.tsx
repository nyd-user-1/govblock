import { DocsPage } from "@/components/docs-page"
import { H3 } from "@/components/typeset"
import { StatementsRail } from "@/components/consensus/rail"
import { SplitLegend } from "@/components/consensus/split-bar"
import { StatementCard } from "@/components/consensus/status-bars"
import {
  agreement,
  consensusStatements,
  conversation,
  conversations,
  divisiveness,
  divisiveStatements,
  share,
  standing,
  type Conversation,
  type Statement,
} from "@/lib/consensus/data"
import { fmtNumber } from "@/lib/format"

// /consensus/report — what a conversation actually thought.
//
// This is the artifact people share, which is why it is the surface worth
// owning. Polis renders it as rings a reader has to decode; the same numbers
// as bars need no decoding, and the group rows underneath answer the question
// the headline number cannot: *who* disagreed.
const title = "Consensus report"
const description =
  "Where a agreement can be found, where a split emerges, and the underlying statements."

export const metadata = { title, description }

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export default async function ConsensusReportPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { c: slug } = await searchParams
  const c = conversation(slug ?? "") ?? conversations()[0]!
  const agreed = consensusStatements(c)
  const split = divisiveStatements(c)
  // The table shows the statements that stood: not the ones a moderator
  // pulled, and not the ones one person saw and nobody answered.
  const listed = c.statements.filter(standing)

  return (
    <DocsPage
      title={title}
      description={description}
      slug="/consensus/report"
      previous={{ name: "Consensus", url: "/consensus" }}
      next={{ name: "Survey", url: "/consensus/survey" }}
      rail={<StatementsRail conversation={c} />}
      railFirst
    >
      <div data-not-typeset="true" className="my-8 flex flex-col gap-10">
        <header className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">{c.title}</h2>
          {c.description && (
            <p className="text-sm text-balance text-muted-foreground">
              {c.description}
            </p>
          )}
          <div className="grid grid-cols-2 gap-6 rounded-xl border bg-card p-5 sm:grid-cols-4">
            <Stat value={fmtNumber(c.stats.voters)} label="participants" />
            <Stat value={fmtNumber(c.stats.statements)} label="statements" />
            <Stat value={fmtNumber(c.stats.votes)} label="votes cast" />
            <Stat value={String(c.stats.groups)} label="opinion groups" />
          </div>
          <SplitLegend />
        </header>

        <section className="flex flex-col gap-4">
          <H3 className="text-lg font-semibold tracking-tight">Agreement</H3>
          <p className="-mt-2 text-sm text-muted-foreground">
            Statements no group dissented from — scored on the least agreeable
            group, not on the majority, so a big group cannot carry a small one.
          </p>
          {agreed.map((s) => (
            <StatementCard
              key={s.tid}
              statement={s}
              conversation={c}
              note={`${Math.round(agreement(s))}% in the least agreeable group`}
            />
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <H3 className="text-lg font-semibold tracking-tight">Split</H3>
          <p className="-mt-2 text-sm text-muted-foreground">
            Statements where the group you were in predicted your answer. The
            widest gap between two groups, not the closest overall vote — a
            statement everyone half-agrees with is uncertain, not divisive.
          </p>
          {split.map((s) => (
            <StatementCard
              key={s.tid}
              statement={s}
              conversation={c}
              note={`${Math.round(divisiveness(s))} points between the furthest groups`}
            />
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <H3 className="text-lg font-semibold tracking-tight">Groups</H3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Group</th>
                  <th className="py-2 pr-4 font-medium">Participants</th>
                  <th className="py-2 font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {c.groups.map((g) => (
                  <tr key={g.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      Group {String.fromCharCode(65 + g.id)}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {fmtNumber(g.size)}
                    </td>
                    <td className="py-2 tabular-nums">
                      {Math.round((g.size / c.stats.voters) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <H3 className="text-lg font-semibold tracking-tight">Statements</H3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Statement</th>
                  <th className="py-2 pr-4 text-right font-medium">Agree</th>
                  <th className="py-2 pr-4 text-right font-medium">Disagree</th>
                  <th className="py-2 pr-4 text-right font-medium">Pass</th>
                  <th className="py-2 text-right font-medium">Saw it</th>
                </tr>
              </thead>
              <tbody>
                {listed.slice(0, 60).map((s) => {
                  const v = share(s.votes)
                  return (
                    <tr
                      key={s.tid}
                      id={`s-${s.tid}`}
                      className="scroll-mt-24 border-b last:border-0"
                    >
                      <td className="max-w-md py-2 pr-4">{s.text}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {Math.round(v.agree)}%
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {Math.round(v.disagree)}%
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {Math.round(v.pass)}%
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {fmtNumber(s.votes.seen)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {listed.length > 60 && (
            <p className="text-xs text-muted-foreground">
              The first 60 of {fmtNumber(listed.length)}, by how many
              people saw them.
            </p>
          )}
        </section>
      </div>
    </DocsPage>
  )
}
