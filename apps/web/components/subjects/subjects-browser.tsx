"use client"

import * as React from "react"

import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { congressName } from "@/lib/policy/congress"
import { subjectKind, subjectSlug, type SubjectKind } from "@/lib/policy/subject-kinds"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { useScoped } from "@/lib/policy/use-scoped"
import { CardBlock } from "@/components/policy/card-block"
import { CommandBlock } from "@/components/command-block"
import { LibraryTabs } from "@/components/library-tabs"
import { ChamberSeal } from "@/components/policy/imagery"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2, H3 } from "@/components/typeset"
import { UsageBlock } from "@/components/usage-block"

// The subjects doc: congress.gov's "find bills by subject" help, its policy
// area browse and its legislative subject term browse, as one page (Brendan,
// 2026-09-05). The prose is the docs' introduction; the two browses are the
// components index — an H2, then a grid of links three across; the term
// browse splits with the component page's tab strip; and beneath it all, our
// version of congress.gov's command-line search, on the command block and
// the CLI's usage figure.
//
// Reads in the jurisdiction in scope: CRS's terms under Congress, LegiScan's
// elsewhere. Rendered in the browser, as the committees list is, so the
// prerendered shell says nothing about a jurisdiction.

type Term = { name: string; bills: number }
type Terms = { policyAreas: Term[]; subjects: Term[]; bills: number }
const EMPTY: Terms = { policyAreas: [], subjects: [], bills: 0 }

const KINDS: { value: SubjectKind; label: string }[] = [
  { value: "general", label: "General" },
  { value: "organization", label: "Organizations" },
  { value: "geographic", label: "Geographic" },
]

/**
 * The terms on the card block every page shares — the committee card, the
 * jurisdiction's seal, the name, the bill count — two to a row, three rows
 * showing and See more for the rest (Brendan, 2026-09-05).
 */
function TermGrid({ terms, state }: { terms: Term[]; state: string }) {
  const cards = terms.map((term) => ({
    key: term.name,
    href: `/docs/subjects/${state.toLowerCase()}/${subjectSlug(term.name)}?state=${state}`,
    title: term.name,
    media: <ChamberSeal state={state} size={28} />,
    meta: `${fmtNumber(term.bills)} ${term.bills === 1 ? "Bill" : "Bills"}`,
  }))
  return <CardBlock cards={cards} initial={6} empty="No terms on file." />
}

const HOST = "https://policy.nysgpt.com"

