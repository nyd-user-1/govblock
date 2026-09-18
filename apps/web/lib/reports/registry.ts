// GovBlock's reports (2026-09-17), as /research lists them: each counts one
// question from the record and answers it in numbered parts (Brendan,
// 2026-09-18: every report on the numbered layout). Figures are counted when
// the page is built.

export type Report = {
  slug: string
  href: string
  title: string
  dek: string
  /** The bodies of data it reads. */
  data: string[]
  published: string
}

export const REPORTS: Report[] = [
  { slug: "who-wrote-obbb", href: "/research/who-wrote-obbb", title: "Who wrote the One Big Beautiful Bill?", dek: "Every provision the lobbyists who named H.R. 1 asked about, read against the enacted text: the business asks became permanent law; clean energy, Medicaid and the AI moratorium lost.", data: ["Lobbying", "Public Law 119-21", "Roll calls"], published: "2026-09-18" },
  { slug: "crypto-money", href: "/research/crypto-money", title: "Crypto money and the crypto votes: backed House Democrats voted yes twice as often", dek: "Nearly $150 million from the crypto industry's super PACs, set against every member's vote on the GENIUS Act, the CLARITY Act and the Anti-CBDC bill, and the lobbying behind them.", data: ["FEC", "Roll calls", "Lobbying"], published: "2026-09-18" },
  { slug: "hr1", href: "/research/hr1", title: "H.R. 1, from the lobbyists to the vote to the money", dek: "The most-lobbied bill of the 119th Congress followed across four records: the bill, its lobbying disclosures, both chambers' roll calls, and the outside money after.", data: ["Bills", "Lobbying", "Roll calls", "FEC"], published: "2026-09-17" },
  { slug: "open-primaries", href: "/research/open-primaries", title: "Open primaries: the bills, the laws, and the money", dek: "Every bill on who may vote in a primary since 2009, the thirteen that became law, and who paid for the 2024 ballot fights.", data: ["Bills", "Ballot measures"], published: "2026-09-17" },
  { slug: "house-elections", href: "/research/house-elections", title: "Fifty years of House elections: how few seats November decides", dek: "Every House general election since 1976, the state legislatures since 2008, and six hundred ranked-choice counts.", data: ["Election returns"], published: "2026-09-17" },
  { slug: "fec-money", href: "/research/fec-money", title: "Where Congress's money comes from", dek: "The 2024 cycle from the FEC's own numbers: out-of-state money, small and large gifts, and the outside spending aimed at members.", data: ["FEC"], published: "2026-09-17" },
  { slug: "government-forms", href: "/research/government-forms", title: "Government forms: 392,182 PDFs, and how few can be filled in", dek: "Federal, New York State and New York City forms, opened and measured: pages, fillable fields, and where the copy came from.", data: ["Forms"], published: "2026-09-17" },
  { slug: "party-line-votes", href: "/research/party-line-votes", title: "How often the House splits along party lines", dek: "Every House roll call of the 119th Congress, counted by party: which kinds of vote split, and who crosses.", data: ["Roll calls"], published: "2026-09-14" },
]

export const reportBySlug = (slug: string) => REPORTS.find((r) => r.slug === slug)
