"use client"

import * as React from "react"
import { ArrowUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Prose, RunSteps } from "@/app/agents/transcript"
import { AskWidget } from "@/components/chat/ask-widget"
import { DeliveryCard } from "@/components/chat/delivery-card"
import { MessageAnimated } from "@/components/chat/message-animated"
import { FormProgress } from "@/components/chat/progress"
import { ReviewWidget } from "@/components/chat/review-widget"
import { activeFormOf, formFor, settleAsk, type AskResult, type FillResult, type RememberResult, type ReviewResult } from "@/lib/chat/form-tools"
import { emptyRun, runAgent, type ClientResult, type RunState, type Step } from "@/lib/agents/run-client"
import { agent as agentBySlug, maxRounds } from "@/lib/agents/registry"
import { labelFor } from "@/lib/forms/keys"
import { isFormId, type FormId } from "@/lib/forms/programs"
import { loadProfile, mergeProfile, recallActiveForm, rememberActiveForm, type Values } from "@/lib/forms/profile"
import { saveFormToInbox } from "@/lib/chat/save-to-inbox"
import type { Filled } from "@/lib/forms/fill"
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
// A client-side tool call (a step of kind "ask") is drawn as a widget from
// the map below — the contract livingston-v3's message-parts.tsx has for its
// `tools` — and the widget's result resumes the run. The Filer's values go
// from the widget into the profile; the run receives a receipt.
//
// A surface's framing (the bill on screen, the jurisdiction in scope) has no
// field in the agents protocol, so it rides in-band: prefixed to the first
// user turn on the wire, never shown in the transcript.

export type Turn = { role: "user"; text: string } | { role: "assistant"; run: RunState }

type AskStep = Extract<Step, { kind: "ask" }>

