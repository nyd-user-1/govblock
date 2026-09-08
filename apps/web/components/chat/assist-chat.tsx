"use client"

import * as React from "react"
import { ArrowUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Prose, RunSteps } from "@/app/agents/transcript"
import { MessageAnimated } from "@/components/chat/message-animated"
import { emptyRun, runAgent, type RunState } from "@/lib/agents/run-client"
import { agent as agentBySlug, maxRounds } from "@/lib/agents/registry"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { Button } from "@govblock/ui/components/nova/button"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@govblock/ui/components/nova/input-group"
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerProvider, MessageScrollerViewport } from "@govblock/ui/components/nova/message-scroller"

// The one chat: the app-shell panel, /chat and /agents/[slug] all render this.
//
// The plumbing is runAgent's — one POST per round, the run watched as it
// happens — and it was already here. What was not was the render tree: this
// is livingston-v3's chat card (apps/v4/components/cards/chat.tsx) and its
// message primitives, ported onto that plumbing. The scroller follows the
// newest turn until the reader scrolls up; a turn slides in; the composer is
// the InputGroup pinned to the bottom of whatever column holds it.
//
// A surface's framing (the bill on screen, the jurisdiction in scope) has no
// field in the agents protocol, so it rides in-band: prefixed to the first
// user turn on the wire, never shown in the transcript.

export type Turn = { role: "user"; text: string } | { role: "assistant"; run: RunState }

export function AssistChat({
  chatId,
  system = "",
  agentSlug = "bill-reader",
  placeholder = "Ask about this bill…",
  className,
  compact = false,
  starters = [],
  seed,
}: {
  chatId: string
  system?: string
  agentSlug?: string
  placeholder?: string
  className?: string
  /** The 423px drawer: stacked fields, no two-column grids. */
  compact?: boolean
  starters?: string[]
  /** A first message sent on mount when the transcript is empty (`/chat?form=…`). */
  seed?: string
}) {
  const storageKey = `govblock:panel:${chatId}`
  const definition = agentBySlug(agentSlug)
  const { state, resolved } = useJurisdiction()
  const [turns, setTurns] = React.useState<Turn[]>([])
  const [input, setInput] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [restored, setRestored] = React.useState<string | null>(null)

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
  }, [turns, restored, chatId, storageKey])

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy || !definition) return
      setInput("")
      setBusy(true)

      const history: Turn[] = [...turns, { role: "user", text: trimmed }]
      setTurns([...history, { role: "assistant", run: emptyRun() }])

      let framed = false
      const wire = history.map((turn) => {
        if (turn.role === "user") {
          const first = !framed
          framed = true
          return { role: "user" as const, text: first && system ? `${system}\n\n${turn.text}` : turn.text }
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

  // `/chat?form=ldss-2921` opens on the first question rather than a blank box.
  const seeded = React.useRef(false)
  React.useEffect(() => {
    if (!seed || seeded.current || restored !== chatId || turns.length) return
    seeded.current = true
    void send(seed)
  }, [seed, restored, chatId, turns.length, send])

  const empty = turns.length === 0

  return (
    <div data-slot="assist-chat" className={cn("flex min-h-0 flex-1 flex-col gap-3", compact && "text-sm", className)}>
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport className="scroll-fade pr-1">
            <MessageScrollerContent className="gap-5 pb-2">
              {empty && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">{placeholder}</p>
                  {starters.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {starters.map((starter) => (
                        <Button key={starter} variant="outline" size="sm" className="h-auto whitespace-normal py-1.5 text-left" onClick={() => void send(starter)}>
                          {starter}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {turns.map((turn, index) =>
                turn.role === "user" ? (
                  <MessageAnimated key={index} message={{ id: `${chatId}-${index}`, role: "user", text: turn.text }} />
                ) : (
                  <MessageAnimated
                    key={index}
                    message={{ id: `${chatId}-${index}`, role: "assistant" }}
                    text={
                      turn.run.text ? (
                        <div className={cn("whitespace-pre-wrap", turn.run.failed && "text-destructive")}>
                          <Prose text={turn.run.text} />
                        </div>
                      ) : busy && index === turns.length - 1 && !turn.run.steps.length ? (
                        <span className="text-muted-foreground">Working…</span>
                      ) : undefined
                    }
                  >
                    <RunSteps steps={turn.run.steps} />
                  </MessageAnimated>
                )
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <form
        className="shrink-0"
        onSubmit={(event) => {
          event.preventDefault()
          void send(input)
        }}
      >
        <InputGroup>
          <InputGroupInput
            id={`${chatId}-composer`}
            placeholder={placeholder}
            autoComplete="off"
            value={input}
            disabled={!definition}
            onChange={(event) => setInput(event.target.value)}
          />
          {!empty && !busy && (
            <InputGroupAddon align="inline-start">
              <InputGroupButton size="xs" variant="ghost" className="text-muted-foreground" onClick={() => setTurns([])}>
                Clear
              </InputGroupButton>
            </InputGroupAddon>
          )}
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" size="icon-xs" className="rounded-full" variant="default" disabled={busy || !input.trim() || !definition}>
              <ArrowUpIcon />
              <span className="sr-only">Send</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  )
}
