import { DocsPage } from "@/components/docs-page"
import { dayList, stateTotals } from "@/lib/gdelt/days"
import { FlagChip } from "@/components/policy/imagery"
import { RecordItem, RecordList } from "@/components/policy/record-item"
import { stateName } from "@/lib/filters"

// Legislative coverage by jurisdiction: a state's own press, the bills its
// stories link to, and the people they name, across every day on file.
const title = "Legislative news by state"
const description = "Which legislatures the press is writing about, state by state, and which of their bills the coverage names."

export const metadata = { title, description }

export default function StatesPage() {
  const totals = stateTotals()
  const days = dayList()
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/gdelt/state"
      previous={{ name: "By day", url: "/gdelt/day" }}
      next={{ name: "GDELT", url: "/gdelt" }}
    >
      <RecordList className="mt-0 mb-0">
        {totals.map((row) => (
          <RecordItem
            key={row.code}
            href={`/gdelt/state/${row.code.toLowerCase()}`}
            avatar={<FlagChip state={row.code} width={28} />}
            title={row.code === "US" ? "Congress" : stateName(row.code)}
            meta={[`${row.articles.toLocaleString()} articles`, `${row.outlets} outlets`, row.bills ? `${row.bills} bills` : null, `${row.days} of ${days.length} days`]}
          />
        ))}
      </RecordList>
      {totals.length === 0 ? <p className="text-sm text-muted-foreground">No days on file yet.</p> : null}
    </DocsPage>
  )
}