export function AssistChat({
  chatId,
  system = "",
  agentSlug = "bill-reader",
  placeholder = "Ask about this bill…",
  className,
  compact = false,
  starters = [],
  seed,
  onSaveToInbox = saveFormToInbox,
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
  /** Writes a delivered thread for a filled form; the Agentic Inbox's store by default. */
  onSaveToInbox?: ((form: FormId, built: Filled, values: Values) => string | undefined) | null
}) {
  const storageKey = `govblock:panel:${chatId}`
  const definition = agentBySlug(agentSlug)
  const { state, resolved } = useJurisdiction()
  const [turns, setTurns] = React.useState<Turn[]>([])
  const [input, setInput] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [restored, setRestored] = React.useState<string | null>(null)
  // Results for a round that asked for more than one client-side call, until all are in.
  const pending = React.useRef<Map<number, ClientResult[]>>(new Map())
  const [fallbackForm, setFallbackForm] = React.useState<FormId | null>(null)
  React.useEffect(() => setFallbackForm(recallActiveForm()), [])

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

      // The Filer is told which keys the profile already holds — keys, never
      // values — on the first turn, the way a surface's framing rides.
      const known = definition.clientTools?.includes("ask") ? Object.keys(loadProfile().values).filter((k) => loadProfile().values[k]) : []
      const framing = [system, known.length ? `Already in the applicant's profile (keys only): ${known.join(", ")}.` : ""].filter(Boolean).join("\n\n")
      let framed = false
      const wire = history.map((turn) => {
        if (turn.role === "user") {
          const first = !framed
          framed = true
          return { role: "user" as const, text: first && framing ? `${framing}\n\n${turn.text}` : turn.text }
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

  // A widget answered: resume the run it belongs to with the result, once
  // every call the round is waiting on has one.
  const answer = React.useCallback(
    async (index: number, result: ClientResult) => {
      const turn = turns[index]
      if (!turn || turn.role !== "assistant" || !definition) return
      const run = turn.run
      const waiting = run.waiting ?? []
      const results = [...(pending.current.get(index) ?? []).filter((r) => r.id !== result.id), result]
      pending.current.set(index, results)
      if (waiting.some((w) => !results.some((r) => r.id === w.id))) {
        // Show the answer on its step while the rest are open.
        setTurns((current) =>
          current.map((t, i) => (i === index && t.role === "assistant" ? { ...t, run: { ...t.run, steps: t.run.steps.map((s) => (s.kind === "ask" && s.id === result.id ? { ...s, answer: result.result } : s)) } } : t))
        )
        return
      }
      pending.current.delete(index)
      setBusy(true)
      const history = turns.slice(0, index)
      await runAgent({
        agent: definition.slug,
        maxRounds: maxRounds(definition),
        jurisdiction: resolved ? state : undefined,
        turns: [],
        resume: { run, results },
        onUpdate: (next) => setTurns([...history, { role: "assistant", run: next }]),
      })
      setBusy(false)
    },
    [turns, definition, resolved, state]
  )

  // Calls answered without a widget: `remember` (the facts go into the
  // profile and the run resumes with the receipt, at once), and a call that
  // cannot be drawn — an `ask` naming a key the form does not have, a
  // `review` with no form in hand — which gets an error result instead.
  const auto = React.useRef(new Set<string>())
  React.useEffect(() => {
    turns.forEach((turn, index) => {
      if (turn.role !== "assistant" || !turn.run.waiting) return
      for (const step of turn.run.steps) {
        if (step.kind !== "ask" || step.answer || auto.current.has(step.id)) continue
        const inputForm = (step.input as { form?: unknown } | undefined)?.form
        const stepForm = isFormId(inputForm) ? inputForm : activeFormOf(turn.run.steps, fallbackForm)
        let result: unknown = null
        if (step.name === "remember") {
          const values = ((step.input as { values?: unknown })?.values ?? {}) as Values
          result = mergeProfile(typeof values === "object" && values ? values : {}) satisfies RememberResult
        } else if (step.name === "ask") {
          const settled = settleAsk(step.input, formFor(stepForm))
          if ("error" in settled) result = { error: settled.error } satisfies AskResult
        } else if ((step.name === "review" || step.name === "fill_form") && !stepForm) {
          result = { error: "No form is in hand; call form_schema first." }
        }
        if (result === null) continue
        auto.current.add(step.id)
        void answer(index, { id: step.id, result })
      }
    })
  }, [turns, answer, fallbackForm])

  // `/chat?form=ldss-2921` opens on the first question rather than a blank box.
  const seeded = React.useRef(false)
  React.useEffect(() => {
    if (!seed || seeded.current || restored !== chatId || turns.length) return
    seeded.current = true
    void send(seed)
  }, [seed, restored, chatId, turns.length, send])

  // The form in hand, from the run's own tool calls; remembered so a reload
  // and the progress line agree.
  const allSteps = React.useMemo(() => turns.flatMap((t) => (t.role === "assistant" ? t.run.steps : [])), [turns])
  const activeForm = activeFormOf(allSteps, fallbackForm)
  React.useEffect(() => {
    if (activeForm) rememberActiveForm(activeForm)
  }, [activeForm])
  const formActive = Boolean(activeForm) && turns.length > 0 && definition?.clientTools?.length

  const empty = turns.length === 0

  // The tool → widget map: a client-side call, drawn.
  const widget = (index: number, step: AskStep) => {
    const form = activeFormOf([step], activeForm)
    const inputForm = (step.input as { form?: unknown } | undefined)?.form
    const stepForm: FormId | null = isFormId(inputForm) ? inputForm : form
    const reply = (result: unknown) => void answer(index, { id: step.id, result })
    if (step.name === "ask") {
      const settled = settleAsk(step.input, formFor(stepForm))
      if ("error" in settled) return <div className="text-xs text-muted-foreground">{settled.error}</div>
      return <AskWidget key={step.id} input={settled.input} form={stepForm} answered={step.answer as AskResult | undefined} compact={compact} onSubmit={reply} />
    }
    if (step.name === "review" && stepForm) return <ReviewWidget key={step.id} form={stepForm} answered={step.answer as ReviewResult | undefined} compact={compact} onSubmit={reply} />
    if (step.name === "fill_form" && stepForm)
      return (
        <DeliveryCard
          key={step.id}
          form={stepForm}
          answered={step.answer as FillResult | undefined}
          compact={compact}
          onSubmit={reply}
          onSaveToInbox={onSaveToInbox ? (built, values) => onSaveToInbox(stepForm, built, values) : undefined}
        />
      )
    if (step.name === "remember") {
      const receipt = step.answer as RememberResult | undefined
      const kept = receipt?.kept ?? Object.keys(((step.input as { values?: object })?.values ?? {}) as object)
      return (
        <div key={step.id} className="text-xs text-muted-foreground">
          Kept: {kept.map((k) => labelFor(k).toLowerCase()).join(", ") || "nothing"}
        </div>
      )
    }
    if (stepForm === null && (step.name === "review" || step.name === "fill_form")) return <div className="text-xs text-muted-foreground">No form in hand.</div>
    return null
  }

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
                    {turn.run.steps.some((s) => s.kind === "ask") && (
                      <div className="flex w-full flex-col gap-3">
                        {turn.run.steps.map((step) => (step.kind === "ask" ? <React.Fragment key={step.id}>{widget(index, step)}</React.Fragment> : null))}
                      </div>
                    )}
                  </MessageAnimated>
                )
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {formActive && activeForm && <FormProgress form={activeForm} />}

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
