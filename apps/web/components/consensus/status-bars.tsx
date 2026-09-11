import { share, type Conversation, type Statement, type Tally } from "@/lib/consensus/data"
import { fmtNumber } from "@/lib/format"

// A statement's votes in the shape of an uptime status card (Brendan,
// 2026-09-11, on Aceternity's uptime-status-illustration): the statement where
// the service name goes, the agree share as the big figure on the right, and
// the votes as a row of rounded pills — agree, then pass, then disagree, left
// to right, so the row still reads as one measure. A pill grows under the
// pointer and names its share. The colours are the report's own validated pair
// (components/consensus/split-bar.tsx says why teal and amber, not green and
// red), with pass in the neutral middle.

const AGREE = "var(--consensus-agree)"
const DISAGREE = "var(--consensus-disagree)"
const PILLS = 48

type Kind = "agree" | "pass" | "disagree"

/** Split N pills across three shares by largest remainder, so they always sum to N. */
function pillsOf(votes: Tally, n = PILLS): Kind[] {
  const s = share(votes)
  const raw = [
    ["agree", (s.agree / 100) * n],
    ["pass", (s.pass / 100) * n],
    ["disagree", (s.disagree / 100) * n],
  ] as const
  const counts = raw.map(([, v]) => Math.floor(v))
  let left = n - counts.reduce((a, b) => a + b, 0)
  const order = raw.map(([, v], i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) {
    if (left <= 0) break
    counts[i]!++
    left--
  }
  const out: Kind[] = []
  raw.forEach(([k], i) => {
    for (let j = 0; j < counts[i]!; j++) out.push(k)
  })
  return out
}

const fill: Record<Kind, string> = {
  agree: AGREE,
  pass: "color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
  disagree: DISAGREE,
}

export function StatusBars({ votes, size = "md" }: { votes: Tally; size?: "md" | "sm" }) {
  const s = share(votes)
  const pct = (v: number) => `${Math.round(v)}%`
  const title: Record<Kind, string> = {
    agree: `Agree · ${pct(s.agree)}`,
    pass: `Pass · ${pct(s.pass)}`,
    disagree: `Disagree · ${pct(s.disagree)}`,
  }
  return (
    <div
      className={`flex w-full items-end ${size === "md" ? "h-9 gap-[3px]" : "h-4 gap-[2px]"}`}
      role="img"
      aria-label={`${pct(s.agree)} agree, ${pct(s.pass)} pass, ${pct(s.disagree)} disagree, of ${fmtNumber(votes.seen)} who saw it`}
    >
      {pillsOf(votes).map((kind, i) => (
        <span
          key={i}
          title={title[kind]}
          className={`min-w-0 flex-1 origin-bottom rounded-full transition-transform duration-150 hover:scale-y-125 ${size === "md" ? "h-8" : "h-3"}`}
          style={{ background: fill[kind] }}
        />
      ))}
    </div>
  )
}

/** The big figure's colour: the side that carried the statement, or neither. */
function tone(s: ReturnType<typeof share>) {
  if (s.agree >= 50) return AGREE
  if (s.disagree >= 50) return DISAGREE
  return "var(--foreground)"
}

export function StatementCard({
  statement,
  conversation: c,
  note,
}: {
  statement: Statement
  conversation: Conversation
  note: string
}) {
  const s = share(statement.votes)
  const groups = c.groups.filter((g) => (statement.byGroup[g.id]?.seen ?? 0) >= 5)
  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm leading-6 font-medium">{statement.text}</p>
          <p className="text-xs text-muted-foreground">{note}</p>
        </div>
        <span className="shrink-0 text-2xl font-semibold tracking-tight tabular-nums" style={{ color: tone(s) }}>
          {Math.round(s.agree)}%
        </span>
      </div>
      <StatusBars votes={statement.votes} />
      {groups.length > 1 && (
        <div className="flex flex-col gap-2">
          {groups.map((g) => {
            const v = statement.byGroup[g.id]!
            return (
              <div key={g.id} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">Group {String.fromCharCode(65 + g.id)}</span>
                <StatusBars votes={v} size="sm" />
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{Math.round(share(v).agree)}%</span>
              </div>
            )
          })}
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{fmtNumber(statement.votes.seen)} saw it</span>
        <span className="tabular-nums">{Math.round(s.disagree)}% disagree</span>
      </div>
    </article>
  )
}
