import { type Metadata } from "next"
import { notFound } from "next/navigation"

import { STATE_NAMES, stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { API_RESOURCES, type ApiResource } from "@/lib/policy/api-catalog"
import { congressName } from "@/lib/policy/congress"
import { getSessionsWithTitles, latestSession } from "@/lib/policy/db-queries"
import { CommandBlock } from "@/components/command-block"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { JURISDICTIONS } from "@/components/library/jurisdiction-index"
import { H2, H3 } from "@/components/typeset"
import { UsageBlock } from "@/components/usage-block"

// One jurisdiction's API: every resource, each with a sentence, the query
// three ways and the usage figure, scoped to the jurisdiction and its latest
// session — the subjects page's command line, for all of it (Brendan,
// 2026-09-05). Cached hourly: the session changes once a year.

export const revalidate = 3600
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

const HOST = "https://policy.nysgpt.com"

const sessionName = (state: string, session: number, title: string | null) =>
  state === "US" ? congressName(session) : (title ?? "").replace(/\s*(Regular|General)\s+Session$/i, "").replace(/\s*Session$/i, "").trim() || String(session)

/** The query as curl, fetch and Python, the way the subjects page writes them. */
function examples(resource: ApiResource, state: string, session: number) {
  const scoped = resource.options.some(([name]) => name.startsWith("state"))
  const params: Record<string, string | number> = { ...(scoped ? { state, session } : {}), ...(resource.example ?? {}) }
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString().replace(/%20/g, "+")
  const url = `${HOST}/api/policy/${resource.name}?${query}`
  const py = Object.entries(params)
    .map(([k, v]) => `"${k}": ${typeof v === "number" ? v : `"${v}"`}`)
    .join(", ")
  return [
    { value: "curl", label: "curl", lines: [`curl "${url}"`] },
    { value: "fetch", label: "fetch", lines: [`const answer = await fetch("${url}")`, `  .then((response) => response.json())`] },
    { value: "python", label: "python", lines: [`answer = requests.get("${HOST}/api/policy/${resource.name}", params={${py}}).json()`] },
  ]
}

async function load(param: string) {
  const state = param.toUpperCase()
  if (!STATE_NAMES[state] || !JURISDICTIONS.some((j) => j.code === state)) return null
  const session = await latestSession(state)
  if (!session) return null
  const sessions = await getSessionsWithTitles(state).catch(() => [])
  if (!sessions.length) return null
  const title = sessions.find((r) => Number(r.session_id) === session)?.title ?? null
  return { state, session, sessionName: sessionName(state, session, title) }
}

type Props = { params: Promise<{ state: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params
  const data = await load(state)
  if (!data) return { title: "API" }
  const name = data.state === "US" ? "U.S. Congress" : stateName(data.state)
  return { title: `${name} API`, description: `Every resource of the ${name} record, scoped to the ${data.sessionName}, with the query written out.` }
}

export default async function ApiJurisdictionPage({ params }: Props) {
  const { state: param } = await params
  const data = await load(param)
  if (!data) notFound()
  const { state, session } = data
  const federal = state === "US"
  const name = federal ? "U.S. Congress" : stateName(state)
  const record = API_RESOURCES.filter((r) => !r.federal)
  const families = federal ? API_RESOURCES.filter((r) => r.federal) : []
  const at = JURISDICTIONS.findIndex((j) => j.code === state)
  const previous = JURISDICTIONS[at - 1] ?? null
  const next = JURISDICTIONS[at + 1] ?? null
  const toc = [
    { title: "The record", url: "#the-record", depth: 2 },
    ...record.map((r) => ({ title: r.name, url: `#${r.name}`, depth: 3 })),
    ...(families.length ? [{ title: "Congress", url: "#congress", depth: 2 }, ...families.map((r) => ({ title: r.name, url: `#${r.name}`, depth: 3 }))] : []),
  ]

  const section = (resource: ApiResource) => (
    <div key={resource.name}>
      <H3 id={resource.name}>{resource.name}</H3>
      <p>{resource.lead}</p>
      <CommandBlock tabs={examples(resource, state, session)} />
      <UsageBlock spec={{ usage: `/api/policy/${resource.name} [options]`, summary: resource.summary, options: resource.options }} />
    </div>
  )

  return (
    <DocsPage
      title={name}
      description={`The ${name} record over HTTP, scoped to the ${data.sessionName}: ${fmtNumber(record.length + families.length)} resources, each with its options and the query written out.`}
      slug={`/docs/api/${state.toLowerCase()}`}
      previous={previous ? { name: previous.name, url: `/docs/api/${previous.code.toLowerCase()}` } : { name: "API", url: "/docs/api" }}
      next={next ? { name: next.name, url: `/docs/api/${next.code.toLowerCase()}` } : { name: "Bulk Datasets", url: "/docs/datasets" }}
      rail={<DocsTableOfContents toc={toc} />}
    >
      <p>
        Every resource takes <code>state={state}</code>, and <code>session={session}</code> for {data.sessionName}; leave the session off and the
        route answers the current one. The examples below are written for {name}
        {federal ? ", with the congress.gov families beneath the record" : ""}.
      </p>
      <hr />
      <H2>The record</H2>
      <p>What every jurisdiction has: the bills, the people, the committees and the votes, from the same tables the pages read.</p>
      {record.map(section)}
      {families.length > 0 && (
        <>
          <hr />
          <H2>Congress</H2>
          <p>What congress.gov and govinfo add for a federal bill and a federal member, harvested nightly into tables of their own.</p>
          {families.map(section)}
        </>
      )}
    </DocsPage>
  )
}
