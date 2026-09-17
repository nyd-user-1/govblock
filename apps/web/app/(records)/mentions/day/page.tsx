import { DocsPage } from "@/components/docs-page"
import { dayList, getDay } from "@/lib/gdelt/days"
import { RecordItem, RecordList } from "@/components/policy/record-item"

// Every day on file, newest first: the round-up's index.
const title = "Legislative news by day"
const description = "What the American press published about legislation, a day at a time, read out of GDELT's own files the morning after."

export const metadata = { title, description }

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
const longDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`

export default function DaysPage() {
  const days = dayList()
  return (
    <DocsPage title={title} description={description} slug="/mentions/day" previous={{ name: "Mentions", url: "/mentions" }} next={{ name: "By state", url: "/mentions/state" }}>
      <RecordList className="mt-0 mb-0">
        {days.map((date) => {
          const day = getDay(date)!
          return (
            <RecordItem
              key={date}
              href={`/mentions/day/${date}`}
              title={longDate(date)}
              lead={day.bills[0] ? `${day.bills[0].label}: ${day.bills[0].stories[0]?.title ?? ""}` : null}
              meta={[`${day.articles.toLocaleString()} articles`, `${day.billCount} bills`, `${day.quoteCount} quotations`, `${day.states.length} states`]}
            />
          )
        })}
      </RecordList>
      {days.length === 0 ? <p className="text-sm text-muted-foreground">No days on file yet.</p> : null}
    </DocsPage>
  )
}
