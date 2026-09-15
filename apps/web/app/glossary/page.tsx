import type { Metadata } from "next"
import Link from "next/link"
import { Fragment } from "react"

import { DocsPage } from "@/components/docs-page"
import { DocsSidebar } from "@/components/docs-sidebar"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2, H3, Table } from "@/components/typeset"
import { StatusViews } from "@/app/glossary/status-views"
import { TableBlock } from "@/components/policy/table-block"
import { VERSION_CODES } from "@/lib/typeset/versions"
import { SidebarProvider } from "@govblock/ui/components/ny4/sidebar"

// /glossary (Brendan, 2026-09-13): the words the record uses, each defined
// once, with what every source of record calls the same thing. The first
// entry is "action", because three sources hold a bill's actions under four
// different names and the pages had started to use a fifth.
//
// The docs shell, drawn inline: the docs layout is not above this route, and
// DocsPage's right rail needs the sidebar provider it supplies.

const title = "Glossary"
const description = "The words the record uses, and what each source of record calls the same thing."

export const metadata: Metadata = { title, description }

// api.congress.gov, bill endpoint, the `type` of an action; the ten values the
// documentation lists, in the order a bill meets them.
const CONGRESS_TYPES: [string, string][] = [
  ["IntroReferral", "introduced, and referred to committee or subcommittee"],
  ["Committee", "hearings, markups, time extensions, reported, discharged"],
  ["Calendars", "placed on a House or Senate calendar"],
  ["Floor", "considered, passed, agreed to, or failed on the floor"],
  ["Discharge", "a committee discharged of the bill"],
  ["ResolvingDifferences", "the two chambers' texts reconciled: amendments between the houses, conference"],
  ["President", "presented to the President, signed, or returned"],
  ["BecameLaw", "public or private law, with or without signature, or over a veto"],
  ["Veto", "vetoed, pocket vetoed, and the override votes"],
  ["NotUsed", "codes the Library files outside the process; some read as resolving differences"],
]

// legislation.nysenate.gov, `status.statusType` on a bill; the fifteen values
// of BillStatusType in the NY Senate's Open Legislation source, with the
// `statusDesc` each carries.
const NY_STATUS: [string, string][] = [
  ["INTRODUCED", "Introduced"],
  ["IN_ASSEMBLY_COMM", "In Assembly Committee"],
  ["IN_SENATE_COMM", "In Senate Committee"],
  ["ASSEMBLY_FLOOR", "Assembly Floor Calendar"],
  ["SENATE_FLOOR", "Senate Floor Calendar"],
  ["PASSED_ASSEMBLY", "Passed Assembly"],
  ["PASSED_SENATE", "Passed Senate"],
  ["DELIVERED_TO_GOV", "Delivered to Governor"],
  ["SIGNED_BY_GOV", "Signed by Governor"],
  ["VETOED", "Vetoed"],
  ["STRICKEN", "Stricken"],
  ["LOST", "Lost"],
  ["SUBSTITUTED", "Substituted"],
  ["ADOPTED", "Adopted"],
  ["POCKET_APPROVAL", "Pocket Approval"],
]

// The eleven normalized stage events every state and DC records, in the order
// a bill meets them, each with its glossary definition.
const STAGES: [string, string][] = [
  ["Introduced", "A member files the bill and it is read into its chamber for the first time. It gets a number, and its life in the legislature begins."],
  ["Referred to committee", "The bill is sent to one or more committees, which study it, may hold hearings on it, and decide whether it goes to the floor."],
  ["Reported: do pass", "A committee sends the bill back to its chamber recommending that it pass, often with amendments."],
  ["Reported: do not pass", "A committee sends the bill back to its chamber recommending that it not pass."],
  ["Engrossed", "The bill is reprinted with every amendment its chamber has adopted, as the text that chamber passes and sends on."],
  ["Passed", "A chamber votes to approve the bill. It must pass every chamber of the legislature in the same text before it can go to the executive."],
  ["Enrolled", "The text every chamber passed is prepared in final form and signed by the presiding officers, ready for the executive."],
  ["Chaptered", "The bill has become law and is given a chapter number in the session laws."],
  ["Vetoed", "The executive rejects the bill and returns it to the legislature, usually with the reasons."],
  ["Override", "The legislature enacts the bill over the veto, usually by a supermajority vote in each chamber."],
  ["Failed", "The bill is defeated in a vote, or dies without passing when it is withdrawn or the session ends."],
]

