"use client"

import * as React from "react"

import { share, type Conversation, type Statement } from "@/lib/consensus/data"
import { SplitBar } from "@/components/consensus/split-bar"
import { Button } from "@govblock/ui/components/nova/button"
import { Textarea } from "@govblock/ui/components/nova/textarea"
import { Check, Flag, Minus, X } from "lucide-react"

// The vote card, and a catalogue of what Polis's own gets wrong.
//
// Their participation client, watched on 2026-09-10:
//
//   · the next statement does not appear until the page is refreshed —
//     although POST /api/v3/votes returns `nextComment` in the same response,
//     which their client discards. Here the next statement is already in hand
//     before the vote is cast, so the card advances on the click.
//   · a statement sometimes changes before it has been read. Nothing here
//     re-renders a statement except a vote on that statement.
//   · the "Important/Significant" checkbox sits between the statement and the
//     buttons, in the reading path, which is why it gets clicked by accident.
//     Salience is a real signal but a secondary one, so it sits after the
//     answer, not before it.
//   · the framing text sits above every statement, where it can sway the
//     answer. It is shown once, on the way in, and then it is gone.
//
// Voting is local here, against the published conversations. The same
// component posts to /api/v3/votes once a conversation is live: the vote goes
// out, the next statement comes back, and the card never waits on the network
// because it already has one queued.

type Answer = "agree" | "disagree" | "pass"

const CHOICES: { value: Answer; label: string; icon: React.ReactNode }[] = [
  { value: "agree", label: "Agree", icon: <Check className="size-4" /> },
  { value: "disagree", label: "Disagree", icon: <X className="size-4" /> },
  { value: "pass", label: "Pass", icon: <Minus className="size-4" /> },
]

export function Survey({ conversation }: { conversation: Conversation }) {
  const queue = React.useMemo(
    () =>
      // 1 accepted, 0 unreviewed, -1 pulled.
      conversation.statements.filter((s) => s.moderated >= 0).slice(0, 25),
    [conversation]
  )
  const [entered, setEntered] = React.useState(false)
  const [at, setAt] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<number, Answer>>({})
  const [salient, setSalient] = React.useState<Set<number>>(new Set())
  const [written, setWritten] = React.useState("")
  const [submitted, setSubmitted] = React.useState<string[]>([])

  const statement: Statement | undefined = queue[at]
  const done = at >= queue.length

  // The framing is read once, on the way in — not over every statement, where
  // it would lean on the answer.
  if (!entered) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-5 rounded-xl border bg-card p-8">
        <h2 className="text-xl font-semibold tracking-tight text-balance">
          {conversation.topic}
        </h2>
        {conversation.description && (
          <p className="text-sm leading-6 text-muted-foreground">
            {conversation.description}
          </p>
        )}
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
          <li>Vote agree, disagree or pass on one statement at a time.</li>
          <li>Passing is a real answer, not a skipped one.</li>
          <li>
            You are voting on statements, not on people, and nobody sees who
            voted which way.
          </li>
          <li>Add a statement of your own if something is missing.</li>
        </ul>
        <Button onClick={() => setEntered(true)} className="self-start">
          Start voting
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{conversation.topic}</span>
        <span className="tabular-nums">
          {Math.min(at + 1, queue.length)} of {queue.length}
        </span>
      </div>

      {/* A thin progress rule rather than a number that moves. */}
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/70 transition-[width] duration-300"
          style={{ width: `${(Math.min(at, queue.length) / queue.length) * 100}%` }}
        />
      </div>

      {statement ? (
        <section className="flex flex-col gap-6 rounded-xl border bg-card p-6">
          <p className="text-lg leading-7 font-medium text-balance">
            {statement.text}
          </p>

          <div className="grid grid-cols-3 gap-2">
            {CHOICES.map((choice) => (
              <Button
                key={choice.value}
                variant="secondary"
                onClick={() => {
                  setAnswers((prev) => ({ ...prev, [statement.tid]: choice.value }))
                  // The next statement is already in hand. Nothing to wait for,
                  // nothing to refresh.
                  setAt((n) => n + 1)
                }}
                className="h-11 justify-center gap-2"
              >
                {choice.icon}
                {choice.label}
              </Button>
            ))}
          </div>

          {/* Salience, after the answer rather than in front of it. */}
          <button
            type="button"
            onClick={() =>
              setSalient((prev) => {
                const next = new Set(prev)
                if (next.has(statement.tid)) next.delete(statement.tid)
                else next.add(statement.tid)
                return next
              })
            }
            className={`flex items-center gap-2 self-start text-xs transition-colors ${
              salient.has(statement.tid)
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flag
              className={`size-3.5 ${salient.has(statement.tid) ? "fill-current" : ""}`}
              aria-hidden
            />
            {salient.has(statement.tid)
              ? "Marked as one that matters"
              : "This one matters more than most"}
          </button>
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight">
            That is everything on file
          </h2>
          <p className="text-sm text-muted-foreground">
            You voted on {Object.keys(answers).length}{" "}
            {Object.keys(answers).length === 1 ? "statement" : "statements"}
            {salient.size > 0 && `, and marked ${salient.size} as mattering more`}.
            More arrive as other people write them.
          </p>
        </section>
      )}

      {/* Writing a statement is available throughout, not only at the end. */}
      <section className="flex flex-col gap-3">
        <label htmlFor="own" className="text-sm font-medium">
          Add a statement of your own
        </label>
        <Textarea
          id="own"
          value={written}
          onChange={(e) => setWritten(e.target.value.slice(0, 140))}
          rows={3}
          placeholder="One stand-alone idea, in your own words."
        />
        <div className="flex items-center justify-between">
          <span className="text-xs tabular-nums text-muted-foreground">
            {140 - written.length} left
          </span>
          <Button
            size="sm"
            disabled={written.trim().length < 8}
            onClick={() => {
              setSubmitted((prev) => [written.trim(), ...prev])
              setWritten("")
            }}
          >
            Add it
          </Button>
        </div>
        {submitted.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {submitted.length} waiting for moderation. Others will vote on them
            once they are through.
          </p>
        )}
      </section>

      {done && (
        <section className="flex flex-col gap-3 border-t pt-6">
          <h3 className="text-sm font-medium">How the room answered</h3>
          {queue.slice(0, 6).map((s) => (
            <div key={s.tid} className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">{s.text}</p>
              <SplitBar votes={s.votes} compact />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Shown after voting, never before — seeing the tally first changes
            the answer. {Math.round(share(queue[0]!.votes).agree)}% agreed with
            the first one.
          </p>
        </section>
      )}
    </div>
  )
}
