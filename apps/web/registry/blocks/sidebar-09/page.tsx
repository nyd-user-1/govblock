"use client"

import * as React from "react"
import { Check, Copy, PenSquare, RotateCcw, Star, Trash2 } from "lucide-react"

import { agent as findAgent, maxRounds } from "@/lib/agents/registry"
import {
  isPerson,
  isUnread,
  loadThreads,
  nameOf,
  newThread,
  reply,
  running,
  runners,
  saveThreads,
  settle,
  shownRecipients,
  threadCost,
  when,
  type Folder,
  type Thread,
} from "@/lib/agents/inbox"
import { emptyRun, runAgent } from "@/lib/agents/run-client"
import { cn } from "@/lib/utils"
import { SaveToDrive } from "@/components/connectors/save-to-drive"
import { Prose, RunSteps } from "@/app/agents/transcript"
import { AppSidebar } from "@/registry/blocks/sidebar-09/components/app-sidebar"
import { Compose, EMPTY_DRAFT, type Draft } from "@/registry/blocks/sidebar-09/components/compose"
import { ThreadList, type ListTab } from "@/registry/blocks/sidebar-09/components/thread-list"
import { Button } from "@govblock/ui/components/nova/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@govblock/ui/components/ny4/resizable"
import { Separator } from "@govblock/ui/components/ny4/separator"
import { SidebarProvider } from "@govblock/ui/components/ny4/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

// The Agentic Inbox — shadcn's sidebar-09 mail block, repurposed, and since
// 2026-09-02 laid out the way shadcn's mail example is: the icon rail, then a
// resizable row of the thread list and the reading pane, the whole thing the
// height of its frame with each pane scrolling on its own. The reply box is
// pinned to the bottom of the reading pane with Send at its bottom left and
// the formatting row beside it, which is where Gmail keeps them.
//
// Live chat is what /agents already is. This is its long-form sibling, and it is
// mail all the way down because half a mail metaphor reads as a broken one: what
// you send is in Sent the moment you send it, the report arrives as an unread
// reply on the same thread, and stars, drafts and an undoable trash are what a
// reader already knows how to use.
//
// v1 runs the task in this tab. Threads are kept in this browser, and the
// surface says so rather than letting anyone assume a server is holding them.
// What makes it feel delivered anyway is Discord — the agent delivers the
// finished report into the channel under the same subject line, so it arrives
// somewhere that outlives the tab.