// docs/state-bill-stages.md: for each state and DC, whether it recorded each
// stage in its latest session, one character per stage in STAGES order.
const RECORDED: Record<string, string> = {
  AK: "11111111110",
  AL: "11101110000",
  AR: "11101111001",
  AZ: "10111111100",
  CA: "11101111101",
  CO: "11101110101",
  CT: "11101111000",
  DC: "11001111100",
  DE: "11001110101",
  FL: "11001111101",
  GA: "11101111000",
  HI: "11101111100",
  IA: "11001110100",
  ID: "11101111100",
  IL: "11101111101",
  IN: "11101111000",
  KS: "11101110111",
  KY: "11101111111",
  LA: "11101111100",
  MA: "11111111100",
  MD: "11101111110",
  ME: "11001110101",
  MI: "11101111000",
  MN: "11101111000",
  MO: "11101110000",
  MS: "11001110101",
  MT: "11001110101",
  NC: "11101111110",
  ND: "11101110000",
  NE: "11001110001",
  NH: "11111111110",
  NJ: "11101111001",
  NM: "11101111100",
  NV: "11101111101",
  NY: "11101111100",
  OH: "11101110000",
  OK: "11101110111",
  OR: "11101111101",
  PA: "11101111000",
  RI: "11101110100",
  SC: "11001111110",
  SD: "11101110100",
  TN: "11001111001",
  TX: "11101110100",
  UT: "11101110101",
  VA: "11101111100",
  VT: "11101110100",
  WA: "11111111100",
  WI: "11101000001",
  WV: "11101111100",
  WY: "11101110101",
}

const NAMES: Record<string, string> = {
  AK: "Alaska",
  AL: "Alabama",
  AR: "Arkansas",
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DC: "District of Columbia",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  IA: "Iowa",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  ME: "Maine",
  MI: "Michigan",
  MN: "Minnesota",
  MO: "Missouri",
  MS: "Mississippi",
  MT: "Montana",
  NC: "North Carolina",
  ND: "North Dakota",
  NE: "Nebraska",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NV: "Nevada",
  NY: "New York",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VA: "Virginia",
  VT: "Vermont",
  WA: "Washington",
  WI: "Wisconsin",
  WV: "West Virginia",
  WY: "Wyoming",
}

