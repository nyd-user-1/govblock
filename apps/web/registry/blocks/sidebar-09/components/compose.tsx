"use client"

import * as React from "react"
import { X } from "lucide-react"

import { findAddress, isPerson, matchAddresses, nameOf, type Address } from "@/lib/agents/inbox"
import { agent as findAgent } from "@/lib/agents/registry"
import { MODELS } from "@/lib/agents/models"
import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { Input } from "@govblock/ui/components/ny4/input"
import {
  TaskSurface,
  TaskToolbar,
  useTaskEditor,
} from "@/registry/blocks/sidebar-09/components/rich-body"

// Compose. The recipient fields are the agent picker, because "who do I send
// this to" is a question mail already answers well and a row of buttons is a
// worse version of it. A chosen agent becomes a chip; typing filters the rest
// by name, address or speciality.
//
// Cc means what it means: every agent on the line runs the task and replies on
// the thread, so three recipients is three runs and three times the Bedrock
// bill. That is said on the surface rather than discovered on the invoice. Bcc
// is the same run whose recipient line the thread does not show.

export type Draft = { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string }

export const EMPTY_DRAFT: Draft = { to: [], cc: [], bcc: [], subject: "", body: "" }

type Line = "to" | "cc" | "bcc"

function Chip({ slug, onRemove }: { slug: string; onRemove: () => void }) {
  const definition = findAgent(slug)
  const monogram = nameOf(slug)
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-1 pl-1 text-sm"
      title={definition?.speciality}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-background text-[10px] font-medium">
        {monogram}
      </span>
      {nameOf(slug)}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${nameOf(slug)}`}
        className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

function Recipients({
  line,
  label,
  chips,
  onChange,
  trailing,
}: {
  line: Line
  label: string
  chips: string[]
  onChange: (next: string[]) => void
  trailing?: React.ReactNode
}) {
  const [query, setQuery] = React.useState("")
  const [picking, setPicking] = React.useState(false)
  const id = `task-${line}`
  const suggestions = matchAddresses(query)
    .filter((address) => !chips.includes(address.agent))
    .slice(0, 5)

  const add = (address: Address) => {
    onChange([...chips, address.agent])
    setQuery("")
    setPicking(false)
  }

  return (
    <div className="relative flex flex-col gap-1">
      <div className="flex w-full items-center gap-3 border-b pb-2">
        <label htmlFor={id} className="w-12 shrink-0 text-sm text-muted-foreground">
          {label}
        </label>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {chips.map((slug) => (
            <Chip
              key={slug}
              slug={slug}
              onRemove={() => onChange(chips.filter((entry) => entry !== slug))}
            />
          ))}
          {/*
            Chrome offers its own address autofill over ours — a field labelled
            "To" with an @-shaped placeholder is enough for its heuristics to
            call this an email input, and the reader gets their personal gmail
            and "Manage Addresses…" on top of the agent list. autoComplete="off"
            alone does not stop it, so the field carries no mail-ish token in its
            id or name, declares text, and says what it actually is: a combobox
            over a list this page owns.
          */}
          <Input
            id={id}
            name={id}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={picking && suggestions.length > 0}
            aria-controls={`${id}-options`}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPicking(true)
            }}
            onFocus={() => setPicking(true)}
            onBlur={() => window.setTimeout(() => setPicking(false), 150)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Tab") {
                const exact = findAddress(query)
                const pick = exact ?? suggestions[0]
                if (pick && query.trim()) {
                  event.preventDefault()
                  add(pick)
                }
              }
              if (event.key === "Backspace" && !query && chips.length) {
                onChange(chips.slice(0, -1))
              }
            }}
            placeholder={chips.length ? "" : "Researcher"}
            className="min-w-32 flex-1 border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        {trailing}
      </div>

      {picking && suggestions.length > 0 && (
        <div
          id={`${id}-options`}
          role="listbox"
          className="absolute top-full right-0 left-12 z-20 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md"
        >
          {suggestions.map((address) => (
            <button
              key={address.email}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(address)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {address.monogram}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm">
                  {address.name}{" "}
                  <span className="text-muted-foreground">&lt;{address.email}&gt;</span>
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {address.speciality}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Compose({
  draft,
  onChange,
  onSend,
  onDiscard,
  onSaveDraft,
  inline = false,
}: {
  draft: Draft
  onChange: (draft: Draft) => void
  onSend: (draft: Draft) => void
  onDiscard: () => void
  onSaveDraft?: () => void
  /** A reply at the bottom of a thread: no recipient lines, no subject. */
  inline?: boolean
}) {
  const [showCc, setShowCc] = React.useState(false)
  const [showBcc, setShowBcc] = React.useState(false)
  const everyone = [...draft.to, ...draft.cc, ...draft.bcc]
  const agents = everyone.filter((slug) => !isPerson(slug))
  const people = everyone.filter(isPerson)
  const first = findAgent(draft.to.find((slug) => !isPerson(slug)) ?? "")

  const editor = useTaskEditor({
    value: draft.body,
    onChange: (body) => onChange({ ...draft, body }),
    placeholder: inline ? "Reply…" : (first?.placeholder ?? "What should it do?"),
  })

  // n agents is n runs. Say what that costs before it is spent.
  const estimate = agents
    .map((slug) => findAgent(slug))
    .filter(Boolean)
    .map((definition) => MODELS[definition!.tier].label)

  return (
    <form
      className="flex w-full flex-1 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (everyone.length && draft.body.trim()) onSend(draft)
      }}
    >
      {!inline && (
        <>
          <Recipients
            line="to"
            label="To"
            chips={draft.to}
            onChange={(to) => onChange({ ...draft, to })}
            trailing={
              <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                {!showCc && (
                  <button type="button" className="hover:text-foreground" onClick={() => setShowCc(true)}>
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button type="button" className="hover:text-foreground" onClick={() => setShowBcc(true)}>
                    Bcc
                  </button>
                )}
              </div>
            }
          />
          {showCc && (
            <Recipients
              line="cc"
              label="Cc"
              chips={draft.cc}
              onChange={(cc) => onChange({ ...draft, cc })}
            />
          )}
          {showBcc && (
            <Recipients
              line="bcc"
              label="Bcc"
              chips={draft.bcc}
              onChange={(bcc) => onChange({ ...draft, bcc })}
            />
          )}

          <div className="flex w-full items-center gap-3 border-b pb-2">
            <label htmlFor="task-subject" className="w-12 shrink-0 text-sm text-muted-foreground">
              Subject
            </label>
            <Input
              id="task-subject"
              name="task-subject"
              autoComplete="off"
              value={draft.subject}
              onChange={(event) => onChange({ ...draft, subject: event.target.value })}
              placeholder="What the report is about"
              className="w-full flex-1 border-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </>
      )}

      {/* A clean writing surface with nothing above it. The body is markdown
          on the wire and formatting on the screen — the agent reads `**bold**`
          and `- item`, the reader sees bold and a bullet, and the thread
          renders the same subset back. */}
      <TaskSurface
        editor={editor}
        className={inline ? "[&_.ProseMirror]:min-h-24 min-h-24" : ""}
      />

      {!inline && first && (
        <div className="flex flex-wrap gap-2">
          {first.starters.map((starter) => (
            <Button
              key={starter}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...draft, body: starter, subject: draft.subject || starter })}
            >
              {starter}
            </Button>
          ))}
        </div>
      )}

      {/* The bottom bar, in Gmail's arrangement: Send first, the formatting
          row immediately beside it, and the rest pushed right. Formatting
          belongs down here with the action, not on top of the page someone is
          trying to write on. */}
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button type="submit" size="sm" disabled={!everyone.length || !draft.body.trim()}>
          Send
        </Button>
        <TaskToolbar editor={editor} />
        {onSaveDraft && (
          <Button type="button" variant="ghost" size="sm" onClick={onSaveDraft}>
            Save draft
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
          {inline ? "Cancel" : "Discard"}
        </Button>
        <span className={cn("ml-auto text-xs text-muted-foreground", !everyone.length && "hidden")}>
          {agents.length === 1 && `One run on ${estimate[0]}.`}
          {agents.length > 1 &&
            `${agents.length} agents means ${agents.length} runs — ${estimate.join(", ")} — and ${agents.length}× the cost.`}
          {people.length > 0 &&
            ` ${people.map(nameOf).join(", ")} ${people.length === 1 ? "is" : "are"} recorded on the thread; ${people.length === 1 ? "he gets" : "they get"} it when notifications exist.`}
          {!agents.length && !people.length && "Kept in this browser, not on a server."}
        </span>
      </div>
    </form>
  )
}
