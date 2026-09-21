import { type Metadata } from "next"
import { notFound } from "next/navigation"

import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { congressName } from "@/lib/policy/congress"
import { getBills, getSessionsWithTitles, getSubjectSummary, getSubjectTerms, latestSession } from "@/lib/policy/db-queries"
import { subjectSlug } from "@/lib/policy/subject-kinds"
import { DocsTableOfContents } from "@/components/docs-toc"
import { DocsPage } from "@/components/docs-page"
import { RecordFacts } from "@/components/record-header"
import { SubjectBills } from "@/components/subjects/subject-bills"
import { H2, H3 } from "@/components/typeset"

// One term's bills — our version of congress.gov's search for a subject
// (Brendan, 2026-09-05), on the member and bill pages' design: an
// Introduction that says what the record holds, then the session as the
// section with the bills beneath it, paged, with the order and the chamber
// in a drawer.
//
// The path names the kind, the jurisdiction and the term — a policy area at
// /policy-areas/us/health, a legislative subject at /legislative-subjects/us/… —
// and the session is the jurisdiction's latest, so the page reads no search
// params and stays cached hourly, as the bill page does.

// Route settings belong to the two routes that mount this, not to it.



const sessionName = (state: string, session: number, title: string | null) =>
  state === "US" ? congressName(session) : (title ?? "").replace(/\s*(Regular|General)\s+Session$/i, "").replace(/\s*Session$/i, "").trim() || String(session)

async function load(stateParam: string, slug: string) {
  const state = stateParam.toUpperCase()
  if (!/^[A-Z]{2}$/.test(state)) return null
  const session = await latestSession(state)
  if (!session) return null
  const f = { state, session }
  const terms = await getSubjectTerms(f)
  const lists = [
    { kind: "policy area" as const, terms: terms.policyAreas },
    { kind: "legislative subject" as const, terms: terms.subjects },
  ]
  for (const list of lists) {
    const at = list.terms.findIndex((term) => subjectSlug(term.name) === slug)
    if (at < 0) continue
    const term = list.terms[at]
    const [summary, page, sessions] = await Promise.all([
      getSubjectSummary(f, term.name),
      getBills({ ...f, subject: term.name }, 10, 0, "newest"),
      state === "US" ? Promise.resolve([]) : getSessionsWithTitles(state).catch(() => []),
    ])
    const title = sessions.find((r) => Number(r.session_id) === session)?.title ?? null
    return {
      state,
      session,
      sessionName: sessionName(state, session, title),
      kind: list.kind,
      term,
      summary,
      page,
      previous: list.terms[at - 1] ?? null,
      next: list.terms[at + 1] ?? null,
      areas: terms.policyAreas.length,
    }
  }
  return null
}

export type Props = { params: Promise<{ state: string; slug: string }> }

export async function subjectMetadata({ params }: Props): Promise<Metadata> {
  const { state, slug } = await params
  const data = await load(state, slug)
  if (!data) return { title: "Subject" }
  return {
    title: data.term.name,
    description: `The ${fmtNumber(data.summary.bills)} bills of the ${data.sessionName} filed under ${data.term.name}, newest first.`,
  }
}

export async function SubjectPage({ params }: Props) {
  const { state, slug } = await params
  const data = await load(state, slug)
  if (!data) notFound()
  const { term, kind, summary, page, previous, next, sessionName: session } = data
  const congress = data.state === "US"
  const who = congress ? "The Congressional Research Service" : `The ${stateName(data.state)} legislature`
  const sessionPhrase = congress ? `the ${session}` : `the ${session} session`
  const href = (name: string) => `/policy-areas/${data.state.toLowerCase()}/${subjectSlug(name)}?state=${data.state}`
  const status = (names: string[]) => summary.statuses.filter((row) => names.includes(row.status)).reduce((sum, row) => sum + row.bills, 0)
  const passed = status(["Engrossed", "Enrolled", "Passed"])
  const law = status(["Passed"])
  const busiest = summary.committees[0] ?? null
  const description = `The ${fmtNumber(summary.bills)} ${summary.bills === 1 ? "bill" : "bills"} of ${sessionPhrase} filed under ${term.name}, newest first.`
  const markdown = [`# ${term.name}`, "", description].join("\n")
  const toc = [
    { title: "Summary", url: "#summary", depth: 2 },
    { title: "Record", url: "#record", depth: 2 },
    { title: "Bills", url: "#bills", depth: 3 },
  ]

  return (
    <DocsPage
      title={term.name}
      description={description}
      page={markdown}
      lead={<RecordFacts meta={[kind === "policy area" ? "Policy area" : congress ? "Legislative subject" : "Subject", `${fmtNumber(summary.bills)} ${summary.bills === 1 ? "bill" : "bills"}`]} />}
      slug={`/policy-areas/${data.state.toLowerCase()}/${slug}`}
      previous={previous ? { name: previous.name, url: href(previous.name) } : undefined}
      next={next ? { name: next.name, url: href(next.name) } : undefined}
      rail={<DocsTableOfContents toc={toc} />}
    >
      <H2>Summary</H2>
      <p>
        {who} files <code>{fmtNumber(summary.bills)}</code> {summary.bills === 1 ? "bill" : "bills"} of {sessionPhrase} under{" "}
        <code>{term.name}</code>
        {congress ? <>, {kind === "policy area" ? <>one of its <code>{fmtNumber(data.areas)}</code> policy areas</> : "a legislative subject"}</> : null}.
        {summary.bills > 0 && (
          <>
            {" "}
            <code>{fmtNumber(passed)}</code> {passed === 1 ? "has" : "have"} passed at least one chamber
            {law ? (
              <>
                {" "}
                and <code>{fmtNumber(law)}</code> {law === 1 ? "has" : "have"} become law
              </>
            ) : null}
            {busiest ? (
              <>
                ; most sit before <code>{busiest.committee}</code>
              </>
            ) : null}
            .
          </>
        )}
      </p>

      <hr />
      <H2>Record</H2>
      <p>
        In {sessionPhrase}, <code>{fmtNumber(summary.bills)}</code> {summary.bills === 1 ? "bill carries" : "bills carry"} the term
        {summary.chambers.length > 1 ? (
          <>
            : <code>{fmtNumber(summary.chambers[0].bills)}</code> from the {summary.chambers[0].chamber} and{" "}
            <code>{fmtNumber(summary.chambers[1].bills)}</code> from the {summary.chambers[1].chamber}
          </>
        ) : summary.chambers[0] ? (
          <>, all from the {summary.chambers[0].chamber}</>
        ) : null}
        .
      </p>
      <H3>Bills</H3>
      <p>
        The bills, newest action first. The order and the chamber are in the Sort control at the block&rsquo;s right.
      </p>
      <SubjectBills
        state={data.state}
        session={data.session}
        subject={term.name}
        bills={page.rows}
        total={page.total}
        chambers={summary.chambers.map((row) => row.chamber)}
      />
    </DocsPage>
  )
}
