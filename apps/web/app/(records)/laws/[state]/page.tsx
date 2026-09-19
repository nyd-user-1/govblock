import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { STATE_NAMES, stateName } from "@/lib/filters"
import { fmtDate, fmtNumber } from "@/lib/format"
import { PUBLISHERS } from "@/lib/laws-publishers"
import { q } from "@/lib/policy/db"
import { DocsPage } from "@/components/docs-page"
import { LawDocOutline, LawDocument, LawReader } from "@/components/laws/law-reader"
import { ReaderSettingsPanel } from "@/components/laws/reader-settings-panel"
import { LawChapters, LawsList } from "@/components/laws/laws-list"
import { fillTitles, lawCitation, lawName, orderLaws, titleHeading, type LawRow } from "@/lib/law-citation"
import { jurisdictionOf, segment } from "@/lib/xml/address"

// One jurisdiction's standing law, free to read and to search. Brendan,
// 2026-09-04: "you had to pay to see the law? Give me a break."
//
// On /bills/<code>'s design since 2026-09-19 (Brendan), in the records shell:
// /laws/ak lists Alaska's laws a row each, with the chapters index in the
// right rail, and /laws/ak?law=C28.11 reads one — its text the center column,
// its outline the right rail, the arrows in the head stepping to the laws
// beside it. ?doc= opens at a section, as the
// national search's links ask. The full-width browser with its own rail of
// laws that stood here before is gone.

type Props = { params: Promise<{ state: string }>; searchParams: Promise<{ law?: string; doc?: string }> }

const of = (raw: string) => {
  const code = String(raw ?? "").toUpperCase()
  return STATE_NAMES[code] ? code : null
}

/** The page's name for the jurisdiction's law, and the name a sentence uses for the place. */
const titleOf = (code: string) => (code === "US" ? "U.S. Code" : `${stateName(code)} Laws`)
const placeOf = (code: string) => (code === "US" ? "the United States" : stateName(code))

// A law's unit in the XML library: its id lower-cased and made address-safe,
// the U.S. Code's USC07 as t7 (scripts/xml/lib/address.mjs, codeSegment).
const unitOf = (code: string, lawId: string) => {
  const usc = code === "US" ? /^USC0*(\d+)([A-Za-z]?)$/i.exec(lawId) : null
  return usc ? `t${usc[1]}${usc[2].toLowerCase()}` : segment(lawId.toLowerCase())
}

async function lawsOf(code: string) {
  const [rows, library] = await Promise.all([
    q<LawRow & { read: string | null }>(
    `select law_id, max(law_name) as law_name, max(law_type) as law_type, max(chapter) as chapter,
            count(*) filter (where doc_type = 'SECTION')::int sections, max(fetched_at)::date::text read
       from "Laws" where state = $1 group by law_id
      order by case max(law_type) when 'CONSOLIDATED' then 0 when 'MISC' then 1 when 'UNCONSOLIDATED' then 2 when 'COURT_ACTS' then 3 else 4 end, max(law_name)`,
    [code]
    ).catch(() => []),
    // The title above each law, and the name of one its source named only by
    // number, from the XML library (sql/033_library_titles.sql, 2026-09-19).
    q<{ unit: string; name: string | null; title: string | null; title_name: string | null; title_order: number | null }>(
      `select unit, name, title, title_name, title_order from xml_library where jurisdiction = $1 and kind in ('code', 'usc')`,
      [jurisdictionOf(code)]
    ).catch(() => []),
  ])
  const byUnit = new Map(library.map((l) => [l.unit, l]))
  return orderLaws(
    code,
    fillTitles(
      code,
      rows.map((r) => {
        const l = byUnit.get(unitOf(code, r.law_id))
        return { ...r, law_name: l?.name || r.law_name, title: l?.title ?? null, title_name: l?.title_name ?? null, title_order: l?.title_order == null ? null : Number(l.title_order) }
      })
    )
  )
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const code = of((await params).state)
  if (!code) return { title: "Laws" }
  const { law } = await searchParams
  const found = law ? (await lawsOf(code)).find((l) => l.law_id === law) : null
  return found
    ? { title: `${lawName(code, found)} — ${titleOf(code)}`, description: `The full text of ${lawName(code, found)}, ${lawCitation(code, found)}, ${placeOf(code)}.` }
    : { title: titleOf(code), description: `The standing law of ${placeOf(code)} — every section, searchable, free.` }
}

