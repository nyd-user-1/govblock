"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { SearchDirectory } from "@/components/directory-search"
import { DocsPage } from "@/components/docs-page"
import { memberHref, stateName } from "@/lib/filters"
import { FlagChip } from "@/components/policy/imagery"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { usePolicy } from "@/lib/policy/use-policy"
import { matchPages } from "@/lib/search-pages"

// Search, as a page: the same scoped pass the header menu runs, with room to
// show everything it found. One query string, five sections — bills, members,
// committees, topics, pages — each rendered only when it has rows.

type SearchPayload = {
  q: string
  state: string
  session: number
  bills: {
    bill_id: number
    bill_number: string
    title: string
    status_desc: string | null
    last_action_date: string | null
  }[]
  members: {
    people_id: number
    name: string
    party: string
    role: string
    chamber: string
    district: string
    state: string
  }[]
  committees: { committee: string; bills: number; chamber: string }[]
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (!count) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} <span className="tabular-nums">({count})</span>
      </h2>
      <div className="divide-y divide-border rounded-lg border">{children}</div>
    </section>
  )
}

function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-baseline gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50">
      {children}
    </Link>
  )
}

function SearchResults() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state, session, resolved } = useJurisdiction()

  const urlQuery = searchParams.get("q") ?? ""
  const [query, setQuery] = React.useState(urlQuery)
  const [debounced, setDebounced] = React.useState(urlQuery)

  // The URL is the source of truth: the header menu lands here with ?q=, and
  // typing writes back to it (debounced) so the result is shareable.
  React.useEffect(() => {
    setQuery((previous) => (previous === urlQuery ? previous : urlQuery))
    setDebounced(urlQuery)
  }, [urlQuery])

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setDebounced(query)
      const params = new URLSearchParams(searchParams)
      if (query) params.set("q", query)
      else params.delete("q")
      router.replace(`/search${params.size ? `?${params}` : ""}`, { scroll: false })
    }, 250)
    return () => clearTimeout(handle)
    // searchParams is read fresh inside; keying on it would loop on our own replace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, router])

  const active = resolved && debounced.trim().length >= 2
  const filters = { state, session: session ? String(session) : undefined }
  const { data, isLoading } = usePolicy<SearchPayload>(active ? "search" : null, filters, {
    q: debounced.trim(),
    limit: 20,
  })
  const { data: subjects } = usePolicy<{ value: string; count: number }[]>(resolved ? "subjects" : null, filters)

  const topics = React.useMemo(() => {
    const t = debounced.trim().toLowerCase()
    if (t.length < 2 || !subjects) return []
    return subjects.filter((s) => s.value.toLowerCase().includes(t)).slice(0, 12)
  }, [subjects, debounced])

  const pages = matchPages(debounced)
  const bills = data?.bills ?? []
  const members = data?.members ?? []
  const committees = data?.committees ?? []
  const total = bills.length + members.length + committees.length + topics.length + pages.length
  const here = stateName(state) || "this jurisdiction"

  return (
    <div className="flex flex-col gap-6" data-scope-content>
      <SearchDirectory
        query={query}
        setQuery={(value) => setQuery(value ?? "")}
        registriesCount={total}
        placeholder={`Search ${here}...`}
        noun="result"
      />
      {debounced.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Type at least two characters — a bill number, a name, a committee, a topic, a page.
        </p>
      ) : isLoading && !data ? (
        <p className="text-sm text-muted-foreground">Searching {here}...</p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing under {here} for &ldquo;{debounced.trim()}&rdquo;.
        </p>
      ) : (
        <>
          <Section title="Bills" count={bills.length}>
            {bills.map((bill) => (
              <Row key={bill.bill_id} href={`/docs/bills/${bill.bill_id}?state=${state}`}>
                <FlagChip state={state} width={20} className="self-center" />
                <span className="shrink-0 font-medium">{bill.bill_number}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{bill.title}</span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {bill.status_desc ?? ""}
                  {bill.last_action_date ? ` · ${String(bill.last_action_date).slice(0, 10)}` : ""}
                </span>
              </Row>
            ))}
          </Section>
          <Section title="Members" count={members.length}>
            {members.map((member) => (
              <Row key={member.people_id} href={memberHref(member.people_id, member.state)}>
                <FlagChip state={member.state} width={20} className="self-center" />
                <span className="shrink-0 font-medium">{member.name}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {[stateName(member.state), member.party, member.chamber, member.district].filter(Boolean).join(" · ")}
                </span>
              </Row>
            ))}
          </Section>
          <Section title="Committees" count={committees.length}>
            {committees.map((committee) => (
              <Row
                key={committee.committee}
                href={`/docs/bills?state=${state}&committee=${encodeURIComponent(committee.committee)}`}
              >
                <FlagChip state={state} width={20} className="self-center" />
                <span className="shrink-0 font-medium">{committee.committee}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {committee.chamber} · {committee.bills} bills this session
                </span>
              </Row>
            ))}
          </Section>
          <Section title="Topics" count={topics.length}>
            {topics.map((topic) => (
              <Row
                key={topic.value}
                href={`/docs/bills?state=${state}&subject=${encodeURIComponent(topic.value)}`}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{topic.value}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{topic.count} bills</span>
              </Row>
            ))}
          </Section>
          <Section title="Pages" count={pages.length}>
            {pages.map((page) => (
              <Row key={page.href} href={page.href}>
                <span className="shrink-0 font-medium">{page.name}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{page.group}</span>
              </Row>
            ))}
          </Section>
        </>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <DocsPage
      title="Search"
      description="Bills, members, committees, topics and pages, under the jurisdiction you are in."
      slug="search"
      previous={{ name: "Directory", url: "/docs/directory" }}
      next={{ name: "Bills", url: "/docs/bills" }}
    >
      <React.Suspense fallback={null}>
        <SearchResults />
      </React.Suspense>
    </DocsPage>
  )
}
