"use client"

import * as React from "react"
import { RotateCcw, Star, Trash2 } from "lucide-react"

import { agent as findAgent, maxRounds } from "@/lib/agents/registry"
import {
  addressOf,
  findAddress,
  isUnread,
  loadThreads,
  newThread,
  reply,
  running,
  saveThreads,
  when,
  type Folder,
  type Thread,
} from "@/lib/agents/inbox"
import { emptyRun, runAgent } from "@/lib/agents/run-client"
import { cn } from "@/lib/utils"
import { Prose, RunMeta, RunSteps } from "@/app/agents/transcript"
import { AppSidebar } from "@/registry/blocks/sidebar-09/components/app-sidebar"
import { Compose, type Draft } from "@/registry/blocks/sidebar-09/components/compose"
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

const EMPTY: Draft = { to: "", subject: "", body: "" }

export default function Page() {
  const [threads, setThreads] = React.useState<Thread[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  const [folder, setFolder] = React.useState<Folder>("inbox")
  const [composing, setComposing] = React.useState(false)
  const [draft, setDraft] = React.useState<Draft>(EMPTY)
  const [draftId, setDraftId] = React.useState<string | null>(null)
  const [restored, setRestored] = React.useState(false)

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
    async (agentSlug: string, subject: string, body: string, existingId?: string) => {
      const definition = findAgent(agentSlug)
      if (!definition) return

      const thread = newThread({
        agent: definition.slug,
        agentName: definition.name,
        subject,
        body,
        status: "running",
      })
      // Sending a draft replaces it in place, so the thread keeps its position
      // rather than appearing twice.
      setThreads((current) => [
        thread,
        ...current.filter((entry) => entry.id !== existingId),
      ])
      setSelected(thread.id)
      setFolder("sent")
      setComposing(false)
      setDraft(EMPTY)
      setDraftId(null)

      // The reply exists from the first token, unread, so the thread reads as
      // an arriving message rather than appearing whole at the end.
      patch(thread.id, (current) => reply(current, emptyRun(), "running"))

      const finished = await runAgent({
        agent: definition.slug,
        maxRounds: maxRounds(definition),
        subject: thread.subject,
        turns: [{ role: "user", text: body }],
        onUpdate: (run) => patch(thread.id, (current) => reply(current, run, "running")),
      })

      patch(thread.id, (current) =>
        reply(current, finished, finished.failed ? "failed" : "delivered")
      )
      setFolder("inbox")
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
    setDraft(EMPTY)
    setDraftId(null)
    setComposing(true)
  }

  const saveDraft = () => {
    // An address resolves through findAddress, not by splitting the string:
    // the slug has hyphens ("bill-reader") and the address does not.
    const address = findAddress(draft.to)
    const thread = newThread({
      agent: address?.agent ?? draft.to,
      agentName: address?.name ?? (draft.to || "No recipient"),
      subject: draft.subject,
      body: draft.body,
      status: "draft",
    })
    setThreads((current) => [thread, ...current.filter((entry) => entry.id !== draftId)])
    setComposing(false)
    setFolder("drafts")
    setSelected(thread.id)
    setDraft(EMPTY)
    setDraftId(null)
  }

  const editDraft = (thread: Thread) => {
    const address = findAgent(thread.agent)
    setDraft({
      to: address ? addressOf(address).email : thread.agent,
      subject: thread.subject === "(no subject)" ? "" : thread.subject,
      body: thread.messages[0]?.body ?? "",
    })
    setDraftId(thread.id)
    setComposing(true)
  }

  const agentMessage = open?.messages.find((message) => message.from !== "you")

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
        }}
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
                  <Star className={cn("size-4", open.starred && "fill-current")} />
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
            <Button size="sm" onClick={startCompose} disabled={composing}>
              Compose
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {composing ? (
            <Compose
              draft={draft}
              onChange={setDraft}
              onSend={(address, current) =>
                void send(address.agent, current.subject, current.body, draftId ?? undefined)
              }
              onDiscard={() => {
                setComposing(false)
                setDraft(EMPTY)
                setDraftId(null)
              }}
              onSaveDraft={saveDraft}
            />
          ) : open ? (
            <article className="flex max-w-3xl flex-col gap-5">
              <header className="flex flex-col gap-1">
                <h1 className="text-lg font-semibold tracking-tight">{open.subject}</h1>
                <p className="text-sm text-muted-foreground">
                  To {open.agentName} · {when(open.createdAt)}
                  {open.trashed && " · in trash"}
                  {open.deliveredTo && ` · delivered to ${open.deliveredTo}`}
                </p>
              </header>

              <div className="rounded-lg border p-4 text-sm whitespace-pre-wrap">
                {open.messages[0]?.body}
              </div>

              {open.status === "draft" ? (
                <div>
                  <Button size="sm" onClick={() => editDraft(open)}>
                    Edit draft
                  </Button>
                </div>
              ) : (
                <section className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {open.agentName
                        .split(/\s+/)
                        .map((word) => word[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <span>{open.agentName}</span>
                    {agentMessage?.unread && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        Unread
                      </span>
                    )}
                  </div>

                  {agentMessage?.body && (
                    <div
                      className={cn(
                        "text-sm whitespace-pre-wrap",
                        open.status === "failed" && "text-destructive"
                      )}
                    >
                      <Prose text={agentMessage.body} />
                    </div>
                  )}

                  {open.status === "running" && (
                    // The reading pane's own sign of life. It names the tool in
                    // flight rather than saying "working", so a long gather
                    // reads as progress instead of as a hang.
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 animate-pulse rounded-full bg-primary"
                      />
                      <span className="animate-pulse">{running(open)}</span>
                    </div>
                  )}

                  {(agentMessage?.run?.steps.length ?? 0) > 0 && (
                    <details className="rounded-lg border p-3">
                      <summary className="cursor-pointer text-sm text-muted-foreground">
                        {agentMessage!.run!.steps.length} tool call
                        {agentMessage!.run!.steps.length === 1 ? "" : "s"}
                        {open.status === "running" ? " so far" : ""}
                      </summary>
                      <div className="pt-3">
                        <RunSteps steps={agentMessage!.run!.steps} />
                      </div>
                    </details>
                  )}

                  {agentMessage?.run && <RunMeta run={agentMessage.run} />}
                </section>
              )}
            </article>
          ) : (
            <div className="flex max-w-3xl flex-col gap-3">
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