export default async function LawsStatePage({ params, searchParams }: Props) {
  const code = of((await params).state)
  if (!code) notFound()
  const { law, doc } = await searchParams

  const laws = await lawsOf(code)
  // Whether this jurisdiction is on file at all. A page that cannot say so
  // draws an empty list and lets a reader conclude the law does not exist.
  if (laws.length === 0) return <NotHere code={code} />

  // What the source says its text is current to, or failing that the day the
  // rows were last read. Every one of these is a copy taken at a moment.
  const read = laws.reduce<string | null>((latest, l) => (l.read && (!latest || l.read > latest) ? l.read : latest), null)
  const asOf = PUBLISHERS[code]?.asOf ?? read
  const current = asOf ? `, current to ${fmtDate(asOf)}` : ""
  const listUrl = `/laws/${code.toLowerCase()}`

  if (!law) {
    return (
      <DocsPage
        title={titleOf(code)}
        description={`The standing law of ${placeOf(code)}, law by law, each with its full text${current}.`}
        slug={listUrl}
        previous={{ name: "Laws", url: "/laws" }}
        next={{ name: "Committees", url: "/committees" }}
        rail={<LawChapters state={code} laws={laws} />}
      >
        <LawsList state={code} name={code === "US" ? "U.S. Code" : stateName(code)} laws={laws} />
      </DocsPage>
    )
  }

  const at = laws.findIndex((l) => l.law_id === law)
  if (at < 0) notFound()
  const one = laws[at]!
  const before = laws[at - 1]
  const after = laws[at + 1]
  const href = (l: LawRow) => `${listUrl}?law=${encodeURIComponent(l.law_id)}`

  const under = titleHeading(one)

  // The whole code in reading order, for the reader to scroll through (2026-09-19).
  const order = laws.map((l) => ({ id: l.law_id, name: lawName(code, l), cite: lawCitation(code, l), heading: titleHeading(l) }))

  return (
    <LawReader state={code} order={order} start={one.law_id} doc={doc ?? null} place={titleOf(code)}>
      <DocsPage
        title={lawName(code, one)}
        description={`${lawCitation(code, one)}${under ? ` of ${under.replace(" · ", ", ")}` : ""}, ${placeOf(code)}: ${fmtNumber(one.sections)} ${one.sections === 1 ? "section" : "sections"}${current}.`}
        slug={href(one)}
        previous={before ? { name: lawName(code, before), url: href(before) } : { name: titleOf(code), url: listUrl }}
        next={after ? { name: lawName(code, after), url: href(after) } : { name: titleOf(code), url: listUrl }}
        rail={<LawDocOutline />}
        railSettings={<ReaderSettingsPanel />}
      >
        <LawDocument />
      </DocsPage>
    </LawReader>
  )
}

/**
 * The jurisdiction is real and its law is public; this record does not hold it
 * yet. Say that, and say where it is in the meantime.
 */
function NotHere({ code }: { code: string }) {
  const name = stateName(code)
  const publisher = PUBLISHERS[code]
  return (
    <div className="mx-auto flex w-full max-w-160 flex-col gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Laws of {name}</h1>
      <p className="text-[1.05rem] text-muted-foreground sm:text-base">
        {publisher ? (
          <>
            Not on this record yet. {name}&rsquo;s standing law is published by {publisher.name} at{" "}
            <a href={publisher.url} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
              {new URL(publisher.url).host}
            </a>
            {publisher.vendor ? `, through ${publisher.vendor}` : ""}. It is free to read there, and it is not here yet.
          </>
        ) : (
          <>Not on this record yet, and no source has been sized for it. The survey of where every jurisdiction publishes its law is in the repository at <code>apps/web/docs/state-law-sources.md</code>.</>
        )}
      </p>
      <p className="text-sm text-muted-foreground">
        <Link href="/laws" className="text-primary underline-offset-4 hover:underline">
          Every jurisdiction
        </Link>
      </p>
    </div>
  )
}
