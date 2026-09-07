import { emptyRun } from "@/lib/agents/run-client"
import { nameOf, type Thread, type ThreadStatus } from "@/lib/agents/inbox"

// Fifty placeholder threads, so the inbox can be seen full before anyone has
// sent a task (Brendan, 2026-09-07: "show me a full inbox so I can see how it
// works"). Deterministic — the same fifty every load — and only offered when
// the store is empty and has never been cleared, so a reader who empties the
// inbox keeps it empty. Every subject is the kind of task the five agents
// take: a bill read, a jurisdiction question, money followed, a topic
// watched, a report written.

const SUBJECTS: [string, string, string][] = [
  ["researcher", "Report: what HR 10128 changes for the Interior Department", "A sourced report over the bill's text, its sponsors' floor statements and the committee's mark-up."],
  ["tracker", "Digest: labor bills moved this week", "Seven bills moved. Two left committee, one was engrossed, and the Senate calendared HR 6500 for Thursday."],
  ["bill-reader", "Read HB 5470, Route 66 National Historic Trail Designation Act", "The bill designates the Route 66 corridor a National Historic Trail and directs the Secretary to administer it."],
  ["money-follower", "Who funds the sponsors of the Montana Sportsmen Conservation Act", "The prime sponsor's top receipts this cycle come from outdoor-industry PACs and individual donors in Bozeman."],
  ["jurisdiction-guide", "Does the House need a rule for a suspension vote?", "No. A bill considered under suspension of the rules needs a two-thirds vote and no rule from the Rules Committee."],
  ["researcher", "Report: the state of the farm bill reauthorization", "The 2018 act's authorities lapsed again; the extension runs to September 30. Here is where each title stands."],
  ["tracker", "Watch: veterans health bills", "Nothing moved since yesterday's digest. Beyond Go-Live has a hearing Tuesday at 10:15."],
  ["bill-reader", "Read HR 642, Myakka Wild and Scenic River Act", "Adds 55 miles of the Myakka to the Wild and Scenic Rivers system, as a recreational river."],
  ["money-follower", "Lobbying on the BEDROCK Act", "Fourteen registrants reported the bill on their Q2 filings, eleven of them biotech trade groups."],
  ["jurisdiction-guide", "What counts as engrossed in the New York Senate?", "A bill is engrossed once it passes the house of origin; the Senate prints it in its final form for the Assembly."],
  ["researcher", "Report: birthright citizenship hearings since 1995", "Six hearings across both chambers. The 2026 Judiciary subcommittee hearing is the first since 2015."],
  ["tracker", "Digest: Senate Armed Services this week", "One closed briefing on the NDAA's implementation, September 17 at 9:30. No mark-ups."],
  ["bill-reader", "Read SB 675, Theodore Roosevelt Presidential Library Act", "Authorizes a federal contribution to the library in Medora, North Dakota, and a conveyance of land."],
  ["money-follower", "Receipts of Florida's Senate delegation", "Senator Scott leads on receipts; the gap to the second seat is $4.1M, mostly individual contributions."],
  ["jurisdiction-guide", "How does a bill reach the President?", "Enrolled after both chambers agree to the same text, signed by the Speaker and the President of the Senate, then presented."],
  ["researcher", "Report: electronic health records at the VA", "The Oracle rollout, the pause, the 2026 restart at four sites, and what the Appropriations report language asks for."],
  ["tracker", "Watch: small business lending", "Two bills introduced this week, both referred to Small Business. Neither has a hearing yet."],
  ["bill-reader", "Read HR 9600, Common Sense 250 Act of 2026", "Raises the de minimis threshold and restates the reporting rule for low-value imports."],
  ["money-follower", "Who is behind the Boca Chica beach bill?", "Sponsors' receipts show no aerospace money; the bill's backers are Cameron County environmental groups."],
  ["jurisdiction-guide", "Can the Assembly amend a Senate bill in New York?", "Yes. It returns to the Senate for concurrence; the Senate may accept, reject, or request a conference."],
  ["researcher", "Report: USPTO fee-setting authority", "The 2011 grant, the 2018 renewal, the sunset, and what the 2026 renewal bill changes."],
  ["tracker", "Digest: Rules Committee meetings", "Four meetings this week. Three closed rules, one structured rule with eleven amendments made in order."],
  ["bill-reader", "Read HB 10163", "A short bill: it renames a post office in Toledo, Ohio."],
  ["money-follower", "Campaign money in the Texas Senate race", "Receipts to date, by candidate, with the share from out of state."],
  ["jurisdiction-guide", "What is a motion to reconsider laid on the table?", "The House's way of finalizing a vote: once the motion to reconsider is tabled, the question cannot be reopened."],
  ["researcher", "Report: broadband funding in the 119th Congress", "BEAD's second tranche, the affordability program's lapse, and the four bills that would revive it."],
  ["tracker", "Watch: education bills in New York", "The Assembly passed A 4021 on Tuesday. The Senate companion is in Finance."],
  ["bill-reader", "Read HR 1494", "A resolution honoring the life and public service of a former member of Congress."],
  ["money-follower", "PAC giving to House Energy and Commerce", "Committee members received $18.2M from PACs this cycle; utilities and telecoms lead."],
  ["jurisdiction-guide", "How many votes does a veto override need?", "Two-thirds of those present and voting in each chamber, a quorum being present."],
  ["researcher", "Report: reliable water and the Digital Age hearing", "What the Energy and Commerce subcommittee heard on September 3, and the three bills in play."],
  ["tracker", "Digest: House Financial Services", "One hearing on Tuesday, eight bills introduced, two referred elsewhere."],
  ["bill-reader", "Read HB 9779, Hands Off Our Boca Chica Beach Act", "Limits closures of the beach and county road for launch operations to a set number of hours a year."],
  ["money-follower", "Who funded the Route 66 trail sponsors?", "Nothing unusual: the sponsors' receipts match their districts' profiles."],
  ["jurisdiction-guide", "What does a committee's 'ordered to be reported' mean?", "The committee voted to send the bill to the floor; the written report follows, usually within days."],
  ["researcher", "Report: the child tax credit in 2026", "The expansion's expiry, the two competing extensions, and the score for each."],
  ["tracker", "Watch: Senate Judiciary nominations", "Three hearings scheduled; two nominees advanced on party-line votes."],
  ["bill-reader", "Read SB 858", "Presented to the President on Tuesday; here is what the enrolled text does."],
  ["money-follower", "Lobbying spend on the NDAA", "Two hundred and twelve registrants; the ten largest account for a third of the reported spend."],
  ["jurisdiction-guide", "What is a hearing versus a mark-up?", "A hearing takes testimony; a mark-up amends and votes on the text. The calendar marks them differently."],
  ["researcher", "Report: skilled-trades workforce development bills", "Eleven bills across both chambers; the Appropriations subcommittee's September 4 hearing set the terms."],
  ["tracker", "Digest: everything calendared for next week", "Nineteen hearings and four mark-ups, by committee and day."],
  ["bill-reader", "Read HB 10170", "Amends title 38 to extend a housing loan guarantee for veterans."],
  ["money-follower", "Receipts by party in the House this cycle", "Republicans lead on PAC money, Democrats on individual contributions; the totals are close."],
  ["jurisdiction-guide", "What does 'substituted' mean in a state legislature?", "One chamber takes up the other's identical bill in place of its own, so a single bill carries forward."],
  ["researcher", "Report: the history of the de minimis rule", "From 1938 to the 2016 increase to $800, and what the 2026 bill would change."],
  ["tracker", "Watch: crypto bills", "Two moved this week; the market-structure bill has a Senate hearing Thursday."],
  ["bill-reader", "Read HB 6788, Montana Sportsmen Conservation Act", "Releases wilderness study areas and adds a recreation management area."],
  ["money-follower", "Who gives to Senator Durbin?", "Individual contributions dominate; the largest PAC donors are labor unions."],
  ["jurisdiction-guide", "How is a bill numbered?", "In order of introduction within a Congress; House bills HR, Senate bills S, with resolutions numbered on their own."],
]

