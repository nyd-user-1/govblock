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
      previous={{ name: "Forms", url: "/forms" }}
      next={{ name: "Bulk Datasets", url: "/docs/datasets" }}
      base="/docs/api"
    >
      <p>
        The site draws every page from one record over HTTP, and the record answers anyone. Each jurisdiction below has the same
        resources under <code>/api/policy</code>, scoped by its postal code and its session; Congress has the congress.gov families as
        well. Open one to read each resource&rsquo;s options, with the query written out as curl, fetch and Python.
      </p>
      <h2>Keys and limits</h2>
      <p>
        Congress and a signed-in reader&rsquo;s home state answer without a key. Everything else on a plan answers to a key, sent as{" "}
        <code>Authorization: Bearer gb_…</code> (or <code>x-api-key</code>), minted under Settings → API. Every keyed call counts against the
        plan&rsquo;s day and month, reported in <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code> and <code>X-RateLimit-Window</code>.
        Over the limit the route answers <code>429</code> with <code>{"{ error: \"rate_limited\", limit, window, retry_at }"}</code>; an unknown or revoked
        key answers <code>401</code>; a key on the free plan answers <code>403 plan_required</code>. The same key connects the MCP server at{" "}
        <code>/api/mcp</code>, on the same quota.
      </p>
    </JurisdictionIndex>
  )
}
