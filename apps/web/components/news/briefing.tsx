"use client"

import * as React from "react"

import { stateName } from "@/lib/filters"
import { fmtDate } from "@/lib/format"
import {
  briefingOnly,
  runAgent,
  type RunState,
  type Source,
} from "@/lib/agents/run-client"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { NewsBrief } from "@/lib/policy/news"
import { StreamingResponse } from "@/components/agents/streaming-response"
import { SearchDirectory } from "@/components/directory-search"
import { FlagChip } from "@/components/policy/imagery"
import { NotebookPen } from "@govblock/ui/components/animate-ui/icons/notebook-pen"
import { AnimateIcon } from "@govblock/ui/components/animate-ui/icons/icon"
import { Button } from "@govblock/ui/components/nova/button"
import { Separator } from "@govblock/ui/components/nova/separator"

// /briefing, on daily.dev's Presidential Briefings (Brendan, 2026-09-09).
//
// The joke there is that an agent read the entire internet. Here it reads
// something narrower and far better: this jurisdiction's whole record for the
// week — bills and their actions, roll calls, hearings and agendas,
// committees, members — and the press on all of it. One desk at a time, on
// purpose; fifty-two of them in one search is a worse answer, not a bigger one.
//
// The Reporter runs in the browser through the same loop every agent on
// /agents runs (lib/agents/run-client.ts), a round per request, so its reading
// arrives as it happens rather than after a silent minute. What it writes
// streams into the response surface; what it opened becomes the sources under
// it. When the run ends the briefing is filed, and from then on the desk's
// briefings are cards in the rail.
//
// The state is shared between the body and the rail, so it lives in one
// context around both rather than being fetched twice.

const MAX_ROUNDS = 18

/** A phrase brief is scoped "NY:open-primaries"; a daily one is just "NY". */
const isPhrase = (brief: NewsBrief) => brief.scope.includes(":")

/** The phrase a brief was written on, or nothing for the day's briefing. */
function briefPhrase(brief: NewsBrief) {
  return isPhrase(brief) ? (brief.title?.trim() ?? "") : ""
}

/** How many records the briefing rests on, for the card's second line. */
const sourceCount = (brief: NewsBrief) =>
  brief.grounding.find((g) => g.field === "content")?.citations?.length ?? 0

const sourcesOf = (brief: NewsBrief): Source[] =>
  (brief.grounding.find((g) => g.field === "content")?.citations ?? []).map(
    (c) => ({
      id: c.url,
      title: c.title,
      url: c.url,
      domain: /^https?:/.test(c.url)
        ? new URL(c.url).hostname.replace(/^www\./, "")
        : "the record",
    })
  )

/**
 * A briefing as it reads: a lede, then the bullets. The same shape whether it
 * is arriving a word at a time or was filed days ago, so nothing shifts when
 * the run ends.
 */
function BriefBody({ text }: { text: string }) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const blocks: React.ReactNode[] = []
  let bullets: string[] = []
  const flush = (key: string) => {
    if (!bullets.length) return
    blocks.push(
      <ul key={key}>
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    )
    bullets = []
  }
  lines.forEach((line, i) => {
    if (/^[•\-*]\s/.test(line)) bullets.push(line.replace(/^[•\-*]\s+/, ""))
    else {
      flush(`u${i}`)
      blocks.push(<p key={`p${i}`}>{line}</p>)
    }
  })
  flush("u-last")
  return <>{blocks}</>
}

type Reply = {
  briefs?: NewsBrief[]
  phrases?: NewsBrief[]
  brief?: NewsBrief | null
  error?: string
}

type Deployment = {
  /** The phrase, or "" for the desk's own week. */
  phrase: string
  run: RunState
}

type Briefing = {
  state: string
  desk: string
  resolved: boolean
  filed: NewsBrief[]
  /** Every briefing on the desk, newest first: the daily ones and the phrases. */
  archive: NewsBrief[]
  open: NewsBrief | null
  setOpen: (brief: NewsBrief | null) => void
  today: NewsBrief | null
  live: Deployment | null
  deploy: (phrase?: string) => void
  note: string | null
}

const Context = React.createContext<Briefing | null>(null)
const useBriefing = () => {
  const value = React.useContext(Context)
  if (!value) throw new Error("BriefingProvider is missing")
  return value
}

