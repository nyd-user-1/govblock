import { stateName } from "@/lib/filters"
import { q } from "@/lib/policy/db"
import { fmtNumber } from "@/lib/format"
import { JurisdictionIndex } from "@/components/library/jurisdiction-index"

// The Laws index, on the Bulk Datasets doc's design: a line, then every
// jurisdiction as a link to its own law.
//
// The line above the list says which jurisdictions hold law today, because the
// list itself cannot: every jurisdiction is a link whether or not its law has
// been loaded, and a reader who clicks four in a row and is told "not here
// yet" four times deserves to have been told once, first.
const title = "Laws"
const description = "The standing law of every jurisdiction — every section, searchable, free to read."

export const metadata = { title, description }
export const revalidate = 3600

export default async function LawsIndexPage() {
  const held = await q<{ state: string; sections: number }>(
    `select state, count(*) filter (where doc_type in ('SECTION', 'RULE', 'JOINT_RULE', 'PREAMBLE'))::int sections
       from "Laws" group by state order by sections desc`
  ).catch(() => [])

  return (
    <JurisdictionIndex
      title={title}
      description={description}
      slug="/laws"
      previous={{ name: "Amendments", url: "/amendments" }}
      next={{ name: "Committees", url: "/committees" }}
      base="/laws"
    >
      {held.length > 0 && (
        <p>
          On file today:{" "}
          {held.map((row, i) => (
            <span key={row.state}>
              {i > 0 ? (i === held.length - 1 ? " and " : ", ") : ""}
              {row.state === "US" ? "U.S. Congress" : stateName(row.state)} ({fmtNumber(Number(row.sections))} sections)
            </span>
          ))}
          . The rest name their publisher and link to where their law is free to read today.
        </p>
      )}
    </JurisdictionIndex>
  )
}