function monogram(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
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
  const [copied, setCopied] = React.useState<string | null>(null)

  React.useEffect(() => {
    const stored = loadThreads()
    // A task that was running when the tab closed did not survive it. Say so
    // rather than leave a spinner that will never stop.
    const settled = stored.map((thread): Thread =>
      thread.status === "running"
        ? {
            ...thread,
            status: "failed",
            messages: thread.messages.map((message) =>
              message.from === "you"
                ? message
                : {
                    ...message,
                    body:
                      message.body +
                      (message.body ? "\n\n" : "") +
                      "This task was still running when the tab was closed, and tasks run in the tab. Send it again.",
                  }
            ),
          }
        : thread
    )
    setThreads(settled)
    setRestored(true)
  }, [])

  React.useEffect(() => {
    if (restored) saveThreads(threads)
  }, [threads, restored])

  const patch = React.useCallback((id: string, change: (thread: Thread) => Thread) => {
    setThreads((current) => current.map((thread) => (thread.id === id ? change(thread) : thread)))
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
        status: "running",
      })
      // Sending a draft replaces it in place, so the thread keeps its position
      // rather than appearing twice.
      setThreads((current) => [thread, ...current.filter((entry) => entry.id !== existingId)])
      setSelected(thread.id)
      setFolder("sent")
      if (!recipients.length) {
        // Addressed only to people: it is sent, and it sits in Sent. Nothing
        // runs and nothing replies, which is what the compose line said.
        patch(thread.id, (current) => ({ ...current, status: "delivered" }))
        setComposing(false)
        setDraft(EMPTY_DRAFT)
        setDraftId(null)
        return
      }
      setComposing(false)
      setDraft(EMPTY_DRAFT)
      setDraftId(null)

      // Every recipient runs the task — that is what Cc means here, and it is
      // why the composer says n recipients is n runs before you send. They run
      // together; each one's reply lands on the thread as it finishes.
      await Promise.all(
        recipients.map(async (slug) => {
          const definition = findAgent(slug)
          if (!definition) return
          patch(thread.id, (current) => reply(current, slug, emptyRun(), "running"))
          const finished = await runAgent({
            agent: definition.slug,
            maxRounds: maxRounds(definition),
            subject: thread.subject,
            turns: [{ role: "user", text: draft.body }],
            onUpdate: (run) => patch(thread.id, (current) => reply(current, slug, run, "running")),
          })
          patch(thread.id, (current) => {
            const next = reply(current, slug, finished, "running")
            return { ...next, status: settle(next) }
          })
        })
      )
      setFolder("inbox")
    },
    [patch]
  )

  // A reply on an existing thread: same agents, the whole exchange as context.
  const followUp = React.useCallback(
    async (thread: Thread, text: string) => {
      const at = Date.now()
      patch(thread.id, (current) => ({
        ...current,
        status: "running",
        updatedAt: at,
        messages: [
          ...current.messages,
          { id: `${at.toString(36)}-you`, from: "you" as const, at, body: text },
        ],
      }))

      await Promise.all(
        runners(thread).map(async (slug) => {
          const definition = findAgent(slug)
          if (!definition) return
          const prior = thread.messages.find((message) => message.from === slug)
          const finished = await runAgent({
            agent: definition.slug,
            maxRounds: maxRounds(definition),
            subject: thread.subject,
            turns: [
              { role: "user", text: thread.messages[0]?.body ?? "" },
              ...(prior?.body ? [{ role: "assistant" as const, text: prior.body }] : []),
              { role: "user", text },
            ],
            onUpdate: (run) => patch(thread.id, (current) => reply(current, slug, run, "running")),
          })
          patch(thread.id, (current) => {
            const next = reply(current, slug, finished, "running")
            return { ...next, status: settle(next) }
          })
        })
      )
    },
    [patch]
  )

  const open = threads.find((thread) => thread.id === selected) ?? null

  // Opening a thread marks its reply read, the way opening a message does.
  React.useEffect(() => {
    if (!open || composing || !isUnread(open) || open.status === "running") return
    patch(open.id, (thread) => ({
      ...thread,
      messages: thread.messages.map((message) =>
        message.from === "you" ? message : { ...message, unread: false }
      ),
    }))
  }, [open, composing, patch])

  // The reply box addresses the whole thread, Cc and Bcc included — so its
  // cost line counts them, or it promises one run and bills for three.
  const openId = open?.id ?? null
  React.useEffect(() => {
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
    })
    setDraftId(thread.id)
    setComposing(true)
  }

  // The latest finished reply is what Copy and Save to Drive act on.
  const latestReply = open
    ? [...open.messages].reverse().find((message) => message.from !== "you" && message.body && !message.run?.failed)
    : undefined

  return (
    <SidebarProvider
      className="h-svh min-h-0 overflow-hidden"
      style={{ "--sidebar-width": "350px" } as React.CSSProperties}
    >
      <AppSidebar
        threads={threads}
        folder={folder}
        onFolder={(next) => {
          setFolder(next)
          setComposing(false)
        }}
        onCompose={startCompose}
        onClear={() => {
          setThreads([])
          setSelected(null)
        }}
      />

      <ResizablePanelGroup orientation="horizontal" className="min-w-0 flex-1">
        {/* react-resizable-panels v4 reads bare numbers as pixels. */}
        <ResizablePanel defaultSize={420} minSize={320} maxSize={640} className="min-w-0">
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
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel className="min-w-0">
          <div className="flex h-full min-h-0 flex-col">
            {composing ? (
              <>
                <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
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
                  <Tip label={open.starred ? "Remove star" : "Star"}>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={open.starred ? "Remove star" : "Star"}
                      onClick={() => patch(open.id, (t) => ({ ...t, starred: !t.starred }))}
                    >
                      <Star className={cn("size-4", open.starred && "fill-yellow-400 text-yellow-500")} />
                    </Button>
                  </Tip>
                  <Tip label={open.trashed ? "Restore" : "Move to trash"}>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={open.trashed ? "Restore" : "Move to trash"}
                      onClick={() => patch(open.id, (t) => ({ ...t, trashed: !t.trashed }))}
                    >
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
                    <Tip label="New task">
                      <Button variant="ghost" size="sm" aria-label="New task" onClick={startCompose}>
                        <PenSquare className="size-4" />
                      </Button>
                    </Tip>
                  </div>
                </div>

                <div className="flex shrink-0 items-start gap-4 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {monogram(open.agentName)}
                  </span>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <div className="truncate font-semibold">
                      {open.agentName}
                      {runners(open).length > 1 && (
                        <span className="font-normal text-muted-foreground"> +{runners(open).length - 1}</span>
                      )}
                    </div>
                    <div className="line-clamp-1 text-xs">{open.subject}</div>
                    <div className="line-clamp-1 text-xs">
                      <span className="font-medium">To:</span> {shownRecipients(open).join(", ") || open.agentName}
                    </div>
                  </div>
                  <div className="ml-auto shrink-0 text-right text-xs text-muted-foreground">
                    <div>{when(open.createdAt)}</div>
                    {open.trashed && <div>in trash</div>}
                    {open.deliveredTo && <div>delivered to {open.deliveredTo}</div>}
                    {threadCost(open) > 0 && (
                      <div>
                        {runners(open).length} run{runners(open).length === 1 ? "" : "s"}, ${threadCost(open).toFixed(3)}
                      </div>
                    )}
                  </div>
                </div>
                <Separator />

                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
                  {open.messages.map((message) =>
                    message.from === "you" ? (
                      <div key={message.id} className="rounded-lg border p-4 text-sm whitespace-pre-wrap">
                        <Prose text={message.body} />
                      </div>
                    ) : (
                      <section key={message.id} className="group relative flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {monogram(nameOf(message.from))}
                          </span>
                          <span>{nameOf(message.from)}</span>
                          {message.unread && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Unread</span>
                          )}
                        </div>

                        {message.body && (
                          // The muted field is the "this came from a model" cue.
                          <div className="relative rounded-lg bg-muted/60 p-4">
                            <div className={cn("text-sm whitespace-pre-wrap", message.run?.failed && "text-destructive")}>
                              <Prose text={message.body} />
                            </div>
                          </div>
                        )}

                        {(message.run?.steps.length ?? 0) > 0 && (
                          <details className="rounded-lg border p-3">
                            <summary className="cursor-pointer text-sm text-muted-foreground">
                              {message.run!.steps.length} tool call
                              {message.run!.steps.length === 1 ? "" : "s"}
                              {message.run!.done ? "" : " so far"}
                            </summary>
                            <div className="pt-3">
                              <RunSteps steps={message.run!.steps} />
                            </div>
                          </details>
                        )}
                      </section>
                    )
                  )}

                  {open.status === "running" && (
                    // The reading pane's own sign of life. It names the tool in
                    // flight rather than saying "working", so a long gather
                    // reads as progress instead of as a hang.
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-primary" />
                      <span className="animate-pulse">{running(open)}</span>
                    </div>
                  )}
                </div>

                <Separator />
                <div className="shrink-0 p-4">
                  {open.status === "draft" ? (
                    <Button size="sm" onClick={() => editDraft(open)}>
                      Edit draft
                    </Button>
                  ) : open.status === "running" ? (
                    <p className="text-xs text-muted-foreground">
                      Running. The reply lands on this thread; you can write back once it does.
                    </p>
                  ) : (
                    // Pinned to the bottom of the pane, the way every mail
                    // client does it — a reply is part of the conversation,
                    // not a page. Send at the bottom left, formatting beside it.
                    <Compose
                      inline
                      placeholder={`Reply ${open.agentName}…`}
                      draft={replyDraft}
                      onChange={setReplyDraft}
                      onSend={(current) => {
                        const text = current.body
                        setReplyDraft({ ...current, body: "" })
                        void followUp(open, text)
                      }}
                      onDiscard={() => setReplyDraft((current) => ({ ...current, body: "" }))}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <h1 className="text-lg font-semibold tracking-tight">Agentic Inbox</h1>
                <p className="max-w-md text-sm text-muted-foreground">
                  Longer work than a chat. Compose a task to one of the five agents, and its finished
                  report arrives as a reply on the same thread, with the run it did underneath. The
                  Researcher writes a sourced report over the record; the Tracker watches a topic and
                  posts a digest; the other three answer in one message.
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Threads are kept in this browser and nowhere else, and a task runs while this tab is
                  open. What outlives the tab is the report the agent delivers to Discord, under the
                  same subject line.
                </p>
                <Button size="sm" onClick={startCompose}>
                  <PenSquare className="size-4" /> Compose
                </Button>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  )
}
