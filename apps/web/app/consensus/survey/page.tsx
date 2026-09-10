import { DocsPage } from "@/components/docs-page"
import { Survey } from "@/components/consensus/survey"
import { conversation, conversations } from "@/lib/consensus/data"

// /consensus/survey — where a conversation is voted on.
const title = "Survey"
const description =
  "One statement at a time: agree, disagree or pass. Passing is a real answer."

export const metadata = { title, description }

export default async function ConsensusSurveyPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { c: slug } = await searchParams
  const c = conversation(slug ?? "") ?? conversations()[0]!
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/consensus/survey"
      previous={{ name: "Report", url: "/consensus/report" }}
      next={{ name: "Admin", url: "/consensus/admin" }}
    >
      <div data-not-typeset="true" className="my-8">
        <Survey conversation={c} />
      </div>
    </DocsPage>
  )
}
