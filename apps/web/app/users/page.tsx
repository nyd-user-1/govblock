import type { Metadata } from "next"
import Link from "next/link"
import { IconHome, IconUsers } from "@tabler/icons-react"

import { BOARDS, EMPLOYERS, board, topTakes, type BoardKey, type User } from "@/lib/users/mock"
import { ChamberSeal } from "@/components/policy/imagery"
import { LevelRing, Medal, Reputation, UserAvatar, compact } from "@/components/users/parts"
import { WidePage } from "@/components/wide-page"

// /users (Brendan, 2026-09-18): daily.dev's leaderboard, three boards across
// and three down, the top ten on each, every row opening the reader's page.
// On WidePage since 2026-09-20 — three boards will not sit side by side in
// the docs column's 640px, and the wide page type is that column widened —
// where it drew the shell itself. Mocked in lib/users/mock.ts until the
// numbers are counted.

export const metadata: Metadata = { title: "Users", description: "The readers who read, write and bring others to GovBlock the most." }

function Board({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="px-2 text-xl font-semibold tracking-tight">{title}</h2>
      <ol className="flex flex-col">{children}</ol>
    </section>
  )
}

function UserRow({ user, rank, value, boardKey }: { user: User; rank: number; value: number; boardKey: BoardKey }) {
  return (
    <li>
      <Link href={`/users/${user.handle}`} className="grid grid-cols-[3.25rem_1.25rem_auto_minmax(0,1fr)] items-center gap-3 rounded-xl px-2 py-2.5 no-underline hover:bg-muted">
        <span className="text-right text-base text-muted-foreground tabular-nums">{compact.format(value)}</span>
        <Medal rank={rank} />
        <span className="flex items-center gap-3">
          {boardKey === "xp" && <LevelRing level={user.stats.level} progress={(user.stats.xp % 1000) / 1000} />}
          <UserAvatar name={user.name} handle={user.handle} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="truncate font-semibold text-foreground">{user.name}</span>
            <Reputation value={user.stats.reputation} className="shrink-0 text-xs text-foreground" />
          </span>
          <span className="truncate text-xs text-muted-foreground">@{user.handle}</span>
        </span>
      </Link>
    </li>
  )
}

export default function UsersPage() {
  return (
    <WidePage>
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground" aria-label="Home">
          <IconHome className="size-4" />
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="flex items-center gap-1.5 font-semibold">
          <IconUsers className="size-4" /> Users
        </h1>
      </nav>

      <div className="grid gap-5 lg:grid-cols-3">
        {BOARDS.map((b) => (
          <Board key={b.key} title={b.title}>
            {board(b.key).map((user, i) => (
              <UserRow key={user.handle} user={user} rank={i} value={user.stats[b.key]} boardKey={b.key} />
            ))}
          </Board>
        ))}

        <Board title="Most verified employees">
          {EMPLOYERS.map((org, i) => (
            <li key={org.name} className="grid grid-cols-[3.25rem_1.25rem_auto_minmax(0,1fr)] items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted">
              <span className="text-right text-base text-muted-foreground tabular-nums">{i + 1}</span>
              <Medal rank={i} />
              <ChamberSeal state={org.state} chamber={org.chamber} size={40} />
              <span className="truncate text-sm font-medium">{org.name}</span>
            </li>
          ))}
        </Board>

        <Board title="Most popular hot takes">
          {topTakes().map((take) => (
            <li key={take.title}>
              <Link href={`/users/${take.user.handle}#hot-takes`} className="grid grid-cols-[3.25rem_1.25rem_minmax(0,1fr)] items-center gap-3 rounded-xl px-2 py-2.5 no-underline hover:bg-muted">
                <span className="text-right text-base text-muted-foreground tabular-nums">{compact.format(take.upvotes)}</span>
                <span className="text-base leading-none">{take.emoji}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-foreground">{take.title}</span>
                  {take.sub && <span className="text-xs text-muted-foreground">{take.sub}</span>}
                </span>
              </Link>
            </li>
          ))}
        </Board>
      </div>
    </WidePage>
  )
}
