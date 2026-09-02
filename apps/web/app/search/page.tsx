"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { SearchDirectory } from "@/components/directory-search"
import { DocsPage } from "@/components/docs-page"
import { memberHref, stateName } from "@/lib/filters"
import { fmtDate } from "@/lib/format"
import { ChamberSeal, FlagChip, MemberPortrait } from "@/components/policy/imagery"
import { RecordItem, RecordList } from "@/components/policy/record-item"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { usePolicy } from "@/lib/policy/use-policy"
import { matchPages } from "@/lib/search-pages"

// Search, as a page: the header menu's pass with the brakes off. Same route,
// but this page asks for every jurisdiction (`all=1`) and for the bill text
// itself (`text=1`), so one query string answers in six sections — bills, text,
// members, committees, topics, pages — each rendered only when it has rows, and
// each row carrying the jurisdiction it actually came from.

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
    state: string
  }[]
  members: {
    people_id: number
    name: string
    party: string
    role: string
    chamber: string
    district: string
    state: string
    active: boolean
  }[]
  committees: { committee: string; bills: number; chamber: string; state: string }[]
  texts: {
    bill_id: number
    document_id: number
    state: string
    bill_number: string
    title: string
    snippet: string
  }[]
}

// ts_headline wraps the match in « », not in HTML — nothing has to trust markup
// coming out of the database. A snippet is therefore split on the guillemets and
// the odd pieces are the hits. (A bill that itself contains a « would show a
// stray highlight; across 3.3 M documents that is a better trade than
// dangerouslySetInnerHTML.)
function Snippet({ text }: { text: string }) {
  const pieces = text.split(/[«»]/)
  return (
    <span className="min-w-0 flex-1 text-muted-foreground">
      {pieces.map((piece, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-[2px] bg-primary/15 px-0.5 text-foreground">
            {piece}
          </mark>
        ) : (
          <React.Fragment key={i}>{piece}</React.Fragment>
        )
      )}
    </span>
  )
}

// The section's bordered box and its `divide-y` are gone: the canon puts a 1 px
// rule on the item itself, and a box around a list of ruled items draws the same
// line twice and boxes it as well.
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (!count) return null
  return (
    <section className="flex flex-col">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} <span className="tabular-nums">({count})</span>
      </h2>
      <RecordList className="mt-2 mb-2">{children}</RecordList>
    </section>
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
  // all=1 and text=1 are what separate this page from the ⌘K menu on the same
  // route: only /search searches every jurisdiction's bills and committees, and
  // only /search pays for the pass over "BillTexts". Every row below renders its
  // own jurisdiction, which is what earns the flag.
  const { data, isLoading } = usePolicy<SearchPayload>(active ? "search" : null, filters, {
    q: debounced.trim(),
    limit: 20,
    all: 1,
    text: 1,
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
  const texts = data?.texts ?? []
  const total = bills.length + members.length + committees.length + texts.length + topics.length + pages.length
  const here = stateName(state) || "this jurisdiction"

  return (
    <div className="flex flex-col gap-6" data-scope-content>
      <SearchDirectory
        query={query}
        setQuery={(value) => setQuery(value ?? "")}
        registriesCount={total}
        placeholder={`Search ${here} and every jurisdiction...`}
        noun="result"
      />
      {debounced.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Type at least two characters — a bill number, a name, a committee, a topic, a page, or a
          phrase from a bill&rsquo;s text. {here} sorts first; every other jurisdiction follows.
        </p>
      ) : isLoading && !data ? (
        <p className="text-sm text-muted-foreground">Searching every jurisdiction...</p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing in any jurisdiction for &ldquo;{debounced.trim()}&rdquo;.
        </p>
      ) : (
        <>
          <Section title="Bills" count={bills.length}>
            {bills.map((bill) => (
              <RecordItem
                key={bill.bill_id}
                href={`/docs/bills/${bill.bill_id}?state=${bill.state}`}
                // The flag, not a chamber seal: these results span every
                // jurisdiction, and which one a row came from is the first thing
                // a reader needs.
                avatar={<FlagChip state={bill.state} width={36} />}
                title={bill.bill_number}
                lead={bill.title}
                meta={[
                  bill.last_action_date ? fmtDate(bill.last_action_date) : null,
                  bill.status_desc,
                ]}
              />
            ))}
          </Section>
          <Section title="Text" count={texts.length}>
            {texts.map((text) => (
              <RecordItem
                key={`${text.bill_id}-${text.document_id}`}
                href={`/docs/bills/${text.bill_id}?state=${text.state}#text`}
                avatar={<FlagChip state={text.state} width={36} />}
                title={text.bill_number}
                lead={text.title}
                meta={[stateName(text.state)]}
                // The match itself is the description, highlights kept.
                description={<Snippet text={text.snippet} />}
              />
            ))}
          </Section>
          <Section title="Members" count={members.length}>
            {members.map((member) => (
              <RecordItem
                key={member.people_id}
                href={memberHref(member.people_id, member.state)}
                avatar={<MemberPortrait name={member.name} state={member.state} chamber={member.chamber} size={36} />}
                title={`${member.name}${member.active ? "" : " (Ret.)"}`}
                meta={[stateName(member.state), member.party, member.chamber, member.district]}
              />
            ))}
          </Section>
          <Section title="Committees" count={committees.length}>
            {committees.map((committee) => (
              <RecordItem
                key={`${committee.state}-${committee.committee}`}
                href={`/docs/bills?state=${committee.state}&committee=${encodeURIComponent(committee.committee)}`}
                avatar={<ChamberSeal state={committee.state} chamber={committee.chamber} size={36} />}
                title={committee.committee}
                meta={[
                  stateName(committee.state),
                  committee.chamber,
                  `${committee.bills} bills this session`,
                ]}
              />
            ))}
          </Section>
          <Section title="Topics" count={topics.length}>
            {topics.map((topic) => (
              <RecordItem
                key={topic.value}
                href={`/docs/bills?state=${state}&subject=${encodeURIComponent(topic.value)}`}
                title={topic.value}
                meta={[`${topic.count} bills`]}
              />
            ))}
          </Section>
          <Section title="Pages" count={pages.length}>
            {pages.map((page) => (
              <RecordItem key={page.href} href={page.href} title={page.name} meta={[page.group]} />
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
      description="Bills, bill text, members, committees, topics and pages — across every jurisdiction, with the one you are in first."
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