export function BriefingProvider({ children }: { children: React.ReactNode }) {
  const { state, resolved } = useJurisdiction()
  const [briefs, setBriefs] = React.useState<NewsBrief[]>([])
  const [filed, setFiled] = React.useState<NewsBrief[]>([])
  const [open, setOpen] = React.useState<NewsBrief | null>(null)
  const [live, setLive] = React.useState<Deployment | null>(null)
  const [note, setNote] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!resolved) return
    let alive = true
    setBriefs([])
    setFiled([])
    setOpen(null)
    setLive(null)
    setNote(null)
    fetch(`/api/news/brief?state=${state}`)
      .then((r) => r.json() as Promise<Reply>)
      .then((r) => {
        if (!alive) return
        const briefs = r.briefs ?? []
        setBriefs(briefs)
        setFiled(r.phrases ?? [])
        // Nothing written today does not mean nothing to read: the most
        // recent briefing opens, so the desk is never a blank page with a
        // button on it.
        const day = new Date().toISOString().slice(0, 10)
        if (!briefs.some((b) => b.completed_at.slice(0, 10) === day))
          setOpen(briefs[0] ?? null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [state, resolved])

  const day = new Date().toISOString().slice(0, 10)
  const today =
    briefs.find((b) => b.completed_at.slice(0, 10) === day) ?? null

  const deploy = React.useCallback(
    (phrase = "") => {
      if (live && !live.run.done && !live.run.failed) return
      const desk = stateName(state)
      const term = phrase.trim()
      const already = term
        ? filed.find(
            (b) => briefPhrase(b).toLowerCase() === term.toLowerCase()
          )
        : today
      // A briefing filed today is the briefing; the agent is not deployed twice.
      if (already) {
        setOpen(already)
        setLive(null)
        return
      }
      setNote(null)
      setOpen(null)
      const text = term
        ? `Write the briefing on "${term}" for the ${desk} desk. Read the record for what it says about "${term}" — bills and their actions, roll calls, hearings, committees, the members behind it — and the press on it, then write.`
        : `Write this week's briefing for the ${desk} desk. Read the record — what was introduced, what moved, how the chamber voted, what was heard, who sponsored and who broke ranks — and the press on all of it, then write.`

      runAgent({
        agent: "reporter",
        jurisdiction: state,
        turns: [{ role: "user", text }],
        maxRounds: MAX_ROUNDS,
        onUpdate: (run) => setLive({ phrase: term, run }),
      })
        .then(async (run) => {
          setLive({ phrase: term, run })
          // What it wrote at the end, not what it said to itself along the way.
          const written = briefingOnly(run.answer || run.text)
          if (run.failed || written.length < 40) {
            setNote(
              run.failed
                ? "The Reporter could not finish the briefing."
                : "The Reporter came back with nothing to file."
            )
            return
          }
          const reply = (await (
            await fetch("/api/news/brief", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                state,
                phrase: term || undefined,
                content: written,
                sources: run.sources,
                model: run.model,
                usd: run.usd,
              }),
            })
          ).json()) as Reply
          if (!reply.brief) return
          if (term)
            setFiled((prev) => [
              reply.brief!,
              ...prev.filter((b) => b.scope !== reply.brief!.scope),
            ])
          else
            setBriefs((prev) => [
              reply.brief!,
              ...prev.filter((b) => b.id !== reply.brief!.id),
            ])
        })
        .catch(() => setNote("The Reporter could not be reached."))
    },
    [filed, live, state, today]
  )

  // The day's briefing is the hero; everything else — earlier days and every
  // phrase — is reachable from the rail.
  const archive = [...briefs, ...filed]
    .filter((b) => b.id !== today?.id)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at))

  const value: Briefing = {
    state,
    desk: resolved ? stateName(state) : "",
    resolved,
    filed,
    archive,
    open,
    setOpen,
    today,
    live,
    deploy,
    note,
  }
  return <Context.Provider value={value}>{children}</Context.Provider>
}

/** One briefing, filed or arriving, with what it was read out of beneath it. */
function Briefing({
  heading,
  byline,
  text,
  sources,
  streaming,
}: {
  heading: React.ReactNode
  byline: string
  text: string
  sources: Source[]
  streaming: boolean
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        {heading}
      </h2>
      <p className="text-sm text-muted-foreground">{byline}</p>
      <StreamingResponse
        status={streaming ? "streaming" : "complete"}
        sources={sources}
        showActions={false}
        contentClassName="typeset text-base"
      >
        <BriefBody text={text} />
      </StreamingResponse>
    </section>
  )
}

