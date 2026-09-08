// Driving an agent from the browser.
//
// One POST is one round of the loop — Amplify WEB_COMPUTE buffers a response
// body, so a server-side loop would show nothing for a minute and then
// everything at once. The conversation comes back as `state` and goes out
// again until the model stops asking for tools, which is what makes the steps
// arrive as they happen. Converse is stateless and the history is resent every
// round regardless, so this costs round trips, not tokens.
//
// This module is the whole protocol, in one place, because two surfaces speak
// it: the chat panel on /agents and the Agentic Inbox. A second copy would
// drift the first time an event was added.

export type Step =
  | {
      kind: "tool"
      id: string
      name: string
      input: unknown
      summary?: string
      ok?: boolean
      ms?: number
    }
  | { kind: "note"; text: string }
  /**
   * A call the browser answers — the Filer's `ask`, `review`, `fill_form`,
   * `remember`. The chat draws it as a widget; `answer` is set once the widget
   * has returned its result and the run has been resumed with it.
   */
  | { kind: "ask"; id: string; name: string; input: unknown; answer?: unknown }

export type Waiting = { id: string; name: string }

export type RunState = {
  text: string
  steps: Step[]
  /** The model that answered, by its label. */
  model: string
  rounds: number
  usd: number
  ms: number
  inTokens: number
  outTokens: number
  cached: number
  done: boolean
  failed: boolean
  /** Client-side calls the run is stopped on; absent once it is moving again. */
  waiting?: Waiting[]
  /** The conversation to resume from while `waiting`; dropped when the run ends. */
  carry?: { messages: unknown[] }
}

export function emptyRun(): RunState {
  return {
    text: "",
    steps: [],
    model: "",
    rounds: 0,
    usd: 0,
    ms: 0,
    inTokens: 0,
    outTokens: 0,
    cached: 0,
    done: false,
    failed: false,
  }
}

export type RunTurn = { role: "user" | "assistant"; text: string }

/** What a widget hands back for one client-side call. */
export type ClientResult = { id: string; result: unknown }

/**
 * The conversation a waiting run resumes with: each answer as a toolResult
 * on the trailing user turn, which the server built to hold this round's
 * server-side results — or which is created here when there were none.
 * Converse pairs every toolUse with a toolResult in the very next message;
 * this is where the browser keeps that promise.
 */
function answered(run: RunState, results: ClientResult[]) {
  const messages = [...((run.carry?.messages ?? []) as { role?: string; content?: unknown[] }[])]
  const blocks = results.map(({ id, result }) => ({
    toolResult: { toolUseId: id, content: [{ text: JSON.stringify(result ?? {}) }], status: "success" as const },
  }))
  const last = messages.at(-1)
  if (last?.role === "user") messages[messages.length - 1] = { ...last, content: [...(last.content ?? []), ...blocks] }
  else messages.push({ role: "user", content: blocks })
  return { messages }
}

