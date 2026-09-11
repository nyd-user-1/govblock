import Link from "next/link"

import {
  conversations,
  share,
  standing,
  type Conversation,
} from "@/lib/consensus/data"
import { fmtNumber } from "@/lib/format"
import { StatementCard } from "@/components/consensus/statement-card"

// The consensus pages' right rail, in the briefing rail's shape (Brendan,
// 2026-09-11): a card per thing on the page. On /consensus that is a
// conversation; on a report it is a statement, and the card opens the vote
// card on that statement, in an overlay (components/consensus/statement-card).

const card =
  "flex flex-col gap-1.5 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent/30"

export function ConversationsRail() {
  return (
    <div className="flex flex-col gap-3">
      {conversations().map((c) => (
        <Link key={c.slug} href={`/consensus/report?c=${c.slug}`} className={card}>
          <span className="truncate text-sm font-medium">{c.title}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {fmtNumber(c.stats.voters)} participants · {c.stats.groups} groups
          </span>
        </Link>
      ))}
    </div>
  )
}

export function StatementsRail({ conversation }: { conversation: Conversation }) {
  const listed = conversation.statements.filter(standing).slice(0, 60)
  return (
    <div className="flex flex-col gap-3">
      {listed.map((s) => {
        const v = share(s.votes)
        return (
          <StatementCard key={s.tid} conversation={conversation} tid={s.tid} className={card}>
            <span className="line-clamp-3 text-xs leading-5">{s.text}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.round(v.agree)}% agree · {Math.round(v.disagree)}% disagree
            </span>
          </StatementCard>
        )
      })}
    </div>
  )
}
