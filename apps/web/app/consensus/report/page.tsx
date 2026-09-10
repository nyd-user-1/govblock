import Link from "next/link"

import { DocsPage } from "@/components/docs-page"
import { SplitBar, SplitLegend } from "@/components/consensus/split-bar"
import {
  agreement,
  consensusStatements,
  conversation,
  conversations,
  divisiveness,
  divisiveStatements,
  share,
  type Conversation,
  type Statement,
} from "@/lib/consensus/data"
import { fmtNumber } from "@/lib/format"

// /consensus/report — what the room actually thought.
//
// This is the artifact people share, which is why it is the surface worth
// owning. Polis renders it as rings a reader has to decode; the same numbers
// as bars need no decoding, and the group rows underneath answer the question
// the headline number cannot: *who* disagreed.
const title = "Consensus report"
const description =
  "Where a conversation agreed, where it split, and which group you were in if you took each side."

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

function StatementRow({
  statement,
  conversation: c,
  note,
}: {
  statement: Statement
  conversation: Conversation
  note: string
}) {
  const groups = c.groups.filter((g) => (statement.byGroup[g.id]?.seen ?? 0) >= 5)
  return (
    <article className="flex flex-col gap-3 border-t py-5">
      <p className="text-sm leading-6">{statement.text}</p>
      <SplitBar votes={statement.votes} />
      {groups.length > 1 && (
        <div className="flex flex-col gap-1.5 pt-1">
          {groups.map((g) => (
            <SplitBar
              key={g.id}
              compact
              label={`Group ${String.fromCharCode(65 + g.id)}`}
              votes={statement.byGroup[g.id]!}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {note} · {fmtNumber(statement.votes.seen)} saw it
      </p>
    </article>
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

  return (
    <DocsPage
      title={title}
      description={description}
      slug="/consensus/report"
      previous={{ name: "Consensus", url: "/consensus" }}
      next={{ name: "Survey", url: "/consensus/survey" }}
    >
      <div data-not-typeset="true" className="my-8 flex flex-col gap-10">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{c.topic}</h2>
            {conversations().length > 1 && (
              <span className="flex gap-2 text-xs text-muted-foreground">
                {conversations()
                  .filter((other) => other.slug !== c.slug)
                  .map((other) => (
                    <Link key={other.slug} href={`/consensus/report?c=${other.slug}`}>
                      {other.topic}
                    </Link>
                  ))}
              </span>
            )}
          </div>
          {c.description && (
            <p className="text-sm text-balance text-muted-foreground">
              {c.description}
            </p>
          )}
          <div className="grid grid-cols-2 gap-6 rounded-xl border bg-card p-5 sm:grid-cols-4">
            <Stat value={fmtNumber(c.stats.voters)} label="voters" />
            <Stat value={fmtNumber(c.stats.statements)} label="statements" />
            <Stat value={fmtNumber(c.stats.votes)} label="votes cast" />
            <Stat value={String(c.stats.groups)} label="opinion groups" />
          </div>
          <SplitLegend />
        </header>

        <section className="flex flex-col">
          <h3 className="text-lg font-semibold tracking-tight">
            Where everyone agreed
          </h3>
          <p className="pt-1 pb-2 text-sm text-muted-foreground">
            Statements no group dissented from — scored on the least agreeable
            group, not on the majority, so a big group cannot carry a small one.
          </p>
          {agreed.map((s) => (
            <StatementRow
              key={s.tid}
              statement={s}
              conversation={c}
              note={`${Math.round(agreement(s))}% in the least agreeable group`}
            />
          ))}
        </section>

        <section className="flex flex-col">
          <h3 className="text-lg font-semibold tracking-tight">
            Where the room split
          </h3>
          <p className="pt-1 pb-2 text-sm text-muted-foreground">
            Statements where the group you were in predicted your answer. The
            widest gap between two groups, not the closest overall vote — a
            statement everyone half-agrees with is uncertain, not divisive.
          </p>
          {split.map((s) => (
            <StatementRow
              key={s.tid}
              statement={s}
              conversation={c}
              note={`${Math.round(divisiveness(s))} points between the furthest groups`}
            />
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold tracking-tight">The groups</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Group</th>
                  <th className="py-2 pr-4 font-medium">Participants</th>
                  <th className="py-2 font-medium">Share of the room</th>
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
          <h3 className="text-lg font-semibold tracking-tight">
            Every statement
          </h3>
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
                {c.statements.slice(0, 60).map((s) => {
                  const v = share(s.votes)
                  return (
                    <tr key={s.tid} className="border-b last:border-0">
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
          {c.statements.length > 60 && (
            <p className="text-xs text-muted-foreground">
              The first 60 of {fmtNumber(c.statements.length)}, by how many
              people saw them.
            </p>
          )}
        </section>
      </div>
    </DocsPage>
  )
}