export async function runAgent({
  agent,
  turns,
  jurisdiction,
  subject,
  reportType,
  maxRounds,
  onUpdate,
  signal,
  resume,
}: {
  agent: string
  turns: RunTurn[]
  jurisdiction?: string
  /** The inbox's subject line, which becomes the report's title. */
  subject?: string
  /** Which report format was picked, if this run came from the inbox. */
  reportType?: string
  maxRounds: number
  /** Called after every event, with the run so far. */
  onUpdate: (run: RunState) => void
  signal?: AbortSignal
  /** A run stopped on client-side calls, continued with their results. */
  resume?: { run: RunState; results: ClientResult[] }
}): Promise<RunState> {
  const run: RunState = resume
    ? {
        ...resume.run,
        steps: resume.run.steps.map((step) => {
          if (step.kind !== "ask") return step
          const hit = resume.results.find((r) => r.id === step.id)
          return hit ? { ...step, answer: hit.result } : step
        }),
        waiting: undefined,
        done: false,
        failed: false,
      }
    : emptyRun()
  const began = Date.now()
  const before = resume?.run.ms ?? 0
  let carry: unknown = resume ? answered(resume.run, resume.results) : null
  let continuing = false
  // A Trace Report is a rendering of the run, and the run's prose is half of
  // it: what the Clerk reasoned between one call and the next is the part the
  // steps cannot carry. So in this one mode each round's prose is kept in the
  // steps as a note, in order, beside the calls it sits between — which is
  // exactly the trace. Every other run leaves `steps` as it was, tool calls
  // only, because the chat panel counts and renders them.
  const tracing = reportType === "Trace Report"
  let note: number | null = null

  const push = () => onUpdate({ ...run, steps: [...run.steps], ms: before + (Date.now() - began) })

  try {
    while (!run.done && !run.waiting && run.rounds < maxRounds) {
      run.rounds += 1
      let roundText = 0

      // A round that was cut off mid-sentence continues in the next one; the
      // paragraph break between rounds must not land inside a word, and the
      // continuation belongs to the same note — one stage of the trace, not two.
      if (continuing) roundText = 1
      else note = null
      continuing = false

      const response = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          carry
            ? { agent, jurisdiction, subject, reportType, state: carry }
            : {
                agent,
                jurisdiction,
                subject,
                reportType,
                turns: turns.map(({ role, text }) => ({ role, text })),
              }
        ),
        signal,
      })

      if (!response.body) throw new Error(`no stream (${response.status})`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      for (;;) {
        const { done: finished, value } = await reader.read()
        if (finished) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const raw of lines) {
          if (!raw.trim()) continue
          let event: Record<string, unknown>
          try {
            event = JSON.parse(raw)
          } catch {
            continue
          }

          if (event.t === "text") {
            // A round's prose is its own paragraph. Without this the Tracker's
            // "I'll search…" runs straight into its "Now I'll open the top five
            // bills…" with no space between them.
            if (run.text && roundText === 0) run.text += "\n\n"
            roundText += 1
            run.text += String(event.v)
            if (tracing) {
              if (note === null) {
                note = run.steps.length
                run.steps = [...run.steps, { kind: "note", text: String(event.v) }]
              } else {
                const at = note
                run.steps = run.steps.map((step, i) =>
                  i === at && step.kind === "note" ? { ...step, text: step.text + String(event.v) } : step
                )
              }
            }
          } else if (event.t === "tool") {
            run.steps = [
              ...run.steps,
              { kind: "tool", id: String(event.id), name: String(event.name), input: event.input },
            ]
          } else if (event.t === "tool_result") {
            run.steps = run.steps.map((step) =>
              step.kind === "tool" && step.id === event.id
                ? {
                    ...step,
                    summary: String(event.summary),
                    ok: Boolean(event.ok),
                    ms: Number(event.ms),
                  }
                : step
            )
          } else if (event.t === "ask") {
            // The call was announced as a tool step when it streamed; it is a
            // widget now, under the same id.
            const ask = { kind: "ask" as const, id: String(event.id), name: String(event.name), input: event.input }
            run.steps = run.steps.some((step) => step.kind === "tool" && step.id === ask.id)
              ? run.steps.map((step) => (step.kind === "tool" && step.id === ask.id ? ask : step))
              : [...run.steps, ask]
          } else if (event.t === "continue") {
            continuing = true
          } else if (event.t === "state") {
            carry = { messages: event.messages }
            run.done = Boolean(event.done)
            if (Array.isArray(event.waiting) && event.waiting.length) {
              run.waiting = event.waiting as Waiting[]
              run.carry = { messages: event.messages as unknown[] }
            }
          } else if (event.t === "open") {
            if (!run.model) run.model = String(event.label)
          } else if (event.t === "done") {
            const usage = event.usage as {
              inputTokens: number
              outputTokens: number
              cacheReadInputTokens?: number
              cacheWriteInputTokens?: number
            }
            run.usd += Number(event.usd)
            // The three input counts are disjoint — a cached token is not also
            // in inputTokens — so "in" is their sum. Printing inputTokens alone
            // reads as "3 in" on a round that in fact sent thousands and wrote
            // them to the cache.
            run.cached += usage.cacheReadInputTokens ?? 0
            run.inTokens +=
              usage.inputTokens +
              (usage.cacheReadInputTokens ?? 0) +
              (usage.cacheWriteInputTokens ?? 0)
            run.outTokens += usage.outputTokens
          } else if (event.t === "error") {
            run.failed = true
            run.done = true
            run.text += (run.text ? "\n\n" : "") + String(event.message)
          }
          push()
        }
      }
    }

    if (!run.done && !run.waiting) {
      run.failed = true
      run.done = true
      run.text +=
        (run.text ? "\n\n" : "") + `Stopped after ${maxRounds} rounds without reaching an answer.`
    }
  } catch (error) {
    run.failed = true
    run.done = true
    run.text +=
      (run.text ? "\n\n" : "") + (error instanceof Error ? error.message : String(error))
  }

  run.ms = before + (Date.now() - began)
  // The conversation is only kept while a widget is open; a finished run's
  // history is the model's business, not this browser's storage.
  if (!run.waiting) delete run.carry
  push()
  return run
}

/** The one-line accounting the panel and the inbox both print. */