const HOUR = 3_600_000

/** The fifty, newest first, spread over the last eleven days. */
export function sampleThreads(): Thread[] {
  const now = Date.now()
  return SUBJECTS.map(([agent, subject, body], i) => {
    // A rhythm rather than randomness: every ninth thread is still running,
    // every seventh failed, the rest delivered; the first dozen unread,
    // every fifth starred, a few in the trash, and two drafts and two sent
    // among the rest so every folder has something in it.
    const status: ThreadStatus = i % 9 === 4 ? "running" : i % 7 === 3 ? "failed" : i === 20 || i === 33 ? "draft" : "delivered"
    const at = now - i * 5 * HOUR - (i % 3) * 17 * 60_000
    const sent = at - 12 * 60_000
    const unread = status === "delivered" && i < 12
    const you = { id: `s${i}-you`, from: "you" as const, at: sent, body: `Please look into this: ${subject.replace(/^(Report|Digest|Read|Watch): ?/, "").toLowerCase()}.` }
    const run = {
      ...emptyRun(),
      text: body,
      model: "Haiku 4.5",
      rounds: 2 + (i % 3),
      usd: 0.004 + (i % 5) * 0.003,
      ms: 4000 + i * 250,
      inTokens: 2200 + i * 40,
      outTokens: 380 + i * 12,
      done: status !== "running",
      failed: status === "failed",
    }
    const reply =
      status === "draft"
        ? []
        : [{ id: `s${i}-${agent}`, from: agent, at: status === "running" ? sent : at, body: status === "failed" ? "The run hit the model's rate limit twice and stopped. Send it again." : status === "running" ? "" : body, unread, run }]
    return {
      id: `sample-${i}`,
      agent,
      agentName: nameOf(agent),
      to: [agent],
      cc: i % 11 === 6 ? ["tracker"] : [],
      bcc: [],
      subject,
      createdAt: sent,
      updatedAt: status === "running" ? sent : at,
      status,
      starred: i % 5 === 1,
      trashed: i === 27 || i === 41,
      deliveredTo: status === "delivered" && i % 4 === 0 ? "Discord" : undefined,
      messages: [you, ...reply],
    }
  })
}
