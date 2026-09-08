import type { Step } from "@/lib/agents/run-client"

// Reading a run as a trace: which source each call reached, and how the prose
// between the calls pairs with them.
//
// Separate from the component that draws it because this half is the part with
// a right answer — a run's steps go in, the stages of the report come out — and
// it can be checked against a real run without a browser.

type Tool = Extract<Step, { kind: "tool" }>

/** Which source a call reached, by the tool it used. */
export function sourceOf(name: string) {
  if (name === "web_search") return { label: "Web search", mark: "W", tone: "bg-blue-600" }
  if (name === "read_page") return { label: "Page read", mark: "P", tone: "bg-emerald-600" }
  if (name === "congress_gov") return { label: "congress.gov", mark: "↑", tone: "bg-violet-600" }
  if (name.startsWith("post_to") || name === "deliver_report")
    return { label: "Delivery", mark: "→", tone: "bg-zinc-500" }
  return { label: "GovBlock record", mark: "DB", tone: "bg-slate-700" }
}

export function args(input: unknown) {
  return Object.entries((input ?? {}) as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(", ")
}

// The two words the Trace mode asks for, bolded, and the heading the finished
// report sits under. Written as markdown by the agent so the same text still
// reads as a report anywhere markdown is all there is — the copy button, the
// PDF, the mail that carries it.
const REASONING = /\*\*Reasoning\.?\*\*/i
const OUTPUT = /\*\*Output\.?\*\*/i
const REPORT = /^#{1,3}\s*Report\s*$/im

type Split = { lead: string; reasoning?: string; output?: string; report?: string }

export function split(text: string): Split {
  let rest = text
  let report: string | undefined
  const at = REPORT.exec(rest)
  if (at) {
    report = rest.slice(at.index + at[0].length).trim()
    rest = rest.slice(0, at.index)
  }
  const r = REASONING.exec(rest)
  if (!r) return { lead: rest.trim(), report }
  const lead = rest.slice(0, r.index).trim()
  const after = rest.slice(r.index + r[0].length)
  const o = OUTPUT.exec(after)
  if (!o) return { lead, reasoning: after.trim(), report }
  return {
    lead,
    reasoning: after.slice(0, o.index).trim(),
    output: after.slice(o.index + o[0].length).trim(),
    report,
  }
}

type Stage = { tools: Tool[]; reasoning?: string; output?: string }

/**
 * The run as stages: each block of calls, and the prose written after it.
 *
 * A round writes before it calls, so the words that reason *over* a result are
 * in the round that follows it — which is what pairs a note with the block
 * above rather than the one below.
 */
export function stagesOf(steps: Step[], body: string) {
  const stages: Stage[] = []
  const reports: string[] = []
  let opening = ""

  for (let i = 0; i < steps.length; ) {
    const step = steps[i]
    if (step.kind === "note") {
      const parsed = split(step.text)
      if (parsed.report) reports.push(parsed.report)
      const last = stages.at(-1)
      if (!last) opening ||= parsed.lead
      else {
        // Unmarked prose is a finding, not a confession — show it rather than
        // hide it behind a disclosure.
        const output = parsed.output ?? (parsed.reasoning ? undefined : parsed.lead || undefined)
        if (parsed.reasoning) last.reasoning = [last.reasoning, parsed.reasoning].filter(Boolean).join("\n\n")
        if (output) last.output = [last.output, output].filter(Boolean).join("\n\n")
      }
      i += 1
      continue
    }
    const tools: Tool[] = []
    while (i < steps.length && steps[i].kind === "tool") {
      tools.push(steps[i] as Tool)
      i += 1
    }
    stages.push({ tools })
  }

  // A trailing block of prose with no markers is the report itself — the run
  // that wrote it without the heading, or one recorded before notes were kept
  // at all.
  const last = stages.at(-1)
  if (!reports.length && last && !last.reasoning && last.output) {
    reports.push(last.output)
    last.output = undefined
  }

  return { opening, stages, report: reports.join("\n\n") || body }
}

