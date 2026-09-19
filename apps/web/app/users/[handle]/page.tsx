import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  IconArrowBigUp,
  IconBrandGithub,
  IconBrandLinkedin,
  IconBrandX,
  IconMessageCircle,
  IconWorld,
} from "@tabler/icons-react"

import { TAG_BY_SLUG } from "@/lib/data/tags"
import { stateName } from "@/lib/filters"
import {
  DESK_MEMBERS,
  USERS,
  USER_BY_HANDLE,
  type Post,
  type User,
} from "@/lib/users/mock"
import { BackToTop } from "@/components/back-to-top"
import { PublicRail } from "@/components/block-card"
import { ChamberSeal, FlagChip } from "@/components/policy/imagery"
import { H2 } from "@/components/typeset"
import { RightRailSheet } from "@/components/rail-sheet"
import { ActivityTabs } from "@/components/users/activity-tabs"
import {
  CopyProfileLink,
  FollowButton,
} from "@/components/users/profile-actions"
import { Reputation, UserAvatar, compact } from "@/components/users/parts"

// A reader's page (Brendan, 2026-09-18), daily.dev's profile in the house
// layout: the header card, then the blocks a member's page is built from —
// About, Issues, Hot Takes, Activity, Work Experience — down the centre
// column, and the reading overview and desks in the right rail where
// daily.dev keeps its side panel. Mocked in lib/users/mock.ts.

type Props = { params: Promise<{ handle: string }> }

export const generateStaticParams = () =>
  USERS.map((u) => ({ handle: u.handle }))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = USER_BY_HANDLE.get((await params).handle)
  return user
    ? { title: `${user.name} (@${user.handle})`, description: user.headline }
    : { title: "User" }
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]
const monthYear = (ym: string) =>
  `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
const longDate = (iso: string) =>
  `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`
const tagName = (slug: string) => TAG_BY_SLUG.get(slug)?.name ?? slug
const ago = (iso: string) => {
  const days = Math.round((Date.parse("2026-09-18") - Date.parse(iso)) / 864e5)
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`
}

const LINK_ICONS = {
  x: IconBrandX,
  linkedin: IconBrandLinkedin,
  site: IconWorld,
  github: IconBrandGithub,
}