export function SubjectsBrowser() {
  const { data, state, session, resolved, pending } = useScoped<Terms>("subject-terms", EMPTY)
  const [kind, setKind] = React.useState<SubjectKind>("general")
  const terms = data ?? EMPTY
  const congress = state === "US"
  const place = congress ? "Congress" : stateName(state)
  const sessionName = congress && session ? congressName(session) : session ? `the ${session} session` : "this session"
  const areas = terms.policyAreas
  const subjects = terms.subjects
  const byKind = React.useMemo(() => {
    const out: Record<SubjectKind, Term[]> = { general: [], organization: [], geographic: [] }
    for (const term of subjects) out[subjectKind(term.name)].push(term)
    return out
  }, [subjects])
  const top = [...areas].sort((a, b) => b.bills - a.bills)[0]
  const topSubject = [...subjects].sort((a, b) => b.bills - a.bills)[0]
  const example = top?.name ?? topSubject?.name ?? "Agriculture and Food"
  // The session rides along only when the reader chose one; left off, the
  // route answers the current session, as the usage text says.
  const scope = `state=${state}${session ? `&session=${session}` : ""}`
  const query = `${scope}&subject=${encodeURIComponent(example).replace(/%20/g, "+")}`

  return (
    <>
      <H2>Introduction</H2>
      {congress ? (
        <>
          <p>
            Every bill in Congress is filed by the Congressional Research Service under one <strong>policy area</strong>{" "}and any number of{" "}
            <strong>legislative subjects</strong>, assigned soon after the bill is introduced and revised as it moves. The policy area is the broadest
            term, one of a fixed few dozen. The legislative subjects are the specific ones, drawn from CRS&rsquo;s Legislative Indexing Vocabulary,
            and they name the topics, the organizations and the places a bill touches.
          </p>
          <p>
            {pending ? (
              <>Counting the terms of {sessionName}&hellip;</>
            ) : (
              <>
                In {sessionName}, <code>{fmtNumber(terms.bills)}</code> bills sit under <code>{fmtNumber(areas.length)}</code> policy areas and{" "}
                <code>{fmtNumber(subjects.length)}</code> legislative subjects.
                {top ? (
                  <>
                    {" "}
                    <code>{top.name}</code> holds the most bills, <code>{fmtNumber(top.bills)}</code>.
                  </>
                ) : null}
              </>
            )}
          </p>
          <ul>
            <li>
              <strong>Policy areas</strong>{" "}answer &ldquo;what is this bill about, broadly?&rdquo; Every bill has exactly one.
            </li>
            <li>
              <strong>Legislative subjects</strong>{" "}answer &ldquo;what does it touch?&rdquo; A bill can carry hundreds; an appropriations act does.
            </li>
            <li>
              <strong>Organizations and places</strong>{" "}are legislative subjects too. They are listed apart below, so a body or a country can be found
              by name.
            </li>
          </ul>
          <p>
            Open a term to read every bill under it, newest first. Every list on this page is also a query on the record, and the command line at
            the foot shows how to ask it directly.
          </p>
        </>
      ) : (
        <>
          <p>
            Every bill in the {place} legislature carries the <strong>subjects</strong>{" "}its own bill drafting service assigns, as LegiScan records
            them. Some legislatures file a handful of broad terms; some none at all.
          </p>
          <p>
            {pending ? (
              <>Counting the terms of {sessionName}&hellip;</>
            ) : subjects.length ? (
              <>
                In {sessionName}, <code>{fmtNumber(terms.bills)}</code> bills sit under <code>{fmtNumber(subjects.length)}</code> subjects.
                {topSubject ? (
                  <>
                    {" "}
                    <code>{topSubject.name}</code> holds the most, <code>{fmtNumber(topSubject.bills)}</code>.
                  </>
                ) : null}
              </>
            ) : (
              <>
                The record holds no subjects for {place} in {sessionName}. Its bills are still filed by committee and by sponsor.
              </>
            )}
          </p>
        </>
      )}

      {congress && (
        <>
          <hr />
          <H2>Policy Areas</H2>
          <p>
            {pending ? (
              <>Reading CRS&rsquo;s policy areas&hellip;</>
            ) : (
              <>
                CRS files every bill of {sessionName} under one of these <code>{fmtNumber(areas.length)}</code>, the count beside each.
              </>
            )}
          </p>
          <TermGrid terms={areas} state={state} />

          <hr />
          <H2>Legislative Subjects</H2>
          <p>
            {pending ? (
              <>Reading CRS&rsquo;s legislative subjects&hellip;</>
            ) : (
              <>
                <code>{fmtNumber(subjects.length)}</code> legislative subjects appear on bills in {sessionName}: <code>{fmtNumber(byKind.general.length)}</code>{" "}
                general terms, <code>{fmtNumber(byKind.organization.length)}</code> organizations and <code>{fmtNumber(byKind.geographic.length)}</code>{" "}
                places.
              </>
            )}
          </p>
          <LibraryTabs tabs={KINDS} value={kind} onChange={setKind} right={<ChamberSeal state="US" size={16} />} />
          <TermGrid terms={byKind[kind]} state={state} />
        </>
      )}

      {!congress && subjects.length > 0 && (
        <>
          <hr />
          <H2>Subjects</H2>
          <p>
            The {place} legislature&rsquo;s <code>{fmtNumber(subjects.length)}</code> subjects in {sessionName}, the count beside each.
          </p>
          <TermGrid terms={subjects} state={state} />
        </>
      )}

      <hr />
      <H2>Command line</H2>
      <p>
        Every list on this page is a query on the record, and the record answers over HTTP. The same query, three ways
        {resolved ? (
          <>
            , for <code>{example}</code> in {sessionName}
          </>
        ) : null}
        .
      </p>
      <CommandBlock
        tabs={[
          { value: "curl", label: "curl", lines: [`curl "${HOST}/api/policy/bills?${query}&limit=20"`] },
          { value: "fetch", label: "fetch", lines: [`const bills = await fetch("${HOST}/api/policy/bills?${query}&limit=20")`, `  .then((response) => response.json())`] },
          {
            value: "python",
            label: "python",
            lines: [
              `import requests`,
              ``,
              `bills = requests.get("${HOST}/api/policy/bills", params={`,
              `    "state": "${state}",${session ? ` "session": ${session},` : ""} "subject": "${example}", "limit": 20,`,
              `}).json()`,
            ],
          },
        ]}
      />

      <H3>bills</H3>
      <p>
        Use <code>bills</code> to list the bills of a jurisdiction, newest action first, and <code>subject</code> to keep to one term. The answer
        is <code>rows</code> and <code>total</code>, paged by <code>limit</code> and <code>offset</code>.
      </p>
      <UsageBlock
        spec={{
          usage: "/api/policy/bills [options]",
          summary: "the bills of a jurisdiction, newest action first",
          options: [
            ["state <code>", "the jurisdiction: US, or a state's postal code"],
            ["session <year>", "the session's first year (default: the current one)"],
            ["subject <term>", "a policy area or legislative subject, as CRS spells it"],
            ["chamber <name>", "House or Senate"],
            ["committee <name>", "the committee the bill sits before"],
            ["member <id>", "bills a member sponsored"],
            ["status <name>", "Introduced, Engrossed, Enrolled, Passed or Vetoed"],
            ["sort <key>", "newest (default), number-desc or number-asc"],
            ["limit <n>", "rows per page (default: 40)"],
            ["offset <n>", "rows to skip"],
          ],
        }}
      />

      <H3>subject-terms</H3>
      <p>
        Use <code>subject-terms</code> to list a jurisdiction&rsquo;s terms with the bills under each: <code>policyAreas</code> and{" "}
        <code>subjects</code> under Congress, <code>subjects</code> alone elsewhere.
      </p>
      <CommandBlock
        tabs={[
          { value: "curl", label: "curl", lines: [`curl "${HOST}/api/policy/subject-terms?${scope}"`] },
          { value: "fetch", label: "fetch", lines: [`const terms = await fetch("${HOST}/api/policy/subject-terms?${scope}")`, `  .then((response) => response.json())`] },
          { value: "python", label: "python", lines: [`terms = requests.get("${HOST}/api/policy/subject-terms", params={"state": "${state}"${session ? `, "session": ${session}` : ""}}).json()`] },
        ]}
      />
      <UsageBlock
        spec={{
          usage: "/api/policy/subject-terms [options]",
          summary: "every subject term of a jurisdiction, with its bill count",
          options: [
            ["state <code>", "the jurisdiction: US, or a state's postal code"],
            ["session <year>", "the session's first year (default: the current one)"],
          ],
        }}
      />
    </>
  )
}

/** The rail's contents: the sections the jurisdiction in scope actually has. */
export function SubjectsToc() {
  const { state } = useJurisdiction()
  const congress = state === "US"
  const toc = React.useMemo(() => {
    const items: [string, 2 | 3][] = [["Introduction", 2], ...(congress ? ([["Policy Areas", 2], ["Legislative Subjects", 2]] as [string, 2 | 3][]) : ([["Subjects", 2]] as [string, 2 | 3][]))]
    items.push(["Command line", 2], ["bills", 3], ["subject-terms", 3])
    return items.map(([title, depth]) => ({ title, url: `#${title.replace(/\s+/g, "-").toLowerCase()}`, depth }))
  }, [congress])
  return <DocsTableOfContents toc={toc} />
}
