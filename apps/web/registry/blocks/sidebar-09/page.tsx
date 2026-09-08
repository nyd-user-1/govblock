"use client"

import * as React from "react"
import { ArrowLeft, Check, Copy, ExternalLink, PenSquare, Reply as ReplyIcon, RotateCcw, Star, Trash2, UserRound } from "lucide-react"

import { agent as findAgent, maxRounds } from "@/lib/agents/registry"
import { findAddress, isPerson, isUnread, loadThreads, messageId, nameOf, newThread, reply, running, runners, saveThreads, settle, shownRecipients, threadCost, when, type Folder, type Message, type Thread } from "@/lib/agents/inbox"
import { emptyRun, runAgent, type RunTurn } from "@/lib/agents/run-client"
import { FEATURED } from "@/lib/agents/featured"
import { sampleThreads } from "@/lib/agents/sample"
import { cn } from "@/lib/utils"
import { ADMIN_USER } from "@/components/admin/account-footer"
import { SaveToDrive } from "@/components/connectors/save-to-drive"
import { Prose, RunSteps } from "@/app/agents/transcript"
import { BlockShell } from "@/components/policy/block-shell"
import { InboxRail } from "@/registry/blocks/sidebar-09/components/app-sidebar"
import { Compose, EMPTY_DRAFT, type Draft } from "@/registry/blocks/sidebar-09/components/compose"
import { AttachmentGroup } from "@/registry/blocks/sidebar-09/components/attachment"
import { ThreadList, type ListTab, type Split } from "@/registry/blocks/sidebar-09/components/thread-list"
import { useLocal } from "@/lib/policy/use-local"
import { Progress } from "@govblock/ui/components/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/ny4/avatar"
import { Button } from "@govblock/ui/components/nova/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@govblock/ui/components/ny4/resizable"
import { Separator } from "@govblock/ui/components/ny4/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

// The Agentic Inbox — shadcn's sidebar-09 mail block, repurposed, and since
// 2026-09-02 laid out the way shadcn's mail example is: the icon rail, then a
// resizable row of the thread list and the reading pane, the whole thing the
// height of its frame with each pane scrolling on its own.
//
// Live chat is what /agents already is. This is its long-form sibling, and it is
// mail all the way down because half a mail metaphor reads as a broken one
// (Brendan, 2026-09-07: "you are still treating this like chat instead of like
// email"). So: you write a message and send it, and you are back at your list
// with a "Message sent" bar, not parked in the thread watching it. The sent
// message sits in Sent while the agent works; the reply lands in the Inbox as
// an unread message on the same thread, and you open it when you like. In the
// thread every message reads as mail — who it is from, who it went to, when —
// yours included, and a reply is something you ask for with the Reply button,
// which opens a composer under the last message, Gmail's way. Each reply the
// agent sends is its own message; nothing is overwritten.
//
// The hook that produces the reply is Send itself: sending to an agent marks
// the thread running (that is the flag) and dispatches one run per agent on
// the lines; each run writes its reply onto the thread as it arrives. v1 runs
// in this tab, because the store is this browser and there is no account to
// key a server-side inbox to. What makes it feel delivered anyway is Discord —
// the agent delivers the finished report into the channel under the same
// subject line, so it arrives somewhere that outlives the tab.

// Set when the inbox is cleared from its menu, so an inbox that was emptied on
// purpose stays empty instead of refilling with the placeholders. Recorded by
// the clearing itself, never by the load: a flag written during the mount
// effect ran ahead of the save, and Strict Mode's second pass of that effect
// found the flag set and the store still empty, and kept the empty (the
// inbox read "1 KB used" and nothing else, 2026-09-07).
const CLEARED = "govblock:inbox:cleared"

