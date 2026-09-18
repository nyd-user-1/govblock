import "server-only"

import { n, q } from "@/lib/policy/db"

import type { ChartSpec, Tone } from "./chart-spec"

// Who wrote the One Big Beautiful Bill? (2026-09-18), by the research recipe
// (docs/research/recipe.md).
//
// 1. Question: of the provisions the lobbyists who named H.R. 1 asked about,
//    which made it into Public Law 119-21, which were cut back, and which
//    were dropped?
// 2. Coverage: Lobbying Disclosure Act filings that name H.R. 1 of the 119th
//    Congress and their issue descriptions; the Senate's roll calls on the
//    bill; the enacted text, Public Law 119-21 (govinfo, PLAW-119publ21).
// 3–4. Gather and classify: each description is matched against the
//    provision codebook below; a description can name several provisions.
// 5. Verify: each provision's outcome was read in the enacted text and is
//    cited to its section; "dropped" means the provision's language appears
//    nowhere in the law.
// 6. Outside: the enacted law from govinfo.gov.

const SLUG = "who-wrote-obbb"
const KEY = "119-HR-1"

export type Outcome = "enacted" | "cut" | "dropped"

// The codebook: a provision, the words that name it in a lobbying
// description, and what the law did with it, read from P.L. 119-21.
export const PROVISIONS: { key: string; name: string; rx: string; outcome: Outcome; law: string }[] = [
  { key: "clean", name: "Clean energy and EV credits", rx: "45Y|48E|45X|45Z|45Q|45V|clean energy|energy tax credit|renewable|solar|wind energy|hydrogen|electric vehicle|30D|Inflation Reduction Act|IRA credit", outcome: "cut", law: "Wind and solar lose the production and investment credits for projects placed in service after 2027 (§§70512–70513); the EV credits end September 30, 2025 (§§70501–70503); hydrogen's credit ends (§70511); the clean fuel credit is extended (§70521)." },
  { key: "medicaid", name: "Medicaid", rx: "Medicaid", outcome: "cut", law: "Work requirements for expansion adults (§71119), limits on provider taxes (§§71115, 71117), budget neutrality for waivers (§71118); a $50 billion Rural Health Transformation Program, 2026–2030 (§71401)." },
  { key: "rnd", name: "R&D expensing", rx: "\\m174\\M|research and development|R&D|research and experiment", outcome: "enacted", law: "Domestic research spending deductible in the year it is paid, permanently (§70302, new §174A)." },
  { key: "ai", name: "State AI law moratorium", rx: "(\\mAI\\M|artificial intelligence)[^.;]{0,80}(moratorium|preempt|state law|state regulation)|(moratorium|preempt)[^.;]{0,80}(\\mAI\\M|artificial intelligence)", outcome: "dropped", law: "Struck on the Senate floor, 99–1 (S.Amdt. 2814). The law keeps only a science-cloud program for AI models (§50404)." },
  { key: "studentloans", name: "Student loans and Pell", rx: "Grad PLUS|graduate PLUS|student loan|\\mPell\\M|loan limit", outcome: "cut", law: "Graduate PLUS loans end and new loan limits apply (§81001); repayment plans rewritten (§82001); Workforce Pell created (§83002)." },
  { key: "bonus", name: "Full expensing (bonus depreciation)", rx: "bonus depreciation|168\\(k\\)|expensing", outcome: "enacted", law: "100 percent expensing of business property made permanent (§70301)." },
  { key: "snap", name: "SNAP", rx: "\\mSNAP\\M|nutrition assistance", outcome: "cut", law: "States pay a share of benefits by their error rates from 2028 (§10105); work requirements widened (§10102); eligibility narrowed for some immigrants (§10108)." },
  { key: "spectrum", name: "Spectrum auctions", rx: "spectrum", outcome: "enacted", law: "The FCC's auction authority restored (§40002)." },
  { key: "s899", name: "Section 899 retaliatory tax", rx: "\\m899\\M|unfair foreign tax", outcome: "dropped", law: "Not in the law: the House's tax on investors from countries with 'unfair foreign taxes' appears nowhere in P.L. 119-21." },
  { key: "rural", name: "Rural health", rx: "rural health", outcome: "enacted", law: "$10 billion a year, 2026–2030, to states for rural health (§71401)." },
  { key: "passthrough", name: "Pass-through deduction (199A)", rx: "199A|pass-through|passthrough|small business deduction", outcome: "enacted", law: "The 20 percent qualified business income deduction extended and its phase-in widened (§70105)." },
  { key: "salt", name: "State and local tax deduction (SALT)", rx: "\\mSALT\\M|state and local tax", outcome: "enacted", law: "The cap rises from $10,000 to $40,000 in 2025, then 1 percent a year (§70120)." },
  { key: "estate", name: "Estate tax", rx: "estate tax|death tax", outcome: "enacted", law: "The exemption rises to $15 million, indexed, permanently (§70106)." },
  { key: "endowment", name: "University endowment tax", rx: "endowment", outcome: "enacted", law: "A tiered tax on the largest endowments, 1.4, 4 and 8 percent by endowment per student (§70415)." },
  { key: "tips", name: "No tax on tips or overtime", rx: "no tax on tips|\\mtips\\M|overtime", outcome: "enacted", law: "New deductions for qualified tips (§70201) and overtime pay (§70202)." },
  { key: "hsa", name: "Health savings accounts", rx: "\\mHSA\\M|health savings", outcome: "enacted", law: "Bronze and catastrophic plans made HSA-eligible (§71307); telehealth safe harbor made permanent." },
  { key: "litigation", name: "Tax on litigation funding", rx: "litigation funding|third-party litigation|litigation financ", outcome: "dropped", law: "Not in the law." },
  { key: "lihtc", name: "Low-income housing credit", rx: "LIHTC|low-income housing|housing credit", outcome: "enacted", law: "A permanent 12 percent increase in states' credit allocations (§70422)." },
  { key: "oz", name: "Opportunity zones", rx: "opportunity zone", outcome: "enacted", law: "Made permanent with decennial designations (§70421)." },
  { key: "remittance", name: "Remittance tax", rx: "remittance", outcome: "enacted", law: "A 1 percent excise tax on cash remittance transfers (§70604)." },
]

