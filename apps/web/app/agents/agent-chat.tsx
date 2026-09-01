"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { AgentDefinition } from "@/lib/agents/registry"
import { Button } from "@govblock/ui/components/nova/button"
import { Textarea } from "@govblock/ui/components/nova/textarea"

// The chat panel, ported from components/policy/assist-chat.tsx — the same
// bubbles, the same textarea, the same Clear/Send row, the same
// one-transcript-per-agent in this browser. What is new is the middle: the
// route streams the tool calls as they happen, so a run is watched rather than
// waited for.

type Step =
  | { kind: "tool"; id: string; name: string; input: unknown; summary?: string; ok?: boolean; ms?: number }
  | { kind: "note"; text: string }

type Turn = {
  role: "user" | "assistant"
  text: string
  steps?: Step[]
  meta?: { model: string; usd: number; ms: number; stopReason: string; tokens: string }
  failed?: boolean
}

const STORAGE = (slug: string) => `govblock:agent:${slug}`

function money(usd: number) {
  if (usd >= 0.01) return `$${usd.toFixed(3)}`
  return `${(usd * 100).toFixed(2)}¢`
}

function StepLine({ step }: { step: Step }) {
  if (step.kind === "note") {
    return <div className="text-xs text-muted-foreground">{step.text}</div>
  }
  const args = Object.entries((step.input ?? {}) as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ")
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
      <code className="rounded bg-muted px-1.5 py-0.5">{step.name}</code>
      {args && <span className="min-w-0 truncate text-muted-foreground">{args}</span>}
      {step.summary !== undefined ? (
        <span className={cn("tabular-nums", step.ok ? "text-muted-foreground" : "text-destructive")}>
          → {step.summary}
          {step.ms !== undefined ? ` · ${step.ms} ms` : ""}
        </span>
      ) : (
        <span className="text-muted-foreground">…</span>
      )}
    </div>
  )
}

export function AgentChat({ agent }: { agent: AgentDefinition }) {
  // `resolved` is false until the client knows which jurisdiction it is in;
  // sending before then would tell the agent US for a Texas reader.
  const { state, resolved } = useJurisdiction()
  const [turns, setTurns] = React.useState<Turn[]>([])
  const [input, setInput] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [restored, setRestored] = React.useState(false)
  const bottomRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE(agent.slug))
      if (raw) setTurns(JSON.parse(raw) as Turn[])
    } catch {}
    setRestored(true)
  }, [agent.slug])

  React.useEffect(() => {
    if (!restored) return
    try {
      window.localStorage.setItem(STORAGE(agent.slug), JSON.stringify(turns))
    } catch {}
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [turns, restored, agent.slug])

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy) return
      setInput("")
      setBusy(true)

      const history = [...turns, { role: "user" as const, text: trimmed }]
      setTurns([...history, { role: "assistant", text: "", steps: [] }])

      // Everything below mutates this one draft and pushes it into the last
      // turn, so a partial answer is on screen the moment the first token
      // arrives rather than after the run finishes.
      const draft: Turn = { role: "assistant", text: "", steps: [] }
      const push = () => setTurns([...history, { ...draft, steps: [...(draft.steps ?? [])] }])

      try {
        const response = await fetch("/api/agents/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            agent: agent.slug,
            jurisdiction: resolved ? state : undefined,
            turns: history.map(({ role, text }) => ({ role, text })),
          }),
        })

        if (!response.body) throw new Error(`no stream (${response.status})`)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
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
              draft.text += String(event.v)
            } else if (event.t === "tool") {
              draft.steps = [
                ...(draft.steps ?? []),
                { kind: "tool", id: String(event.id), name: String(event.name), input: event.input },
              ]
            } else if (event.t === "tool_result") {
              draft.steps = (draft.steps ?? []).map((step) =>
                step.kind === "tool" && step.id === event.id
                  ? { ...step, summary: String(event.summary), ok: Boolean(event.ok), ms: Number(event.ms) }
                  : step
              )
            } else if (event.t === "error") {
              draft.failed = true
              draft.text += (draft.text ? "\n\n" : "") + String(event.message)
            } else if (event.t === "open") {
              draft.meta = { model: String(event.label), usd: 0, ms: 0, stopReason: "", tokens: "" }
            } else if (event.t === "done") {
              const usage = event.usage as { inputTokens: number; outputTokens: number }
              draft.meta = {
                model: draft.meta?.model ?? "",
                usd: Number(event.usd),
                ms: Number(event.ms),
                stopReason: String(event.stopReason),
                tokens: `${usage.inputTokens.toLocaleString()} in / ${usage.outputTokens.toLocaleString()} out`,
              }
            }
            push()
          }
        }
      } catch (error) {
        draft.failed = true
        draft.text += (draft.text ? "\n\n" : "") + (error instanceof Error ? error.message : String(error))
        push()
      } finally {
        setBusy(false)
      }
    },
    [agent.slug, busy, resolved, state, turns]
  )

  return (
    <div className="not-prose flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex min-h-[22rem] flex-col gap-5 overflow-y-auto">
        {turns.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{agent.placeholder}</p>
            <div className="flex flex-wrap gap-2">
              {agent.starters.map((starter) => (
                <Button key={starter} variant="outline" size="sm" onClick={() => void send(starter)}>
                  {starter}
                </Button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, index) => (
          <div
            key={index}
            className={cn(
              turn.role === "user"
                ? "ml-auto w-fit max-w-[85%] rounded-3xl bg-muted px-4 py-2.5 text-sm"
                : "flex w-full flex-col gap-3"
            )}
          >
            {turn.role === "user" ? (
              turn.text
            ) : (
              <>
                {(turn.steps?.length ?? 0) > 0 && (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-dashed p-3">
                    {turn.steps!.map((step, i) => (
                      <StepLine key={i} step={step} />
                    ))}
                  </div>
                )}
                {turn.text && (
                  <div className={cn("text-sm whitespace-pre-wrap", turn.failed && "text-destructive")}>
                    {turn.text}
                  </div>
                )}
                {turn.meta?.stopReason && (
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {turn.meta.model} · {turn.meta.stopReason} · {turn.meta.tokens} ·{" "}
                    {money(turn.meta.usd)} · {(turn.meta.ms / 1000).toFixed(1)} s
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {busy && <div className="text-sm text-muted-foreground">Working…</div>}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex shrink-0 flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void send(input)
        }}
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void send(input)
            }
          }}
          placeholder={agent.placeholder}
          className="min-h-20"
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setTurns([])}
            disabled={!turns.length || busy}
          >
            Clear
          </Button>
          <Button type="submit" size="sm" disabled={busy || !input.trim()}>
            {busy ? "Working…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  )
}
