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

export async function runAgent({
  agent,
  turns,
  jurisdiction,
  subject,
  maxRounds,
  onUpdate,
  signal,
}: {
  agent: string
  turns: RunTurn[]
  jurisdiction?: string
  /** The inbox's subject line, which becomes the report's title. */
  subject?: string
  maxRounds: number
  /** Called after every event, with the run so far. */
  onUpdate: (run: RunState) => void
  signal?: AbortSignal
}): Promise<RunState> {
  const run = emptyRun()
  const began = Date.now()
  let carry: unknown = null
  let continuing = false

  const push = () => onUpdate({ ...run, steps: [...run.steps], ms: Date.now() - began })

  try {
    while (!run.done && run.rounds < maxRounds) {
      run.rounds += 1
      let roundText = 0

      // A round that was cut off mid-sentence continues in the next one; the
      // paragraph break between rounds must not land inside a word.
      if (continuing) roundText = 1
      continuing = false

      const response = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          carry
            ? { agent, jurisdiction, subject, state: carry }
            : {
                agent,
                jurisdiction,
                subject,
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
          } else if (event.t === "continue") {
            continuing = true
          } else if (event.t === "state") {
            carry = { messages: event.messages }
            run.done = Boolean(event.done)
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

    if (!run.done) {
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

  run.ms = Date.now() - began
  push()
  return run
}

/** The one-line accounting the panel and the inbox both print. */
export function runMeta(run: RunState) {
  const money = run.usd >= 0.01 ? `$${run.usd.toFixed(3)}` : `${(run.usd * 100).toFixed(2)}¢`
  return [
    run.model,
    `${run.rounds} round${run.rounds === 1 ? "" : "s"}`,
    `${run.inTokens.toLocaleString()} in / ${run.outTokens.toLocaleString()} out` +
      (run.cached ? ` · ${run.cached.toLocaleString()} cached` : ""),
    money,
    `${(run.ms / 1000).toFixed(1)} s`,
  ]
    .filter(Boolean)
    .join(" · ")
}
