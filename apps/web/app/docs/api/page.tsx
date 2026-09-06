import { JurisdictionIndex } from "@/components/library/jurisdiction-index"

// The API doc: every resource the site reads, one page per jurisdiction
// (Brendan, 2026-09-05: "an api and data set library").
const title = "API"
const description = "Every number on the site, as JSON: one route per family, scoped by jurisdiction and session, and paged."

export const metadata = { title, description }

export default function ApiIndexPage() {
  return (
    <JurisdictionIndex
      title={title}
      description={description}
      slug="/docs/api"
      previous={{ name: "Forms", url: "/docs/forms" }}
      next={{ name: "Bulk Datasets", url: "/docs/datasets" }}
      base="/docs/api"
    >
      <p>
        The site draws every page from one record over HTTP, and the record answers anyone. Each jurisdiction below has the same
        resources under <code>/api/policy</code>, scoped by its postal code and its session; Congress has the congress.gov families as
        well. Open one to read each resource&rsquo;s options, with the query written out as curl, fetch and Python.
      </p>
    </JurisdictionIndex>
  )
}
