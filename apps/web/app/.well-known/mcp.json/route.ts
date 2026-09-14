import { siteConfig } from "@/lib/config"

/**
 * /.well-known/mcp.json — the GovBlocks MCP server card (2026-09-13), so an
 * agent can discover the server at /api/mcp without being told. The route is
 * the implementation and this is the advertisement; if they disagree, the
 * route wins and this file is the bug.
 */

export const dynamic = "force-dynamic"

const TOOLS: [string, string][] = [
  ["search", "Bills, members and committees across every jurisdiction, by topic, name or number."],
  ["list_bills", "Bills in one jurisdiction and session, by committee, chamber, subject or status."],
  ["get_bill", "One bill in full: status, sponsors, history, the texts on file."],
  ["get_bill_text", "A bill's text, in windows."],
  ["bill_votes", "Every roll call taken on one bill."],
  ["list_members", "Who sits in one jurisdiction and session."],
  ["get_member", "One legislator in full."],
  ["list_committees", "Every committee and what is before it."],
  ["get_committee", "One committee: roster, bills, hearings."],
  ["list_roll_calls", "The newest roll-call votes."],
  ["get_roll_call", "One roll call with every member's vote."],
  ["calendar", "Hearings and floor events between two dates."],
  ["record_status", "Which jurisdictions and sessions the record holds."],
]

export function GET() {
  const site = siteConfig.url
  return Response.json(
    {
      name: "GovBlocks",
      description: "The legislative record of the United States Congress and all fifty state legislatures: every bill, member, committee, roll call and hearing, read live.",
      version: "1.0.0",
      documentationUrl: `${site}/docs/api`,
      iconUrl: `${site}/icon.svg`,
      icons: [{ src: `${site}/icon.svg`, mimeType: "image/svg+xml", sizes: ["any"] }],
      remotes: [{ type: "streamable-http", url: `${site}/api/mcp`, transport: "streamable-http" }],
      authentication: { type: "bearer", description: "A GovBlocks API key (gb_…) from Settings → API, sent as Authorization: Bearer." },
      capabilities: { tools: true, resources: false, prompts: false, sampling: false },
      tools: TOOLS.map(([name, description]) => ({ name, description })),
    },
    { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } }
  )
}
