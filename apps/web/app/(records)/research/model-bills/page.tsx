import type { Metadata } from "next"
import Link from "next/link"

import { stateName } from "@/lib/filters"
import { fmtDate, fmtNumber } from "@/lib/format"
import { modelBillsStudy } from "@/lib/reports/model-bills"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportChart } from "@/components/reports/report-chart"
import { H2, Table } from "@/components/typeset"

// Research recipe report #3 (2026-09-18): ALEC's model bills against the
// text of every state bill in the record.

export const metadata: Metadata = { title: "Copy-and-paste lawmaking", description: "ALEC's model policies searched for in the text of every state bill GovBlock holds: which were copied, where, and which became law." }

export default function ModelBillsReport() {
  const s = modelBillsStudy()
  const title = `Copy-and-paste lawmaking: ${fmtNumber(s.copies)} state bills carry text from ALEC's model policies, and ${fmtNumber(s.passed)} passed`
  const topState = s.states[0]
  const mostFiled = [...s.models].sort((a, b) => b.copies - a.copies)[0]
  const refiledNeverPassed = s.models.filter((m) => m.passed === 0).sort((a, b) => b.copies - a.copies)[0]
  const topModel = [...s.models].sort((a, b) => b.passedIn.length - a.passedIn.length || b.passed - a.passed)[0]
  const passedSomewhere = s.models.filter((m) => m.passed > 0).length

  return (
    <DocsPage
      title={title}
      description={`Every model policy in ALEC's library with a distinctive title, ${fmtNumber(s.searched)} of ${fmtNumber(s.modelsTotal)}, searched for in the text of every state bill GovBlock holds. Matched ${fmtDate(s.built)}.`}
      slug="/research/model-bills"
      previous={{ name: "Who wrote the One Big Beautiful Bill?", url: "/research/who-wrote-obbb" }}
      next={{ name: "Where bills go to die", url: "/research/where-bills-die" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Key takeaways", url: "#takeaways", depth: 2 },
            { title: "1. Copies and namesakes", url: "#copies", depth: 2 },
            { title: "2. The models that travel", url: "#models", depth: 2 },
            { title: "3. The states", url: "#states", depth: 2 },
            { title: "4. Every copy that passed", url: "#passed", depth: 2 },
            { title: "5. Method and gaps", url: "#method", depth: 2 },
          ]}
        />
      }
    >
      <div id="takeaways" className="rounded-xl border bg-card p-5">
        <p className="mt-0 font-semibold">Key takeaways</p>
        <ul className="mb-0">
          <li>
            {fmtNumber(s.models.length)} of ALEC&apos;s model policies turn up in the text of state bills: {fmtNumber(s.copies)} bills carry a model&apos;s title and a sentence of its text, and {fmtNumber(s.passed)} of them passed.
          </li>
          <li>
            {topModel ? `${topModel.title} passed in the most states: ${topModel.passedIn.map(stateName).join(", ")}.` : ""} {topState ? `${stateName(topState.state)} passed the most copies, ${topState.passed}.` : ""}
          </li>
          <li>
            Filing is not passing. {refiledNeverPassed ? `${refiledNeverPassed.title} was filed ${refiledNeverPassed.copies} times and never passed.` : ""} Another {fmtNumber(s.namesakes)} bills share a model&apos;s title but not its text.
          </li>
        </ul>
      </div>

      <H2 id="copies">1. Copies and namesakes</H2>
      <p>
        A bill that borrows a model&apos;s name has not necessarily borrowed its law. The search here asks for both: the model&apos;s short title, then one of three ten-word sentences from the body of the model, taken from its first, middle and last thirds. {fmtNumber(s.copies)} bills carry both and are counted as copies; {fmtNumber(s.namesakes)} carry the title alone
        and are left out of what follows.
      </p>

      <H2 id="models">2. The models that travel</H2>
      <p>
        {mostFiled ? `The most-copied model, ${mostFiled.title}, appears in ${mostFiled.copies} bills in ${mostFiled.states.length} ${mostFiled.states.length === 1 ? "state" : "states"}.` : ""} {fmtNumber(passedSomewhere)} of the {fmtNumber(s.models.length)} copied models passed in at least one state.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[40%]">Model policy</th>
            <th>Issue</th>
            <th className="text-right">Copies</th>
            <th className="text-right">Passed</th>
            <th className="pr-8">Passed in</th>
          </tr>
        </thead>
        <tbody>
          {s.models.slice(0, 30).map((m) => (
            <tr key={m.id}>
              <td>{m.url ? <a href={m.url}>{m.title}</a> : m.title}</td>
              <td>{m.issue}</td>
              <td className="text-right tabular-nums">{m.copies}</td>
              <td className="text-right tabular-nums">{m.passed}</td>
              <td className="pr-8">{m.passedIn.join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="states">3. The states</H2>
      <ReportChart spec={s.charts[0]} />
      <Table>
        <thead>
          <tr>
            <th className="w-[36%]">State</th>
            <th className="text-right">Models copied</th>
            <th className="text-right">Copies filed</th>
            <th className="pr-8 text-right">Passed</th>
          </tr>
        </thead>
        <tbody>
          {s.states.map((r) => (
            <tr key={r.state}>
              <td>{stateName(r.state)}</td>
              <td className="text-right tabular-nums">{r.models}</td>
              <td className="text-right tabular-nums">{r.copies}</td>
              <td className="pr-8 text-right tabular-nums">{r.passed}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="passed">4. Every copy that passed</H2>
      <Table>
        <thead>
          <tr>
            <th className="w-[18%]">Bill</th>
            <th className="w-[20%]">Session</th>
            <th className="w-[30%]">Model</th>
            <th className="pr-8">Title in the state</th>
          </tr>
        </thead>
        <tbody>
          {s.enacted.map((e) => (
            <tr key={e.billId}>
              <td className="whitespace-nowrap">
                <Link href={`/bills/${e.billId}`}>
                  {e.state} {e.bill}
                </Link>
              </td>
              <td>{e.session}</td>
              <td>{e.model}</td>
              <td className="pr-8">{e.title}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="method">5. Method and gaps</H2>
      <ul>
        <li>
          <b>Models.</b> ALEC&apos;s published model policies (alec.org/model-policy), {fmtNumber(s.modelsTotal)} with text; resolutions and models whose titles have fewer than three distinctive words are left out, leaving {fmtNumber(s.searched)}.
        </li>
        <li>
          <b>Matching.</b> The model&apos;s short title (&ldquo;may be cited as&rdquo;, else its title) as a phrase in the full text of every state bill in the record, then three ten-word sentences from the model&apos;s body, at 30, 50 and 70 percent of the way through. A copy carries the title and at least one sentence. Run {fmtDate(s.built)} by <code>scripts/research/model-bills.mjs</code>.
        </li>
        <li>
          <b>Passed.</b> The bill&apos;s status when matched: passed or signed by the governor.
        </li>
        <li>
          <b>Gaps.</b> A copy that renames the act or rewrites every sentence the search checks is missed, so the counts are a floor; {fmtNumber(s.unsearched)} models whose titles are common phrases could not be searched in the time allowed. ALEC&apos;s library includes models that began elsewhere, uniform acts among them; a match shows text in common, not who wrote it first. Bills whose text GovBlock does not hold are not searched.
        </li>
        <li>Data and findings are CC BY 4.0.</li>
      </ul>
    </DocsPage>
  )
}
