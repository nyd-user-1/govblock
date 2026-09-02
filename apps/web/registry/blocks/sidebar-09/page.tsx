"use client"

import * as React from "react"
import { Check, Copy, Reply, RotateCcw, Star, Trash2 } from "lucide-react"

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
import { Prose, RunMeta, RunSteps } from "@/app/agents/transcript"
import { AppSidebar } from "@/registry/blocks/sidebar-09/components/app-sidebar"
import { Compose, EMPTY_DRAFT, type Draft } from "@/registry/blocks/sidebar-09/components/compose"
import { Button } from "@govblock/ui/components/nova/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@govblock/ui/components/ny4/breadcrumb"
import { Separator } from "@govblock/ui/components/ny4/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@govblock/ui/components/ny4/sidebar"

// The Agentic Inbox — shadcn's sidebar-09 mail block, repurposed.
//
// Live chat is what /agents already is. This is its long-form sibling, and it is
// mail all the way down because half a mail metaphor reads as a broken one: what
// you send is in Sent the moment you send it, the report arrives as an unread
// reply on the same thread, and stars, drafts and an undoable trash are what a
// reader already knows how to use.
//
// v1 runs the task in this tab. That is the honest shape for a public site with
// no accounts: threads are kept in this browser, and the surface says so rather
// than letting anyone assume a server is holding them. What makes it feel
// delivered anyway is Discord — the agent delivers the finished report into the
// channel under the same subject line, so it arrives somewhere that outlives the
// tab.

