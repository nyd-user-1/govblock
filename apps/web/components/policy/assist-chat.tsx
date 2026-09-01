"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Prose, RunMeta, RunSteps } from "@/app/agents/transcript"
import { emptyRun, runAgent, type RunState } from "@/lib/agents/run-client"
import { agent as agentBySlug, maxRounds } from "@/lib/agents/registry"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { Button } from "@govblock/ui/components/nova/button"
import { Textarea } from "@govblock/ui/components/nova/textarea"

// The assistant, framed by the surface it sits in (the bill, the member).
//
// This panel posted to /api/chat since the v3 port, and no such route ever
// existed here. It now speaks the agents protocol (lane X §10): one POST per
// round, tool calls rendered as they happen, answered by a real specialist —
// the Bill Reader unless the surface says otherwise. The old `system` framing
// has no field in that protocol, so it rides in-band: prefixed to the first
// user turn on the wire, never shown in the transcript. Same words, same
// effect, honest transport.

type Turn = { role: "user"; text: string } | { role: "assistant"; run: RunState }

export function AssistChat({
  chatId,
  system,
  agentSlug = "bill-reader",
  placeholder = "Ask about this bill…",
  className,
  compact = false,
  starters = [],
}: {
  chatId: string
  system: string
  agentSlug?: string
  placeholder?: string
  className?: string
  compact?: boolean
  starters?: string[]
}) {
  // The old key held the AI SDK's message shape; this one holds runs.
  const storageKey = `govblock:panel:${chatId}`
  const definition = agentBySlug(agentSlug)
  const { state, resolved } = useJurisdiction()
  const [turns, setTurns] = React.useState<Turn[]>([])
  const [input, setInput] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [restored, setRestored] = React.useState<string | null>(null)
  const bottomRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (restored === chatId) return
    try {
      const raw = window.localStorage.getItem(storageKey)
      setTurns(raw ? (JSON.parse(raw) as Turn[]) : [])
    } catch {
      setTurns([])
    }
    setRestored(chatId)
  }, [chatId, storageKey, restored])

  React.useEffect(() => {
    if (restored !== chatId) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(turns))
    } catch {}
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [turns, restored, chatId, storageKey])

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy || !definition) return
      setInput("")
      setBusy(true)

      const history: Turn[] = [...turns, { role: "user", text: trimmed }]
      setTurns([...history, { role: "assistant", run: emptyRun() }])

      // The surface's framing rides on the first user turn of the wire copy.
      let framed = false
      const wire = history.map((turn) => {
        if (turn.role === "user") {
          const first = !framed
          framed = true
          return {
            role: "user" as const,
            text: first && system ? `${system}\n\n${turn.text}` : turn.text,
          }
        }
        return { role: "assistant" as const, text: turn.run.text }
      })

      await runAgent({
        agent: definition.slug,
        maxRounds: maxRounds(definition),
        jurisdiction: resolved ? state : undefined,
        turns: wire,
        onUpdate: (run) => setTurns([...history, { role: "assistant", run }]),
      })

      setBusy(false)
    },
    [busy, definition, resolved, state, system, turns]
  )

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
      <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto", compact ? "text-sm" : "")}>
        {turns.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{placeholder}</p>
            {starters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {starters.map((starter) => (
                  <Button key={starter} variant="outline" size="sm" onClick={() => void send(starter)}>
                    {starter}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
        {turns.map((turn, index) =>
          turn.role === "user" ? (
            <div key={index} className="ml-auto w-fit max-w-[85%] rounded-3xl bg-muted px-4 py-2.5">
              {turn.text}
            </div>
          ) : (
            <div key={index} className="flex w-full flex-col gap-3">
              <RunSteps steps={turn.run.steps} />
              {turn.run.text && (
                <div className={cn("whitespace-pre-wrap", turn.run.failed && "text-destructive")}>
                  <Prose text={turn.run.text} />
                </div>
              )}
              <RunMeta run={turn.run} />
            </div>
          )
        )}
        {busy && turns.at(-1)?.role === "user" && (
          <div className="text-sm text-muted-foreground">Working…</div>
        )}
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
          placeholder={placeholder}
          className={compact ? "min-h-16" : "min-h-20"}
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
          <Button type="submit" size="sm" disabled={busy || !input.trim() || !definition}>
            {busy ? "Working…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  )
}