function PostCard({ post, user }: { post: Post; user: User }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <UserAvatar name={user.name} handle={user.handle} size={32} />
      <h4 className="line-clamp-3 text-base leading-snug font-semibold">
        {post.title}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {post.tags.slice(0, 2).map((t) => (
          <Link
            key={t}
            href={`/tags/${t}`}
            className="rounded-lg border px-2 py-0.5 text-xs text-muted-foreground no-underline hover:text-foreground"
          >
            #{t}
          </Link>
        ))}
        {post.tags.length > 2 && (
          <span className="rounded-lg border px-2 py-0.5 text-xs text-muted-foreground">
            +{post.tags.length - 2}
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {ago(post.day)} · {post.minutes}m read time
      </span>
      <div className="mt-auto flex items-center gap-4 pt-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <IconArrowBigUp className="size-4" /> {post.upvotes}
        </span>
        <span className="flex items-center gap-1">
          <IconMessageCircle className="size-4" /> {post.comments}
        </span>
      </div>
    </article>
  )
}

const HEAT = [
  "bg-muted",
  "bg-violet-500/30",
  "bg-violet-500/60",
  "bg-violet-600",
]
const heatLevel = (n: number) => (n === 0 ? 0 : n < 4 ? 1 : n < 8 ? 2 : 3)

function RailCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function ReadingOverview({ user }: { user: User }) {
  // 21 weeks ending today, a column a week and a row a weekday (Sunday first),
  // as a contribution graph draws it. One grid holds the month labels, the
  // weekday labels and the cells, so they line up at any rail width.
  const end = Date.parse("2026-09-18")
  const start = end - (user.heat.length - 1) * 864e5
  const lead = new Date(start).getUTCDay()
  const cells = [...Array<null>(lead).fill(null), ...user.heat]
  const weeks = Math.ceil(cells.length / 7)
  const monthOf = (w: number) =>
    new Date(start + (w * 7 - lead) * 864e5).getUTCMonth()
  const starts = Array.from({ length: weeks }, (_, w) => w).filter(
    (w) => w > 0 && monthOf(w) !== monthOf(w - 1)
  )
  const total = user.heat.reduce((n, v) => n + v, 0)
  return (
    <RailCard title="Reading Overview">
      <dl className="flex flex-col divide-y rounded-xl border text-sm">
        <div className="flex items-center justify-between px-3 py-2">
          <dt className="text-muted-foreground">Longest streak</dt>
          <dd className="font-semibold tabular-nums">
            🏆 {compact.format(user.stats.streak)} days
          </dd>
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <dt className="text-muted-foreground">Total reading days</dt>
          <dd className="font-semibold tabular-nums">
            {compact.format(user.stats.readingDays)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2.5">
        <h4 className="text-xs font-medium text-muted-foreground">
          Top tags by reading days
        </h4>
        <ul className="flex flex-col gap-2.5">
          {user.topTags.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/tags/${t.slug}`}
                className="group flex flex-col gap-1 no-underline"
              >
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-foreground group-hover:underline">
                    {tagName(t.slug)}
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    +{t.share}%
                  </span>
                </span>
                <span className="h-1.5 rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-violet-500"
                    style={{ width: `${t.share}%` }}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-medium text-muted-foreground">
          Posts read in the last five months ({compact.format(total)})
        </h4>
        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: `1.75rem repeat(${weeks}, minmax(0, 1fr))`,
          }}
        >
          <span />
          {Array.from({ length: weeks }, (_, w) => {
            const at = starts.indexOf(w)
            if (w !== 0 && at === -1) return null
            const next =
              w === 0 ? (starts[0] ?? weeks) : (starts[at + 1] ?? weeks)
            // A month too short to hold its name leaves the name to the next one.
            return (
              <span
                key={w}
                className="truncate text-[10px] leading-4 text-muted-foreground"
                style={{ gridColumn: `span ${next - w}` }}
              >
                {next - w >= 3 ? MONTHS[monthOf(w)] : ""}
              </span>
            )
          })}
          {Array.from({ length: 7 }, (_, d) => (
            <React.Fragment key={d}>
              <span className="self-center text-[10px] leading-none text-muted-foreground">
                {d === 1 ? "Mon" : d === 3 ? "Wed" : d === 5 ? "Fri" : ""}
              </span>
              {Array.from({ length: weeks }, (_, w) => {
                const n = cells[w * 7 + d]
                return n === undefined || n === null ? (
                  <span key={w} />
                ) : (
                  <span
                    key={w}
                    title={`${n} posts`}
                    className={`aspect-square rounded-[2px] ${HEAT[heatLevel(n)]}`}
                  />
                )
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          Less
          {HEAT.map((c) => (
            <span key={c} className={`size-2.5 rounded-[2px] ${c}`} />
          ))}
          More
        </div>
      </div>
    </RailCard>
  )
}

function Desks({ user }: { user: User }) {
  return (
    <RailCard title="Active on these desks">
      <ul className="-mx-2 flex flex-col">
        {user.desks.map((code) => (
          <li key={code}>
            <Link
              href={`/desk/${code.toLowerCase()}`}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 no-underline hover:bg-muted"
            >
              <FlagChip
                state={code}
                width={28}
                className="shrink-0 rounded-md"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {code === "US" ? "Congress" : stateName(code)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  @desk-{code.toLowerCase()}
                  {DESK_MEMBERS[code]
                    ? ` · ${compact.format(DESK_MEMBERS[code]!)} members`
                    : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/news"
        className="rounded-xl border py-1.5 text-center text-sm no-underline hover:bg-muted"
      >
        Show all desks
      </Link>
    </RailCard>
  )
}

export default async function UserPage({ params }: Props) {
  const user = USER_BY_HANDLE.get((await params).handle)
  if (!user) notFound()
  const s = user.stats

  return (
    <div
      data-slot="docs"
      className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8">
          <header className="overflow-hidden rounded-2xl border bg-card">
            <div className="h-32 bg-muted bg-[radial-gradient(circle_at_20%_20%,oklch(0.55_0.2_280/.55),transparent_55%),radial-gradient(circle_at_85%_40%,oklch(0.6_0.18_20/.45),transparent_50%)] sm:h-40" />
            <div className="flex flex-col gap-4 px-5 pb-5 sm:px-6">
              <div className="-mt-12 flex items-end justify-between">
                <UserAvatar
                  name={user.name}
                  handle={user.handle}
                  size={96}
                  className="rounded-2xl ring-4 ring-card"
                />
                <CopyProfileLink />
              </div>
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {user.name}
                </h1>
                <p className="text-base">{user.headline}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <FlagChip
                    state={user.state}
                    width={18}
                    className="rounded-sm"
                  />{" "}
                  {user.org} ·{" "}
                  {user.state === "US"
                    ? "United States"
                    : stateName(user.state)}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{user.handle} · Joined {longDate(user.joined)}
                </p>
              </div>
              <div>
                <FollowButton />
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span className="flex items-center gap-1">
                  <Reputation value={s.reputation} />{" "}
                  <span className="text-muted-foreground">Reputation</span>
                </span>
                <span>
                  <b>{compact.format(s.upvotes)}</b>{" "}
                  <span className="text-muted-foreground">Upvotes</span>
                </span>
                <span>
                  <b>{compact.format(s.followers)}</b>{" "}
                  <span className="text-muted-foreground">Followers</span>
                </span>
                <span>
                  <b>{compact.format(s.following)}</b>{" "}
                  <span className="text-muted-foreground">Following</span>
                </span>
              </div>
            </div>
          </header>

          <div className="typeset w-full flex-1 pb-16 sm:pb-0">
            <H2>About</H2>
            <div className="not-typeset flex gap-2">
              {user.links.map((l) => {
                const Icon = LINK_ICONS[l.kind]
                return (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={l.kind}
                    className="flex size-9 items-center justify-center rounded-lg border text-foreground hover:bg-muted"
                  >
                    <Icon className="size-4" />
                  </a>
                )
              })}
            </div>
            {user.bio.map((p) => (
              <p key={p}>{p}</p>
            ))}

            <hr />
            <H2>Issues</H2>
            <div className="not-typeset mt-4 flex flex-wrap gap-2">
              {user.issues.map((slug) => (
                <Link
                  key={slug}
                  href={`/tags/${slug}`}
                  className="rounded-xl border px-3 py-1.5 text-sm font-medium text-foreground no-underline hover:bg-muted"
                >
                  {tagName(slug)}
                </Link>
              ))}
            </div>

            <hr />
            <H2 id="hot-takes">Hot Takes</H2>
            <ul className="not-typeset mt-4 flex flex-col gap-3">
              {user.takes.map((t) => (
                <li
                  key={t.title}
                  className="flex items-center gap-4 rounded-2xl bg-muted/60 p-4"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-2xl">
                    {t.emoji}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{t.title}</span>
                    {t.sub && (
                      <span className="text-sm text-muted-foreground">
                        {t.sub}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums">
                    <IconArrowBigUp className="size-4" /> {t.upvotes}
                  </span>
                </li>
              ))}
            </ul>

            <hr />
            <H2>Activity</H2>
            <ActivityTabs
              tabs={[
                {
                  value: "posts",
                  label: "Posts",
                  content: (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {user.posts.map((p) => (
                        <PostCard key={p.title} post={p} user={user} />
                      ))}
                    </div>
                  ),
                },
                {
                  value: "replies",
                  label: "Replies",
                  content: (
                    <ul className="flex flex-col divide-y">
                      {user.replies.map((r) => (
                        <li key={r.text} className="flex flex-col gap-1 py-3">
                          <span className="text-xs text-muted-foreground">
                            On{" "}
                            <span className="font-medium text-foreground">
                              {r.on}
                            </span>{" "}
                            · {ago(r.day)}
                          </span>
                          <span className="text-sm">{r.text}</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <IconArrowBigUp className="size-3.5" /> {r.upvotes}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ),
                },
                {
                  value: "upvoted",
                  label: "Upvoted",
                  content: (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {user.upvoted.map((p) => (
                        <PostCard key={p.title} post={p} user={user} />
                      ))}
                    </div>
                  ),
                },
              ]}
            />

            <hr />
            <H2>Work Experience</H2>
            <ul className="not-typeset mt-4 flex flex-col gap-5">
              {user.work.map((job) => (
                <li key={job.org} className="flex gap-3">
                  {/House|Assembly|Senate/.test(job.org) ? (
                    <ChamberSeal
                      state={job.org.startsWith("U.S.") ? "US" : job.state}
                      chamber={
                        /Senate/.test(job.org)
                          ? "Senate"
                          : /Assembly/.test(job.org)
                            ? "Assembly"
                            : "House"
                      }
                      size={40}
                    />
                  ) : (
                    <UserAvatar
                      name={job.org}
                      handle={job.org}
                      size={40}
                      className="rounded-full"
                    />
                  )}
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{job.org}</span>
                      {!job.roles.some((r) => r.to) && (
                        <span className="rounded-md border px-1.5 text-xs">
                          Current
                        </span>
                      )}
                      {job.verified && (
                        <span className="rounded-md bg-emerald-500/15 px-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                          Verified
                        </span>
                      )}
                    </div>
                    {job.roles.map((r) => (
                      <div
                        key={r.title}
                        className="flex flex-col border-l pl-3"
                      >
                        <span className="text-sm font-medium">{r.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {monthYear(r.from)} –{" "}
                          {r.to ? monthYear(r.to) : "Present"}
                        </span>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <BackToTop />
        </div>
      </div>
      <RightRailSheet>
        <div className="flex flex-col gap-4">
          <ReadingOverview user={user} />
          <Desks user={user} />
          <PublicRail />
        </div>
      </RightRailSheet>
    </div>
  )
}