export default function Page() {
  const [threads, setThreads] = React.useState<Thread[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  const [folder, setFolder] = React.useState<Folder>("inbox")
  const [composing, setComposing] = React.useState(false)
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT)
  const [draftId, setDraftId] = React.useState<string | null>(null)
  const [restored, setRestored] = React.useState(false)
  const [replying, setReplying] = React.useState(false)
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

  return (
    <SidebarProvider style={{ "--sidebar-width": "350px" } as React.CSSProperties}>
      <AppSidebar
        threads={threads}
        selected={selected}
        folder={folder}
        onFolder={(next) => {
          setFolder(next)
          setComposing(false)
        }}
        onOpenThread={(id) => {
          setSelected(id)
          setComposing(false)
          setReplying(false)
        }}
        onCompose={startCompose}
        onClear={() => {
          setThreads([])
          setSelected(null)
        }}
      />
      <SidebarInset>
        <header className="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/agents">Agentic Inbox</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {composing ? "New task" : (open?.subject ?? "Inbox")}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-1">
            {open && !composing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={open.starred ? "Remove star" : "Star"}
                  onClick={() => patch(open.id, (t) => ({ ...t, starred: !t.starred }))}
                >
                  <Star className={cn("size-4", open.starred && "fill-yellow-400 text-yellow-500")} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={open.trashed ? "Restore" : "Move to trash"}
                  onClick={() => patch(open.id, (t) => ({ ...t, trashed: !t.trashed }))}
                >
                  {open.trashed ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
                </Button>
              </>
            )}
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {composing ? (
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
          ) : open ? (
            <article className="flex w-full flex-1 flex-col gap-5">
              <header className="flex flex-col gap-1">
                <h1 className="text-lg font-semibold tracking-tight">{open.subject}</h1>
                <p className="text-sm text-muted-foreground">
                  To {shownRecipients(open).join(", ") || open.agentName} · {when(open.createdAt)}
                  {open.trashed && " · in trash"}
                  {open.deliveredTo && ` · delivered to ${open.deliveredTo}`}
                  {threadCost(open) > 0 &&
                    ` · ${runners(open).length} run${runners(open).length === 1 ? "" : "s"}, $${threadCost(open).toFixed(3)}`}
                </p>
              </header>

              {open.messages.map((message) =>
                message.from === "you" ? (
                  <div
                    key={message.id}
                    className="rounded-lg border p-4 text-sm whitespace-pre-wrap"
                  >
                    <Prose text={message.body} />
                  </div>
                ) : (
                  <section key={message.id} className="group relative flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {nameOf(message.from)
                          .split(/\s+/)
                          .map((word) => word[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <span>{nameOf(message.from)}</span>
                      {message.unread && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          Unread
                        </span>
                      )}
                    </div>

                    {message.body && (
                      // The muted field is the "this came from a model" cue,
                      // and the copy affordance is the one every chat output
                      // has: present on hover, out of the way otherwise.
                      <div className="relative rounded-lg bg-muted/60 p-4">
                        {/* Save to Drive sits beside Copy because it is the
                            same kind of act — take this reply somewhere of
                            your own — and it saves the string the reader is
                            looking at, so the document cannot differ from the
                            report on the page. */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          {!message.run?.failed && (
                            <SaveToDrive
                              name={open.subject || "govblock report"}
                              markdown={message.body}
                            />
                          )}
                        <button
                          type="button"
                          aria-label="Copy this reply"
                          onClick={() => {
                            void navigator.clipboard?.writeText(message.body)
                            setCopied(message.id)
                            window.setTimeout(() => setCopied(null), 1500)
                          }}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
                        >
                          {copied === message.id ? (
                            <Check className="size-4" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </button>
                        </div>
                        <div
                          className={cn(
                            "text-sm whitespace-pre-wrap",
                            message.run?.failed && "text-destructive"
                          )}
                        >
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

                    {message.run && <RunMeta run={message.run} />}
                  </section>
                )
              )}

              {open.status === "running" && (
                // The reading pane's own sign of life. It names the tool in
                // flight rather than saying "working", so a long gather reads
                // as progress instead of as a hang.
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 animate-pulse rounded-full bg-primary"
                  />
                  <span className="animate-pulse">{running(open)}</span>
                </div>
              )}

              {open.status === "draft" ? (
                <div>
                  <Button size="sm" onClick={() => editDraft(open)}>
                    Edit draft
                  </Button>
                </div>
              ) : replying ? (
                // Inline at the bottom of the thread, the way every mail client
                // does it — a reply is part of the conversation, not a page.
                <div className="rounded-lg border p-4">
                  <Compose
                    inline
                    draft={replyDraft}
                    onChange={setReplyDraft}
                    onSend={(current) => {
                      const text = current.body
                      setReplying(false)
                      setReplyDraft(EMPTY_DRAFT)
                      void followUp(open, text)
                    }}
                    onDiscard={() => {
                      setReplying(false)
                      setReplyDraft(EMPTY_DRAFT)
                    }}
                  />
                </div>
              ) : (
                open.status !== "running" && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // The whole thread replies, Cc and Bcc included — so
                        // the reply's cost line has to count them, or it
                        // promises one run and bills for three.
                        setReplyDraft({
                          ...EMPTY_DRAFT,
                          to: open.to ?? [],
                          cc: open.cc ?? [],
                          bcc: open.bcc ?? [],
                        })
                        setReplying(true)
                      }}
                    >
                      <Reply className="size-4" /> Reply
                    </Button>
                  </div>
                )
              )}
            </article>
          ) : (
            <div className="flex w-full max-w-2xl flex-col gap-3">
              <h1 className="text-lg font-semibold tracking-tight">Agentic Inbox</h1>
              <p className="text-sm text-muted-foreground">
                Longer work than a chat. Compose a task to one of the five agents, and its
                finished report arrives as a reply on the same thread, with the run it did
                underneath. The Researcher writes a sourced report over the record; the Tracker
                watches a topic and posts a digest; the other three answer in one message.
              </p>
              <p className="text-sm text-muted-foreground">
                This site is public and has no accounts, so threads are kept in this browser and
                nowhere else — nobody else can see them, and they do not follow you to another
                device. A task runs while this tab is open. What outlives the tab is the report
                the agent delivers to Discord, under the same subject line.
              </p>
              <div>
                <Button size="sm" onClick={startCompose}>
                  Compose
                </Button>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
