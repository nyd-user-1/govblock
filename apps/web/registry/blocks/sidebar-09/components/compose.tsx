"use client"

import * as React from "react"

import { ADDRESSES, matchAddresses, findAddress, type Address } from "@/lib/agents/inbox"
import { agent as findAgent } from "@/lib/agents/registry"
import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { Input } from "@govblock/ui/components/ny4/input"
import { Textarea } from "@govblock/ui/components/nova/textarea"

// Compose. The To: field is the agent picker, because "who do I send this to"
// is a question mail already answers well and a row of buttons is a worse
// version of it. Typing filters by name, address or speciality; the suggestion
// list carries the monogram and the one line that says what each one is for,
// which is the same copy /agents shows on its cards.

export type Draft = { to: string; subject: string; body: string }

export function Compose({
  draft,
  onChange,
  onSend,
  onDiscard,
  onSaveDraft,
}: {
  draft: Draft
  onChange: (draft: Draft) => void
  onSend: (address: Address, draft: Draft) => void
  onDiscard: () => void
  onSaveDraft: () => void
}) {
  const [picking, setPicking] = React.useState(false)
  const resolved = findAddress(draft.to)
  const suggestions = matchAddresses(draft.to).slice(0, 5)
  const definition = resolved ? findAgent(resolved.agent) : undefined

  const choose = (address: Address) => {
    onChange({ ...draft, to: address.email })
    setPicking(false)
  }

  return (
    <form
      className="flex max-w-3xl flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (resolved) onSend(resolved, draft)
      }}
    >
      <div className="relative flex flex-col gap-1">
        <div className="flex items-center gap-3 border-b pb-2">
          <label
            htmlFor="task-recipient"
            className="w-16 shrink-0 text-sm text-muted-foreground"
          >
            To
          </label>
          {/*
            Chrome offers its own address autofill over ours — a "To" label and
            an @-shaped placeholder is enough for its heuristics to call this an
            email field, and the reader gets their personal gmail and "Manage
            Addresses…" on top of the agent list. autoComplete="off" alone does
            not stop it, so the field also carries no mail-ish token in its id or
            name, declares text rather than email, and says what it actually is:
            a combobox over a list this page owns. The placeholder shows a name
            rather than an address for the same reason; the dropdown rows still
            show the addresses, because that is where they belong.
          */}
          <Input
            id="task-recipient"
            name="task-recipient"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={picking && suggestions.length > 0}
            aria-controls="task-recipient-options"
            autoComplete="off"
            spellCheck={false}
            value={draft.to}
            onChange={(event) => {
              onChange({ ...draft, to: event.target.value })
              setPicking(true)
            }}
            onFocus={() => setPicking(true)}
            onBlur={() => window.setTimeout(() => setPicking(false), 150)}
            placeholder="Researcher"
            className="border-0 shadow-none focus-visible:ring-0"
          />
          {resolved && (
            <span className="shrink-0 text-xs text-muted-foreground">{resolved.name}</span>
          )}
        </div>

        {picking && suggestions.length > 0 && (
          <div
            id="task-recipient-options"
            role="listbox"
            className="absolute top-full right-0 left-16 z-20 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md"
          >
            {suggestions.map((address) => (
              <button
                key={address.email}
                type="button"
                role="option"
                aria-selected={resolved?.email === address.email}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(address)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted",
                  resolved?.email === address.email && "bg-muted"
                )}
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

      <div className="flex items-center gap-3 border-b pb-2">
        <label htmlFor="compose-subject" className="w-16 shrink-0 text-sm text-muted-foreground">
          Subject
        </label>
        <Input
          id="compose-subject"
          value={draft.subject}
          onChange={(event) => onChange({ ...draft, subject: event.target.value })}
          placeholder="What the report is about"
          className="border-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <Textarea
        value={draft.body}
        onChange={(event) => onChange({ ...draft, body: event.target.value })}
        placeholder={definition?.placeholder ?? "What should it do?"}
        className="min-h-48"
      />

      {definition && (
        <div className="flex flex-wrap gap-2">
          {definition.starters.map((starter) => (
            <Button
              key={starter}
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({ ...draft, body: starter, subject: draft.subject || starter })
              }
            >
              {starter}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={!resolved || !draft.body.trim()}>
          Send
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onSaveDraft}>
          Save draft
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
          Discard
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {resolved
            ? "Runs in this tab. Kept in this browser, not on a server."
            : `Address one of: ${ADDRESSES.map((a) => a.email).join(", ")}`}
        </span>
      </div>
    </form>
  )
}
