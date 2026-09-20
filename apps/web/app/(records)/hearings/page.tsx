import { fmtNumber } from "@/lib/format"
import { getHearingIndex } from "@/lib/policy/committee-queries"
import { DocsPage } from "@/components/docs-page"
import { HearingIndex } from "@/components/policy/hearing-page"

// The hearings doc: the newest hearings with their transcripts. Congress
// only: no state publishes its hearings as a record we can hold. On the docs
// shell (components/docs-page.tsx) since 2026-09-20; until then it carried a
// copy of the shell's markup.
const title = "Hearings"

export const revalidate = 3600

export const metadata = { title, description: "Every hearing of the 119th Congress on file, with its transcript where the Government Publishing Office has printed one." }

export default async function HearingsPage() {
  const index = await getHearingIndex(20, 0).catch(() => ({ rows: [], total: 0 }))
  const description = `${fmtNumber(index.total)} hearings of the 119th Congress, newest first, each with its transcript where the Government Publishing Office has printed one.`
  return (
    <DocsPage title={title} description={description} slug="/hearings" previous={{ name: "Committees", url: "/committees" }} next={{ name: "Nominations", url: "/nominations" }}>
      <HearingIndex rows={index.rows} total={index.total} />
    </DocsPage>
  )
}