function monogram(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** Who a message is from, as mail shows it: your account, or the agent by its monogram. */
function Sender({ from, className }: { from: string; className?: string }) {
  if (from === "you") {
    return (
      <Avatar className={cn("size-10", className)}>
        <AvatarImage src={ADMIN_USER.avatar} alt={ADMIN_USER.name} />
        <AvatarFallback className="bg-blue-200 text-blue-600 dark:bg-blue-900 dark:text-blue-200">
          <UserRound className="size-5" />
        </AvatarFallback>
      </Avatar>
    )
  }
  return <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium", className)}>{monogram(nameOf(from))}</span>
}

/** The exchange as one agent saw it: your messages and its own replies, in turn. */
function turnsFor(thread: Thread, slug: string): RunTurn[] {
  const turns: RunTurn[] = []
  for (const message of thread.messages) {
    if (message.from !== "you" && message.from !== slug) continue
    if (!message.body.trim()) continue
    const role = message.from === "you" ? "user" : "assistant"
    const last = turns.at(-1)
    // Two of yours in a row read as one turn; the model takes them alternately.
    if (last && last.role === role) last.text = `${last.text}\n\n${message.body}`
    else turns.push({ role, text: message.body })
  }
  return turns
}

/** How many calls a run made. A Trace Report's steps also carry its prose. */
function calls(message: Message) {
  return (message.run?.steps ?? []).filter((step) => step.kind === "tool").length
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export default function Page() {
  const [threads, setThreads] = React.useState<Thread[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  const [folder, setFolder] = React.useState<Folder>("inbox")
  const [tab, setTab] = React.useState<ListTab>("all")
  const [composing, setComposing] = React.useState(false)
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT)
  const [draftId, setDraftId] = React.useState<string | null>(null)
  const [restored, setRestored] = React.useState(false)
  const [replyDraft, setReplyDraft] = React.useState<Draft>(EMPTY_DRAFT)
  // The reply composer is asked for, not always there.
  const [replying, setReplying] = React.useState(false)
  const replyRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (replying) replyRef.current?.scrollIntoView({ block: "nearest" })
  }, [replying])
  // Gmail's "Message sent" bar: the id of what just went, for a few seconds.
  const [sent, setSent] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState<string | null>(null)
  // The list alone, or the list beside the reading pane (Brendan, 2026-09-07:
  // Gmail's split toggle). Kept in this browser with the threads.
  const [split, setSplit] = useLocal<Split>("govblock:inbox:split", "vertical")
  const [, setTick] = React.useState(0)

  React.useEffect(() => {
    // An inbox that has never held anything shows the fifty placeholders
    // (Brendan, 2026-09-07); one that was cleared stays empty.
    const kept = loadThreads()
    const cleared = Boolean(window.localStorage.getItem(CLEARED))
    const base = kept.length || cleared ? kept : sampleThreads()
    // The Clerk's featured deliveries arrive in any inbox that has not been
    // cleared. They are authored, not user data, so a stored copy is refreshed
    // to its current definition on load — only the reader's own flags (starred,
    // trashed) are kept — otherwise an edit to a featured report would never
    // reach a browser that saw the old one. A cleared inbox stays cleared.
    const authored = new Map(FEATURED.map((thread) => [thread.id, thread]))
    const overlaid = base.map((thread) => {
      const fresh = authored.get(thread.id)
      return fresh ? { ...fresh, starred: thread.starred ?? fresh.starred, trashed: thread.trashed ?? fresh.trashed } : thread
    })
    const missing = cleared ? [] : FEATURED.filter((thread) => !base.some((entry) => entry.id === thread.id))
    const stored = missing.length ? [...missing, ...overlaid].sort((a, b) => b.updatedAt - a.updatedAt) : overlaid
    // A run that was in flight when the tab closed did not survive it. Say so
    // on that reply — and only that one; earlier replies on the thread stand —
    // rather than leave a spinner that will never stop.
    const lost = (message: Message) => message.from !== "you" && Boolean(message.run) && !message.run!.done
    const settled = stored.map((thread): Thread => {
      if (thread.status !== "running" && !thread.messages.some(lost)) return thread
      const messages = thread.messages.map((message) =>
        lost(message)
          ? {
              ...message,
              body: message.body + (message.body ? "\n\n" : "") + "This task was still running when the tab was closed, and tasks run in the tab. Send it again.",
              run: { ...message.run!, done: true, failed: true },
            }
          : message
      )
      const next = { ...thread, messages }
      return { ...next, status: settle(next) === "running" ? "failed" : settle(next) }
    })
    setThreads(settled)
    setRestored(true)
  }, [])

  React.useEffect(() => {
    if (restored) saveThreads(threads)
  }, [threads, restored])

  const patch = React.useCallback((id: string, change: (thread: Thread) => Thread) => {
    setThreads((current) => current.map((thread) => (thread.id === id ? change(thread) : thread)))
  }, [])

  // One agent's run on a thread, writing its reply as it goes. This is the
  // hook behind every send: the message is on the thread already, in Sent, and
  // the reply arrives on it whether or not anyone is looking.
  const dispatch = React.useCallback(
    async (threadId: string, slug: string, turns: RunTurn[], subject: string, reportType?: string) => {
      const definition = findAgent(slug)
      if (!definition) return
      const id = messageId()
      patch(threadId, (current) => reply(current, slug, emptyRun(), "running", id))
      const finished = await runAgent({
        agent: definition.slug,
        maxRounds: maxRounds(definition),
        subject,
        reportType,
        turns,
        onUpdate: (run) => patch(threadId, (current) => reply(current, slug, run, "running", id)),
      })
      patch(threadId, (current) => {
        const next = reply(current, slug, finished, "running", id)
        return { ...next, status: settle(next) }
      })
    },
    [patch]
  )

  // Sending closes the composer and leaves you where you were, with the bar
  // that says it went — mail's way, not a chat's, which would park you in the
  // thread to watch. The reply arrives in the Inbox as unread.
  const announce = React.useCallback((id: string) => {
    setSent(id)
    window.setTimeout(() => setSent((current) => (current === id ? null : current)), 6000)
  }, [])

  const send = React.useCallback(
    async (draft: Draft, existingId?: string) => {
      const everyone = [...draft.to, ...draft.cc, ...draft.bcc]
      if (!everyone.length) return
      // People are recorded on the thread; agents are the ones that run.
      const recipients = everyone.filter((slug) => !isPerson(slug))

      const thread = newThread({
        to: draft.to,
        cc: draft.cc,
        bcc: draft.bcc,
        subject: draft.subject,
        body: draft.body,
        reportType: draft.reportType,
        // Addressed only to people: it is sent, and it sits in Sent. Nothing
        // runs and nothing replies.
        status: recipients.length ? "running" : "delivered",
      })
      // Sending a draft replaces it in place, so the thread keeps its position
      // rather than appearing twice.
      setThreads((current) => [thread, ...current.filter((entry) => entry.id !== existingId)])
      if (selected === existingId) setSelected(null)
      setComposing(false)
      setDraft(EMPTY_DRAFT)
      setDraftId(null)
      announce(thread.id)

      // Every recipient runs the task — that is what Cc means here. They run
      // together; each one's reply lands on the thread as it finishes.
      const turns: RunTurn[] = [{ role: "user", text: draft.body }]
      await Promise.all(recipients.map((slug) => dispatch(thread.id, slug, turns, thread.subject, thread.reportType)))
    },
    [announce, dispatch, selected]
  )

  // A reply on an existing thread: your message joins it, and every agent on
  // the lines answers with the whole exchange, as it saw it, for context.
  const followUp = React.useCallback(
    async (thread: Thread, text: string) => {
      const at = Date.now()
      const mine: Message = { id: `${at.toString(36)}-you`, from: "you", at, body: text }
      const next: Thread = { ...thread, status: "running", updatedAt: at, messages: [...thread.messages, mine] }
      patch(thread.id, (current) => ({ ...current, status: "running", updatedAt: at, messages: [...current.messages, mine] }))
      setReplying(false)
      announce(thread.id)

      await Promise.all(runners(thread).map((slug) => dispatch(thread.id, slug, turnsFor(next, slug), thread.subject, thread.reportType)))
    },
    [announce, dispatch, patch]
  )

  const open = threads.find((thread) => thread.id === selected) ?? null

  // Opening a thread marks its reply read, the way opening a message does.
  React.useEffect(() => {
    if (!open || composing || !isUnread(open) || open.status === "running") return
    patch(open.id, (thread) => ({
      ...thread,
      messages: thread.messages.map((message) => (message.from === "you" ? message : { ...message, unread: false })),
    }))
  }, [open, composing, patch])

  // A reply addresses the whole thread, Cc and Bcc included. Opening another
  // thread puts the composer away.
  const openId = open?.id ?? null
  React.useEffect(() => {
    setReplying(false)
    if (!open) return
    setReplyDraft({ ...EMPTY_DRAFT, to: open.to ?? [], cc: open.cc ?? [], bcc: open.bcc ?? [] })
    // Only when a different thread opens; a reply that is being typed must not
    // be wiped by the thread updating underneath it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId])

  const startCompose = () => {
    setDraft(EMPTY_DRAFT)
    setDraftId(null)
    setComposing(true)
  }

  const saveDraft = () => {
    const thread = newThread({
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      reportType: draft.reportType,
      status: "draft",
    })
    setThreads((current) => [thread, ...current.filter((entry) => entry.id !== draftId)])
    setComposing(false)
    setFolder("drafts")
    setSelected(thread.id)
    setDraft(EMPTY_DRAFT)
    setDraftId(null)
  }

  const editDraft = (thread: Thread) => {
    setDraft({
      to: thread.to ?? [],
      cc: thread.cc ?? [],
      bcc: thread.bcc ?? [],
      subject: thread.subject === "(no subject)" ? "" : thread.subject,
      body: thread.messages[0]?.body ?? "",
      reportType: thread.reportType,
    })
    setDraftId(thread.id)
    setComposing(true)
  }

  // The latest finished reply is what Copy and Save to Drive act on.
  const latestReply = open ? [...open.messages].reverse().find((message) => message.from !== "you" && message.body && !message.run?.failed) : undefined

  return (
    // The shared block shell: the folders in its sidebar, the thread list and
    // the reading pane sharing the inset pane beside it.
    <BlockShell
      defaultOpen={false}
      title="Inbox"
      sidebarWidth="calc(var(--spacing) * 56)"
      contentClassName="overflow-hidden"
      rail={
        <InboxRail
          threads={threads}
          folder={folder}
          onFolder={(next) => {
            setFolder(next)
            setComposing(false)
          }}
          onCompose={startCompose}
        />
      }
    >
      {(() => {
        const list = (
          <ThreadList
            threads={threads}
            folder={folder}
            selected={selected}
            tab={tab}
            onTab={setTab}
            onOpenThread={(id) => {
              setSelected(id)
              setComposing(false)
            }}
            onStar={(id) => patch(id, (t) => ({ ...t, starred: !t.starred }))}
            onRefresh={() => setTick((n) => n + 1)}
            onMarkAllRead={() => setThreads((current) => current.map((thread) => ({ ...thread, messages: thread.messages.map((message) => (message.from === "you" ? message : { ...message, unread: false })) })))}
            onClear={() => {
              window.localStorage.setItem(CLEARED, "1")
              setThreads([])
              setSelected(null)
            }}
            split={split}
            onSplit={setSplit}
          />
        )
        // Gmail's empty reading pane: nothing chosen, how much of this
        // browser's store the threads take, and the small print at the foot.
        const bytes = new Blob([JSON.stringify(threads)]).size
        const budget = 5 * 1024 * 1024
        const latest = threads.reduce((at, thread) => Math.max(at, thread.updatedAt), 0)
        const empty = (
          <div className="flex h-full flex-col items-center px-8 py-16 text-center">
            <p className="text-lg">No conversations selected</p>
            <div className="mt-12 w-64">
              <Progress value={Math.min(100, (bytes / budget) * 100)} className="*:data-[slot=progress-track]:h-1.5" />
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                {bytes < 1024 * 100 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`} of 5 MB used in this browser
                <a href="/agents" className="text-muted-foreground hover:text-foreground" aria-label="About the agents">
                  <ExternalLink className="size-4" />
                </a>
              </p>
            </div>
            <div className="mt-auto flex flex-col items-center gap-1 pt-16 text-sm text-muted-foreground">
              <p>Last activity: {latest ? when(latest) : "none yet"}</p>
              <a href="/agents" className="hover:text-foreground">
                Details
              </a>
              <p>
                <a href="/docs" className="hover:text-foreground">
                  Terms
                </a>
                {" · "}
                <a href="/docs" className="hover:text-foreground">
                  Privacy
                </a>
                {" · "}
                <a href="/docs/api" className="hover:text-foreground">
                  Program Policies
                </a>
              </p>
            </div>
          </div>
        )
        const showList = split === "vertical" || (!open && !composing)
        const showPane = split === "vertical" || open || composing
        const back = split === "none" && (
          <Tip label="Back to the list">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Back to the list"
              onClick={() => {
                setSelected(null)
                setComposing(false)
              }}
            >
              <ArrowLeft className="size-4" />
            </Button>
          </Tip>
        )
        const justSent = sent ? threads.find((thread) => thread.id === sent) : undefined
        return (
          <div className="relative flex min-h-0 min-w-0 flex-1">
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
            {/* react-resizable-panels v4 reads bare numbers as pixels. */}
            {showList && (
              <ResizablePanel defaultSize={split === "vertical" ? 420 : 100000} minSize={320} maxSize={split === "vertical" ? 640 : undefined} className="min-w-0">
                {list}
              </ResizablePanel>
            )}
            {showList && showPane && <ResizableHandle withHandle />}
            {showPane && (
              <ResizablePanel className="min-w-0">
                <div className="flex h-full min-h-0 flex-col">
                  {composing ? (
                    <>
                      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
                        {back}
                        <span className="text-sm font-medium">New task</span>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col p-4">
                        <Compose
                          draft={draft}
                          onChange={setDraft}
                          onSend={(current) => void send(current, draftId ?? undefined)}
                          onDiscard={() => {
                            setComposing(false)
                            setDraft(EMPTY_DRAFT)
                            setDraftId(null)
                          }}
                          onSaveDraft={saveDraft}
                        />
                      </div>
                    </>
                  ) : open ? (
                    <>
                      {/* The reading pane's toolbar, as the mail example has it:
                    the actions on this thread at the left, a new task at the
                    right. */}
                      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b px-2">
                        {back}
                        <Tip label={open.starred ? "Remove star" : "Star"}>
                          <Button variant="ghost" size="sm" aria-label={open.starred ? "Remove star" : "Star"} onClick={() => patch(open.id, (t) => ({ ...t, starred: !t.starred }))}>
                            <Star className={cn("size-4", open.starred && "fill-yellow-400 text-yellow-500")} />
                          </Button>
                        </Tip>
                        <Tip label={open.trashed ? "Restore" : "Move to trash"}>
                          <Button variant="ghost" size="sm" aria-label={open.trashed ? "Restore" : "Move to trash"} onClick={() => patch(open.id, (t) => ({ ...t, trashed: !t.trashed }))}>
                            {open.trashed ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
                          </Button>
                        </Tip>
                        {latestReply && (
                          <>
                            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
                            <Tip label="Copy the report">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Copy the report"
                                onClick={() => {
                                  void navigator.clipboard?.writeText(latestReply.body)
                                  setCopied(latestReply.id)
                                  window.setTimeout(() => setCopied(null), 1500)
                                }}
                              >
                                {copied === latestReply.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                              </Button>
                            </Tip>
                            {/* Save to Drive sits beside Copy because it is the same
                          kind of act — take this reply somewhere of your own —
                          and it saves the string the reader is looking at, so
                          the document cannot differ from the report on the
                          page. */}
                            <SaveToDrive name={open.subject || "govblock report"} markdown={latestReply.body} />
                          </>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          {open.status !== "draft" && (
                            <Tip label="Reply">
                              <Button variant="ghost" size="sm" aria-label="Reply" onClick={() => setReplying(true)}>
                                <ReplyIcon className="size-4" />
                              </Button>
                            </Tip>
                          )}
                          <Tip label="New task">
                            <Button variant="ghost" size="sm" aria-label="New task" onClick={startCompose}>
                              <PenSquare className="size-4" />
                            </Button>
                          </Tip>
                        </div>
                      </div>

                      {/* The thread, Gmail's way: the subject as its title, then
                    every message as mail — who sent it, who it went to, when —
                    yours included. The agent's reply is set on a quiet ground,
                    the "this came from a model" cue. */}
                      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                        <div className="flex items-start gap-4 px-6 pt-5 pb-2">
                          <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-medium">{open.subject}</h2>
                            {open.reportType && <span className="mt-1.5 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{open.reportType}</span>}
                          </div>
                          <div className="ml-auto shrink-0 pt-1 text-right text-xs text-muted-foreground">
                            {open.trashed && <div>in trash</div>}
                            {open.deliveredTo && <div>delivered to {open.deliveredTo}</div>}
                            {threadCost(open) > 0 && (
                              <div>
                                {runners(open).length} run{runners(open).length === 1 ? "" : "s"}, ${threadCost(open).toFixed(3)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="divide-y">
                          {open.messages.map((message) => {
                            const mine = message.from === "you"
                            const name = mine ? ADMIN_USER.name : nameOf(message.from)
                            const email = mine ? ADMIN_USER.email : findAddress(message.from)?.email
                            const to = mine ? shownRecipients(open).join(", ") || open.agentName : "me"
                            return (
                              <article key={message.id} className="px-6 py-4">
                                <header className="flex items-start gap-3">
                                  <Sender from={message.from} />
                                  <div className="min-w-0 flex-1 pt-0.5">
                                    <div className="flex flex-wrap items-baseline gap-x-2">
                                      <span className="font-semibold">{name}</span>
                                      {email && <span className="text-xs text-muted-foreground">&lt;{email}&gt;</span>}
                                      {message.unread && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Unread</span>}
                                    </div>
                                    <div className="text-xs text-muted-foreground">to {to}</div>
                                  </div>
                                  <time className="shrink-0 pt-0.5 text-xs text-muted-foreground" dateTime={new Date(message.at).toISOString()}>
                                    {when(message.at)}
                                  </time>
                                </header>

                                <div className="mt-3 flex flex-col gap-3 pl-[52px]">
                                  {mine ? (
                                    <div className="text-sm whitespace-pre-wrap">
                                      <Prose text={message.body} />
                                    </div>
                                  ) : (
                                    message.body && (
                                      <div className="rounded-lg bg-muted/60 p-4">
                                        <div className={cn("text-sm whitespace-pre-wrap", message.run?.failed && "text-destructive")}>
                                          <Prose text={message.body} />
                                        </div>
                                      </div>
                                    )
                                  )}

                                  {message.run && !message.run.done && (
                                    // The reading pane's own sign of life, under whatever has
                                    // arrived so far. It names the tool in flight rather than
                                    // saying "working", so a long gather reads as progress
                                    // instead of as a hang.
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-primary" />
                                      <span className="animate-pulse">{running(open)}</span>
                                    </div>
                                  )}

                                  {calls(message) > 0 && (
                                    <details className="rounded-lg border p-3">
                                      <summary className="cursor-pointer text-sm text-muted-foreground">
                                        {calls(message)} tool call
                                        {calls(message) === 1 ? "" : "s"}
                                        {message.run!.done ? "" : " so far"}
                                      </summary>
                                      <div className="pt-3">
                                        <RunSteps steps={message.run!.steps} />
                                      </div>
                                    </details>
                                  )}

                                  {message.attachments?.length ? <AttachmentGroup items={message.attachments} /> : null}
                                </div>
                              </article>
                            )
                          })}
                        </div>

                        {/* Under the last message, where Gmail keeps them: Reply, or
                      the composer once it has been asked for. */}
                        <div className="px-6 pt-2 pb-6 pl-[76px]">
                          {open.status === "draft" ? (
                            <Button size="sm" onClick={() => editDraft(open)}>
                              Edit draft
                            </Button>
                          ) : replying ? (
                            <div ref={replyRef} className="flex flex-col gap-3 rounded-lg border p-4">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ReplyIcon className="size-4" />
                                <span>{shownRecipients(open).join(", ") || open.agentName}</span>
                              </div>
                              <Compose
                                inline
                                placeholder=""
                                draft={replyDraft}
                                onChange={setReplyDraft}
                                onSend={(current) => {
                                  const text = current.body
                                  setReplyDraft({ ...current, body: "" })
                                  void followUp(open, text)
                                }}
                                onDiscard={() => {
                                  setReplying(false)
                                  setReplyDraft((current) => ({ ...current, body: "" }))
                                }}
                              />
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setReplying(true)}>
                              <ReplyIcon className="size-4" />
                              Reply
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    empty
                  )}
                </div>
              </ResizablePanel>
            )}
          </ResizablePanelGroup>
          {justSent && (
            // Gmail's bar: dark, bottom left, gone in a few seconds. "View"
            // opens the thread in Sent, where it is.
            <div role="status" className="absolute bottom-4 left-4 z-20 flex items-center gap-4 rounded-md bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
              <span>Message sent</span>
              <button
                type="button"
                className="font-medium text-background/80 hover:text-background"
                onClick={() => {
                  setFolder("sent")
                  setSelected(justSent.id)
                  setComposing(false)
                  setSent(null)
                }}
              >
                View
              </button>
            </div>
          )}
          </div>
        )
      })()}
    </BlockShell>
  )
}
