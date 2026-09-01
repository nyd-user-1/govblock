"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { emptyRun, runAgent, type RunState } from "@/lib/agents/run-client"
import { maxRounds, type AgentDefinition } from "@/lib/agents/registry"
import { Button } from "@govblock/ui/components/nova/button"
import { Textarea } from "@govblock/ui/components/nova/textarea"

import { Prose, RunMeta, RunSteps } from "./transcript"

// The chat panel, ported from components/policy/assist-chat.tsx — the same
// bubbles, the same textarea, the same Clear/Send row, the same
// one-transcript-per-agent in this browser. What is new is the middle, where
// each tool call is rendered as it happens: a run is watched, not waited for.

type Turn = { role: "user"; text: string } | { role: "assistant"; run: RunState }

const STORAGE = (slug: string) => `govblock:agent:${slug}`

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

      const history: Turn[] = [...turns, { role: "user", text: trimmed }]
      setTurns([...history, { role: "assistant", run: emptyRun() }])

      await runAgent({
        agent: agent.slug,
        maxRounds: maxRounds(agent),
        jurisdiction: resolved ? state : undefined,
        turns: history.map((turn) =>
          turn.role === "user"
            ? { role: "user" as const, text: turn.text }
            : { role: "assistant" as const, text: turn.run.text }
        ),
        onUpdate: (run) => setTurns([...history, { role: "assistant", run }]),
      })

      setBusy(false)
    },
    [agent, busy, resolved, state, turns]
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

        {turns.map((turn, index) =>
          turn.role === "user" ? (
            <div
              key={index}
              className="ml-auto w-fit max-w-[85%] rounded-3xl bg-muted px-4 py-2.5 text-sm"
            >
              {turn.text}
            </div>
          ) : (
            <div key={index} className="flex w-full flex-col gap-3">
              <RunSteps steps={turn.run.steps} />
              {turn.run.text && (
                <div
                  className={cn(
                    "text-sm whitespace-pre-wrap",
                    turn.run.failed && "text-destructive"
                  )}
                >
                  <Prose text={turn.run.text} />
                </div>
              )}
              <RunMeta run={turn.run} />
            </div>
          )
        )}

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