export const OUTCOME_LABEL: Record<Outcome, string> = { enacted: "In the law", cut: "In the law, against the sector's asks", dropped: "Dropped" }
const TONE: Record<Outcome, Tone> = { enacted: "one", cut: "two", dropped: "muted" }

export async function obbbStudy() {
  const named = `(select distinct filing_uuid from "LobbyingBills" where congress_key = '${KEY}')`
  const [counts, tops, totals, amendments] = await Promise.all([
    Promise.all(
      PROVISIONS.map((p) =>
        q<{ clients: number; filings: number }>(
          `select count(distinct f.client_name)::int as clients, count(distinct a.filing_uuid)::int as filings
             from ${named} lb join "LobbyingActivities" a using (filing_uuid) join "LobbyingFilings" f using (filing_uuid) where a.description ~* $1`,
          [p.rx]
        )
      )
    ),
    Promise.all(
      PROVISIONS.map((p) =>
        q<{ client: string; filings: number }>(
          `select f.client_name as client, count(distinct a.filing_uuid)::int as filings
             from ${named} lb join "LobbyingActivities" a using (filing_uuid) join "LobbyingFilings" f using (filing_uuid) where a.description ~* $1
            group by 1 order by 2 desc, 1 limit 4`,
          [p.rx]
        )
      )
    ),
    q<{ filings: number; clients: number; described: number }>(`
      select count(distinct lb.filing_uuid)::int as filings, count(distinct f.client_name)::int as clients,
             count(distinct a.filing_uuid)::int as described
        from ${named} lb join "LobbyingFilings" f using (filing_uuid) left join "LobbyingActivities" a using (filing_uuid)`),
    q<{ roll: number; day: string; question: string; result: string; yea: number; nay: number; amendment: string; purpose: string }>(`
      select roll_call_number::int as roll, to_char(vote_date, 'YYYY-MM-DD') as day, question, vote_result as result, yea, nay, amendment_number as amendment, amendment_purpose as purpose
        from congress_senate_votes where congress_key = '${KEY}' and amendment_number is not null and amendment_purpose not ilike 'No Statement%' order by vote_date, roll_call_number::int`),
  ])

  const provisions = PROVISIONS.map((p, i) => ({
    ...p,
    clients: n(counts[i][0]?.clients),
    filings: n(counts[i][0]?.filings),
    top: tops[i].map((t) => ({ client: t.client, filings: n(t.filings) })),
  })).sort((a, b) => b.clients - a.clients)

  const sum = (o: Outcome) => provisions.filter((p) => p.outcome === o)
  const charts: ChartSpec[] = [
    {
      id: "obbb-provisions",
      report: SLUG,
      kind: "bar",
      title: "Clients who lobbied on each provision of H.R. 1, and what the law did",
      source: "Lobbying Disclosure Act filings naming H.R. 1, matched on their issue descriptions; outcomes read in Public Law 119-21.",
      format: "int",
      bars: provisions.map((p) => ({ label: p.name, value: p.clients, tone: TONE[p.outcome], note: `${OUTCOME_LABEL[p.outcome]} · ${p.filings.toLocaleString("en-US")} filings` })),
      legend: [
        { label: OUTCOME_LABEL.enacted, tone: "one" },
        { label: "Cut back", tone: "two" },
        { label: OUTCOME_LABEL.dropped, tone: "muted" },
      ],
    },
  ]

  return {
    provisions,
    enacted: sum("enacted"),
    cut: sum("cut"),
    dropped: sum("dropped"),
    totals: { filings: n(totals[0]?.filings), clients: n(totals[0]?.clients), described: n(totals[0]?.described) },
    amendments: amendments.map((a) => ({ ...a, roll: n(a.roll), yea: n(a.yea), nay: n(a.nay) })),
    charts,
  }
}