// How each legislature numbers a bill (Brendan, 2026-09-13): the form as the
// legislature prints it, whether the number is zero-padded, and the prefixes
// its measures wear. The fifty states as BillTrack50 documents them
// (billtrack50.com/info/help/how-states-format-bill-numbers); Congress as it
// prints its own citations; the District from the record's own numbers.
type BillNumber = { sample: string; padded: string; prefixes: string; note?: string }
const BILL_NUMBERS: Record<string, BillNumber> = {
  AL: { sample: "HB1", padded: "no", prefixes: "HB, SB, HR, HJR, SJR, SR" },
  AK: { sample: "HB1", padded: "no", prefixes: "HB, SB, HJR, HCR, SCR, SJR, HR, SR" },
  AZ: { sample: "HB2001", padded: "no", prefixes: "HB, SB, HCR, SCR, SR, HR, SCM, HCM, HM, HJR, SM" },
  AR: { sample: "SB1", padded: "no", prefixes: "HB, SB, HR, SR, HJR, SJR, HCR, SCR, HMR, SMR, HCMR" },
  CA: { sample: "AB1", padded: "no", prefixes: "AB, SB, ACR, SCR, AJR, ABX, AR, SJR, ACA, SCA, SBX, HR, SR, HB, ACAX, SCAX" },
  CO: { sample: "HB1001, SB001", padded: "House no, Senate to 3 digits", prefixes: "HB, SB, SJR, HJR, HR, SR, HM, SCR, SJM, SM, HCR", note: "House bills start above 1000; Senate bills start at 001" },
  CT: { sample: "HB05001", padded: "to 5 digits", prefixes: "HB, SB" },
  DE: { sample: "HB1", padded: "no", prefixes: "HB, SB, HCR, SCR, HR, SR, HJR, SJR" },
  DC: { sample: "B26-0776", padded: "to 4 digits", prefixes: "B, PR, R, ACR", note: "the Council period first, then the number" },
  FL: { sample: "H0001", padded: "to 4 digits", prefixes: "H, S" },
  GA: { sample: "HB1", padded: "no", prefixes: "HR, SR, HB, SB" },
  HI: { sample: "HB1", padded: "no", prefixes: "HB, SB, HCR, HR, SCR, SR" },
  ID: { sample: "H0001, HCR001", padded: "bills to 4 digits, resolutions to 3", prefixes: "H, S, HCR, SCR, HJM, SJR, SR, HR, SJM, HP, SP, HJR" },
  IL: { sample: "HB0001", padded: "to 4 digits", prefixes: "HB, SB, HR, SR, HJR, HJRCA, SJR, SJRCA" },
  IN: { sample: "HB1001, SB0001", padded: "House no, Senate to 4 digits", prefixes: "SB, HB, SR, HR, HCR, SCR, SJR, HJR", note: "House bills start above 1000; Senate bills start at 0001" },
  IA: { sample: "HF1", padded: "no", prefixes: "HF, SF, SSB, HSB, HR, SR, HJR, SJR, HCR, SCR" },
  KS: { sample: "SB1", padded: "no", prefixes: "HB, SB, SR, HR, HCR, SCR" },
  KY: { sample: "HB1", padded: "no", prefixes: "HB, SB, SR, HR, HCR, HJR, SCR, SJR" },
  LA: { sample: "HB1", padded: "no", prefixes: "HB, SB, HCR, HR, SR, SCR, HSR, HCSR, SCSR, SSR" },
  ME: { sample: "LD1", padded: "no", prefixes: "LD, HP, SP" },
  MD: { sample: "HB1", padded: "no", prefixes: "HB, SB, HJ, SJ" },
  MA: { sample: "H1", padded: "no", prefixes: "H, S" },
  MI: { sample: "HB4001, SB0001", padded: "House no, Senate to 4 digits", prefixes: "HB, SB, HR, SR, HCR, SCR", note: "House bills start above 4000; Senate bills start at 0001" },
  MN: { sample: "HF10", padded: "no", prefixes: "HF, SF, SR, SC, HR, HC" },
  MS: { sample: "HB1", padded: "no", prefixes: "HB, SB, SC, HR, HC, SR" },
  MO: { sample: "HB1", padded: "no", prefixes: "HB, SB, HCR, HJR, HR, SJR, SCR, SR" },
  MT: { sample: "HB1", padded: "no", prefixes: "HB, SB, SR, HJ, SJ, HR" },
  NE: { sample: "LB1", padded: "no", prefixes: "LB, LR", note: "one chamber: legislative bills and resolutions" },
  NV: { sample: "AB1", padded: "no", prefixes: "AB, SB, SJR, AR, SCR, AJR, ACR, SR, IP" },
  NH: { sample: "HB101", padded: "no", prefixes: "HB, SB, HCR, CACR, HR, SR, HJR, SCR, SJR" },
  NJ: { sample: "A1", padded: "no", prefixes: "A, S, ACR, SCR, AR, SR, AJR, SJR" },
  NM: { sample: "HB1", padded: "no", prefixes: "HB, SB, SM, HM, SJM, HJM, HJR, SJR, HR, SR, SCR, HCR" },
  NY: { sample: "A00020", padded: "to 5 digits", prefixes: "A, S" },
  NC: { sample: "H1", padded: "no", prefixes: "H, S" },
  ND: { sample: "1001", padded: "no", prefixes: "none", note: "no prefixes; bill numbers start at 1001" },
  OH: { sample: "HB1", padded: "no", prefixes: "HB, HR, SB, SR, HCR, SCR, HJR, SJR" },
  OK: { sample: "SB1", padded: "no", prefixes: "HB, SB, HJR, SJR, HR, SR, SCR, HCR" },
  OR: { sample: "HB2001", padded: "no", prefixes: "HB, SB, HCR, HJR, SJR, HJM, SCR, SJM, HR, HM, SM, SR" },
  PA: { sample: "HB1", padded: "no", prefixes: "HB, SB, HR, SR" },
  RI: { sample: "H2452, S0001", padded: "House no, Senate to 4 digits", prefixes: "H, S", note: "House bills start above 1000; Senate bills start at 0001" },
  SC: { sample: "H0349", padded: "to 4 digits", prefixes: "H, S" },
  SD: { sample: "SB1", padded: "no", prefixes: "HB, SB, HC, SC, HCR, SCR, HJR, SJR" },
  TN: { sample: "HB0001", padded: "to 4 digits", prefixes: "HB, SB, HJR, SJR, HR, SR" },
  TX: { sample: "HB1", padded: "no", prefixes: "HB, HR, SB, SR, HCR, HJR, SJR, SCR" },
  US: { sample: "H.R. 1, S. 1", padded: "no", prefixes: "H.R., S., H.J.Res., S.J.Res., H.Con.Res., S.Con.Res., H.Res., S.Res.", note: "the record stores HB1 and SB1 and prints them as Congress does" },
  UT: { sample: "HB0001", padded: "bills to 4 digits, resolutions to 3", prefixes: "HB, SB, HJR, SJR, HCR, SCR, HR, SR" },
  VT: { sample: "H0001", padded: "bills to 4 digits, resolutions to 3", prefixes: "H, HCR, S, JRS, SCR, JRH, HR, SR" },
  VA: { sample: "HB1", padded: "no", prefixes: "HB, SB, HJR, SJR, HR, SR" },
  WA: { sample: "HB1000", padded: "no", prefixes: "HB, SB, HJR, SJR, SJM, HJM, HCR, SCR" },
  WV: { sample: "HB9", padded: "no", prefixes: "HB, SB, HCR, SCR, SR, HJR, HR, SJR" },
  WI: { sample: "AB1", padded: "no", prefixes: "AB, SB, AJR, SJR, AR, SR" },
  WY: { sample: "HB0001", padded: "to 4 digits", prefixes: "HB, SF, HJ, SJ" },
}

