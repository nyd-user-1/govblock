import { DocsPage } from "@/components/docs-page"
import { FormsAgenciesCard } from "@/components/policy/forms-agencies"
import { FormsList } from "@/components/policy/forms-list"

// Forms — the surface for the PDFs the 2026-08-30 harvest brought back.
//
// The sentence below is measured, not rounded, and it says both numbers: what
// we can call a form (48,684, by the cut in `forms-queries.ts`) and what we
// actually hold (369,735 fetched PDFs). The page would be easy to headline with
// the bigger number, and that would be a claim about US DOL's arbitration
// decisions that nobody checked.
const title = "Forms"
const description =
  "48,684 forms from 26 federal, New York State and New York City agencies — searchable by number, title or filename, and drawn from the 369,735 government PDFs we hold."

export const metadata = { title, description }

export default function FormsPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/docs/forms"
      previous={{ name: "Finance", url: "/docs/money" }}
      next={{ name: "Bills", url: "/docs/bills" }}
      rail={<FormsAgenciesCard compact />}
    >
      <FormsList />
    </DocsPage>
  )
}