export function BriefingPanel() {
  const { state, desk, resolved, open, today, live, deploy, note, archive } =
    useBriefing()
  const [query, setQuery] = React.useState("")
  const term = query.trim()

  const running = Boolean(live && !live.run.done && !live.run.failed)

  return (
    <div data-not-typeset="true" className="flex flex-col gap-10">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (term) deploy(term)
        }}
      >
        <SearchDirectory
          query={query}
          setQuery={(value) => setQuery(value ?? "")}
          // The shell is prerendered once for every reader, so it cannot name
          // a jurisdiction until it knows which one was asked for.
          placeholder={
            resolved
              ? `Brief the ${desk} desk on a phrase…`
              : "Brief the desk on a phrase…"
          }
        />
      </form>

      {live && (
        <Briefing
          heading={
            <>
              <FlagChip state={state} width={28} />
              {live.phrase || desk}
              {live.phrase && (
                <span className="font-normal text-muted-foreground">
                  · {desk}
                </span>
              )}
            </>
          }
          byline={
            running
              ? `Reading the ${desk} desk — ${live.run.steps.length} ${live.run.steps.length === 1 ? "call" : "calls"} so far`
              : "By AI Reporter"
          }
          text={briefingOnly(live.run.answer || live.run.text)}
          sources={live.run.sources}
          streaming={running}
        />
      )}

      {note && <p className="text-sm text-muted-foreground">{note}</p>}

      {!live && !open && !today && (
        <p className="text-sm text-muted-foreground">
          No briefing on the {desk} desk yet. Send the Reporter at the week from
          the rail, or name a phrase above.
        </p>
      )}

      {open && (!live || live.phrase !== briefPhrase(open)) && (
        <>
          {live && <Separator />}
          <Briefing
            heading={
              <>
                <FlagChip state={open.scope.split(":")[0] ?? state} width={28} />
                {isPhrase(open) ? briefPhrase(open) : desk}
                <span className="font-normal text-muted-foreground">
                  · {isPhrase(open) ? desk : fmtDate(open.completed_at)}
                </span>
              </>
            }
            byline={
              open.author === "wire"
                ? "From the wire — the press only, until the Reporter reads the record"
                : "By AI Reporter"
            }
            text={open.content}
            sources={sourcesOf(open)}
            streaming={false}
          />
        </>
      )}

      {today && (
        <>
          {(live || open) && <Separator />}
          <Briefing
            heading={
              <>
                <FlagChip state={state} width={28} />
                {desk}, {fmtDate(today.completed_at)}
              </>
            }
            byline={
              today.author === "wire"
                ? "From the wire — the press only, until the Reporter reads the record"
                : "By AI Reporter"
            }
            text={today.content}
            sources={sourcesOf(today)}
            streaming={false}
          />
        </>
      )}

    </div>
  )
}

/**
 * The rail: the Reporter, and every briefing on the desk.
 *
 * The card that sends the agent at the week lives here rather than in the
 * middle of the page (Brendan, 2026-09-10, briefing-1.html) — the briefing is
 * the page's content, and the button that writes one is furniture.
 */
export function BriefingRail() {
  const { state, desk, archive, today, open, setOpen, deploy, live } =
    useBriefing()
  const running = Boolean(live && !live.run.done && !live.run.failed)
  const cards = [today, ...archive].filter(Boolean) as NewsBrief[]
  // Two cards, always. A desk with one briefing on file still reads as a desk;
  // an empty column reads as a broken page. The empty one sends the Reporter.
  const blanks = Math.max(0, 2 - cards.length)

  return (
    <div className="flex flex-col gap-4">
      <AnimateIcon animateOnHover asChild>
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <NotebookPen className="size-4" aria-hidden />
            AI Reporter
          </span>
          <p className="text-xs text-muted-foreground">
            A summary of the past week.
          </p>
          <Button
            size="sm"
            onClick={() => deploy()}
            disabled={running}
            className="self-start"
          >
            {running ? "Reading…" : "Read Briefing"}
          </Button>
        </section>
      </AnimateIcon>

      {cards.map((brief) => {
        const phrase = briefPhrase(brief)
        const active = open?.id === brief.id
        return (
          <button
            key={brief.id}
            type="button"
            onClick={() => setOpen(brief)}
            className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${
              active ? "bg-accent/50" : "bg-card hover:bg-accent/30"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <FlagChip state={brief.scope.split(":")[0] ?? state} width={22} />
              <span className="truncate">
                {phrase || `${desk}, ${fmtDate(brief.completed_at)}`}
              </span>
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {fmtDate(brief.completed_at)} · {sourceCount(brief)} sources
            </span>
          </button>
        )
      })}

      {Array.from({ length: blanks }, (_, i) => (
        <button
          key={`blank-${i}`}
          type="button"
          onClick={() => deploy()}
          disabled={running}
          className="flex flex-col gap-2 rounded-xl border border-dashed p-4 text-left transition-colors hover:bg-accent/30 disabled:opacity-60"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FlagChip state={state} width={22} />
            <span className="truncate">{desk}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {running ? "Reading the desk…" : "Not written yet — send the Reporter"}
          </span>
        </button>
      ))}
    </div>
  )
}