/** The jurisdiction's bill number, in its section: the sample, the padding, the prefixes. */
function billNumber(code: string) {
  const n = BILL_NUMBERS[code]
  if (!n) return null
  return (
    <p>
      <strong>Bill number</strong> <code>{n.sample}</code> · zero-padded: {n.padded} · {n.prefixes}
      {n.note ? ` · ${n.note}` : ""}
    </p>
  )
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")

// Congress, New York and every other state and DC, alphabetical by name.
const JURISDICTIONS = ["Congress", ...Object.values(NAMES)].sort((a, b) => a.localeCompare(b))
const CODE_OF = Object.fromEntries(Object.entries(NAMES).map(([code, name]) => [name, code]))

const recordedStages = (code: string): [string, string][] => STAGES.filter((_, i) => RECORDED[code][i] === "1")

const toc = [
  { title: "Action", url: "#action", depth: 2 },
  ...JURISDICTIONS.map((name) => ({ title: name, url: `#${slug(name)}`, depth: 3 })),
  { title: "Stages", url: "#stages", depth: 2 },
  ...STAGES.map(([stage]) => ({ title: stage, url: `#${slug(stage)}`, depth: 3 })),
  { title: "Bill number", url: "#bill-number", depth: 2 },
]

export default function GlossaryPage() {
  return (
    <div className="container-wrapper flex flex-1 flex-col px-2">
      <SidebarProvider
        className="min-h-min flex-1 items-start px-0 [--top-spacing:0] lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] lg:[--top-spacing:calc(var(--spacing)*4)] 3xl:fixed:container 3xl:fixed:px-3 [[data-rail-left=closed]_&]:[--sidebar-width:calc(var(--spacing)*6)]!"
        style={{ "--sidebar-width": "calc(var(--spacing) * 72)" } as React.CSSProperties}
      >
        <DocsSidebar />
        <div className="h-full w-full">
          <DocsPage title={title} description={description} slug="/glossary" next={{ name: "Docs", url: "/docs" }} rail={<DocsTableOfContents toc={toc} />}>
            <H2 id="action">Action</H2>
            <p>
              An action is one thing a legislature did to a bill on a date: introduced it, referred it to a committee, reported it out, placed it on a calendar, passed it, sent it to the other chamber, presented it to the executive, enacted it. A bill&rsquo;s actions in date order are its record, and the newest one is where the bill stands. The Typeset toolbar&rsquo;s Actions button lists them beside the page; the History tab of a bill&rsquo;s Git view lists the same rows.
            </p>
            <p>Every source of record holds the list, and no two call it the same thing.</p>
            <Table>
              <thead>
                <tr>
                  <th>here</th>
                  <th>Congress.gov</th>
                  <th>New York</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>actions</td>
                  <td>
                    <code>actions</code>: date, text, type, action code, source system
                  </td>
                  <td>
                    <code>actions</code>: date, chamber, text, sequence number
                  </td>
                </tr>
                <tr>
                  <td>latest action</td>
                  <td>
                    <code>latestAction</code>: date, text
                  </td>
                  <td>
                    <code>status</code>: type, description, date, committee, calendar number
                  </td>
                </tr>
                <tr>
                  <td>stage</td>
                  <td>
                    each action&rsquo;s <code>type</code>, ten values
                  </td>
                  <td>
                    <code>milestones</code>, the status types reached
                  </td>
                </tr>
                <tr>
                  <td>one-word status</td>
                  <td>none</td>
                  <td>
                    <code>statusType</code>, fifteen values
                  </td>
                </tr>
              </tbody>
            </Table>

            {JURISDICTIONS.map((name) =>
              name === "Congress" ? (
                <Fragment key={name}>
                  <H3 id="congress">Congress</H3>
                  <p>
                    Congress.gov keeps a bill&rsquo;s <code>actions</code> and its <code>latestAction</code>, and nothing named history, activity, progress or status. Each action carries a <code>type</code>, which is the stage of the process it belongs to. <Link href="https://api.congress.gov/">api.congress.gov</Link> documents ten.
                  </p>
                  <StatusViews rows={CONGRESS_TYPES} columns={["type", "what it covers"]} />
                  {billNumber("US")}
                  <p>
                    H.R. 6644 of the 119th Congress has 69 actions, from &ldquo;Introduced in House&rdquo; on 11 December 2025 to &ldquo;Became Public Law No: 119-101.&rdquo; on 11 July 2026, and uses nine of the ten types.
                  </p>
                </Fragment>
              ) : name === "New York" ? (
                <Fragment key={name}>
                  <H3 id="new-york">New York</H3>
                  <p>
                    The Senate&rsquo;s Open Legislation API keeps a bill&rsquo;s <code>actions</code> (date, chamber, text, sequence number) and a <code>status</code> object for the latest one. Its <code>statusType</code> is the one-word answer to where the bill stands, and it can only be one of fifteen values.
                  </p>
                  <StatusViews rows={NY_STATUS} columns={["statusType", "statusDesc"]} />
                  {billNumber("NY")}
                  <p>
                    The status also names the committee when the bill is in one, and the calendar number when it is on the floor. <code>milestones</code> is the list of status types the bill has reached, in order. S10694 of the 2025 session, on 11 September 2026: one action, &ldquo;REFERRED TO RULES&rdquo;; status <code>IN_SENATE_COMM</code>, In Senate Committee, Rules.
                  </p>
                </Fragment>
              ) : (
                <Fragment key={name}>
                  <H3 id={slug(name)}>{name}</H3>
                  <StatusViews rows={recordedStages(CODE_OF[name])} columns={["stage", "definition"]} />
                  {billNumber(CODE_OF[name])}
                </Fragment>
              )
            )}

            <H2 id="bill-text-versions">Bill text versions</H2>
            <p>
              The stage a printing carries, as GovInfo names it. The code rides on a printing&apos;s address (<code>@2026-06-25_enr</code>) and on the version chip in Typeset&apos;s footer.
            </p>
            <Table>
              <thead>
                <tr>
                  <th>code</th>
                  <th>version</th>
                  <th>what it is</th>
                </tr>
              </thead>
              <tbody>
                {VERSION_CODES.map((v) => (
                  <tr key={v.code} id={`version-${v.code}`}>
                    <td>
                      <code>{v.code}</code>
                    </td>
                    <td>{v.name}</td>
                    <td>{v.description}</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <H2 id="stages">Stages</H2>
            <p>A jurisdiction with no dot under a stage did not record that stage in its latest session.</p>
            <Table>
              <thead>
                <tr>
                  <th>state</th>
                  {STAGES.map(([stage]) => (
                    <th key={stage}>{stage}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(RECORDED).map(([code, marks]) => (
                  <tr key={code}>
                    <td>{code}</td>
                    {STAGES.map(([stage], i) => (
                      <td key={stage}>{marks[i] === "1" ? "●" : ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
            {STAGES.map(([stage, definition]) => (
              <Fragment key={stage}>
                <H3 id={slug(stage)}>{stage}</H3>
                <p>{definition}</p>
              </Fragment>
            ))}

            <H2 id="bill-number">Bill number</H2>
            <p>
              A bill number is a prefix for the chamber and the kind of measure, then a number the clerk assigns in order of filing. Every legislature spells it its own way: some zero-pad the number, some start one chamber above a thousand so the two never collide, Nebraska has one chamber, and North Dakota uses no prefix at all. The first ten below; See more opens the rest.
            </p>
            <TableBlock rows={JURISDICTIONS.length}>
              <Table>
                <thead>
                  <tr>
                    <th>jurisdiction</th>
                    <th>sample</th>
                    <th>zero-padded</th>
                    <th>prefixes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {JURISDICTIONS.map((name) => {
                    const n = BILL_NUMBERS[name === "Congress" ? "US" : CODE_OF[name]]
                    return n ? (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>
                          <code>{n.sample}</code>
                        </td>
                        <td>{n.padded}</td>
                        <td>{n.prefixes}</td>
                        <td>{n.note ?? ""}</td>
                      </tr>
                    ) : null
                  })}
                </tbody>
              </Table>
            </TableBlock>
          </DocsPage>
        </div>
      </SidebarProvider>
    </div>
  )
}
