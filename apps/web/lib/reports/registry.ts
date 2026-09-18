// GovBlock's reports (2026-09-17), as /reports lists them: the numbered
// studies, which count one question and answer it in numbered parts, and the
// trace reports, which show the work step by step. Each report's figures are
// counted from the record when its page is built.

export type ReportKind = "numbered" | "trace"

export type Report = {
  slug: string
  href: string
  title: string
  dek: string
  kind: ReportKind
  /** The bodies of data it reads. */
  data: string[]
  published: string
}

export const REPORTS: Report[] = [
  { slug: "hr1-trace", href: "/reports/hr1-trace", title: "H.R. 1, from the lobbyists to the vote to the money", dek: "The most-lobbied bill of the 119th Congress followed across four records: the bill, its lobbying disclosures, both chambers' roll calls, and the outside money after.", kind: "trace", data: ["Bills", "Lobbying", "Roll calls", "FEC"], published: "2026-09-17" },
  { slug: "open-primaries", href: "/reports/open-primaries", title: "Open primaries: the bills, the laws, and the money", dek: "Every bill on who may vote in a primary since 2009, the thirteen that became law, and who paid for the 2024 ballot fights.", kind: "trace", data: ["Bills", "Ballot measures"], published: "2026-09-17" },
  { slug: "house-elections", href: "/reports/house-elections", title: "Fifty years of House elections: how few seats November decides", dek: "Every House general election since 1976, the state legislatures since 2008, and six hundred ranked-choice counts.", kind: "trace", data: ["Election returns"], published: "2026-09-17" },
  { slug: "fec-money", href: "/reports/fec-money", title: "Where Congress's money comes from", dek: "The 2024 cycle from the FEC's own numbers: out-of-state money, small and large gifts, and the outside spending aimed at members.", kind: "numbered", data: ["FEC"], published: "2026-09-17" },
  { slug: "government-forms", href: "/reports/government-forms", title: "Government forms: 392,182 PDFs, and how few can be filled in", dek: "Federal, New York State and New York City forms, opened and measured: pages, fillable fields, and where the copy came from.", kind: "numbered", data: ["Forms"], published: "2026-09-17" },
  { slug: "party-line-votes", href: "/research/party-line-votes", title: "How often the House splits along party lines", dek: "Every House roll call of the 119th Congress, counted by party: which kinds of vote split, and who crosses.", kind: "numbered", data: ["Roll calls"], published: "2026-09-14" },
]

export const reportBySlug = (slug: string) => REPORTS.find((r) => r.slug === slug)
