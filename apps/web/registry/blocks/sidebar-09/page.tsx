"use client"

import * as React from "react"

import { AGENTS, agent as findAgent, maxRounds } from "@/lib/agents/registry"
import { deliveredTo, loadTasks, newTask, saveTasks, when, type Task } from "@/lib/agents/inbox"
import { runAgent } from "@/lib/agents/run-client"
import { Prose, RunMeta, RunSteps } from "@/app/agents/transcript"
import { AppSidebar } from "@/registry/blocks/sidebar-09/components/app-sidebar"
import { Button } from "@govblock/ui/components/nova/button"
import { Textarea } from "@govblock/ui/components/nova/textarea"
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
// Live chat is what /agents already is. This is its long-form sibling: a task
// goes in, an agent works it across many rounds, and the finished report is
// read here like a delivered message with the run it did collapsed underneath.
// The same round loop, the same renderer, a different frame around them.
//
// v1 runs the task in this tab. That is the honest shape for a public site with
// no accounts: tasks are kept in this browser, and the header says so rather
// than letting anyone assume a server is holding them. What makes it feel
// delivered anyway is Discord — the agent posts the finished report into the
// channel, so it arrives somewhere that outlives the tab.

const INBOX_AGENTS = AGENTS.filter((a) => a.inbox || a.agentic)

export default function Page() {
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  const [composing, setComposing] = React.useState(false)
  const [slug, setSlug] = React.useState(INBOX_AGENTS[0]?.slug ?? "researcher")
  const [tasking, setTasking] = React.useState("")
  const [restored, setRestored] = React.useState(false)

  React.useEffect(() => {
    const stored = loadTasks()
    // A task that was running when the tab closed did not survive it. Say so
    // rather than leave a spinner that will never stop.
    const settled = stored.map((task): Task =>
      task.status === "running"
        ? {
            ...task,
            status: "failed" as const,
            run: {
              ...task.run,
              failed: true,
              done: true,
              text:
                task.run.text +
                (task.run.text ? "\n\n" : "") +
                "This task was still running when the tab was closed, and v1 runs tasks in the tab. Send it again.",
            },
          }
        : task
    )
    setTasks(settled)
    setSelected(settled[0]?.id ?? null)
    setRestored(true)
  }, [])

  React.useEffect(() => {
    if (restored) saveTasks(tasks)
  }, [tasks, restored])

  const submit = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      const definition = findAgent(slug)
      const text = tasking.trim()
      if (!definition || !text) return

      const task = newTask(definition.slug, definition.name, text)
      setTasks((current) => [task, ...current])
      setSelected(task.id)
      setComposing(false)
      setTasking("")

      const finished = await runAgent({
        agent: definition.slug,
        maxRounds: maxRounds(definition),
        turns: [{ role: "user", text }],
        onUpdate: (run) =>
          setTasks((current) =>
            current.map((entry): Task => (entry.id === task.id ? { ...entry, run } : entry))
          ),
      })

      setTasks((current) =>
        current.map((entry): Task =>
          entry.id === task.id
            ? {
                ...entry,
                run: finished,
                finishedAt: Date.now(),
                status: finished.failed ? "failed" : "delivered",
                deliveredTo: deliveredTo(finished),
              }
            : entry
        )
      )
    },
    [slug, tasking]
  )

  const open = tasks.find((task) => task.id === selected) ?? null

  return (
    <SidebarProvider style={{ "--sidebar-width": "350px" } as React.CSSProperties}>
      <AppSidebar
        tasks={tasks}
        selected={selected}
        onOpenTask={(id) => {
          setSelected(id)
          setComposing(false)
        }}
        onClear={() => {
          setTasks([])
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
                  {composing ? "New task" : (open?.agentName ?? "Inbox")}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => setComposing(true)}
            disabled={composing}
          >
            New task
          </Button>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {composing ? (
            <form className="flex max-w-3xl flex-col gap-3" onSubmit={submit}>
              <div className="flex flex-wrap gap-2">
                {INBOX_AGENTS.map((entry) => (
                  <Button
                    key={entry.slug}
                    type="button"
                    variant={entry.slug === slug ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSlug(entry.slug)}
                  >
                    {entry.name}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {findAgent(slug)?.speciality}
              </p>
              <Textarea
                value={tasking}
                onChange={(event) => setTasking(event.target.value)}
                placeholder={findAgent(slug)?.placeholder}
                className="min-h-32"
              />
              <div className="flex flex-wrap gap-2">
                {(findAgent(slug)?.starters ?? []).map((starter) => (
                  <Button
                    key={starter}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTasking(starter)}
                  >
                    {starter}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={!tasking.trim()}>
                  Send
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setComposing(false)}>
                  Cancel
                </Button>
                <span className="ml-auto text-xs text-muted-foreground">
                  Runs in this tab. Kept in this browser, not on a server.
                </span>
              </div>
            </form>
          ) : open ? (
            <article className="flex max-w-3xl flex-col gap-4">
              <header className="flex flex-col gap-1">
                <h1 className="text-lg font-semibold tracking-tight">{open.tasking}</h1>
                <p className="text-sm text-muted-foreground">
                  {open.agentName} · {when(open.createdAt)}
                  {open.status === "running" && " · running"}
                  {open.deliveredTo && ` · delivered to ${open.deliveredTo}`}
                </p>
              </header>

              {open.run.text ? (
                <div
                  className={
                    open.status === "failed"
                      ? "text-sm whitespace-pre-wrap text-destructive"
                      : "text-sm whitespace-pre-wrap"
                  }
                >
                  <Prose text={open.run.text} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Working…</p>
              )}

              {open.run.steps.length > 0 && (
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    {open.run.steps.length} tool call
                    {open.run.steps.length === 1 ? "" : "s"}
                    {open.status === "running" ? " so far" : ""}
                  </summary>
                  <div className="pt-3">
                    <RunSteps steps={open.run.steps} />
                  </div>
                </details>
              )}

              <RunMeta run={open.run} />
            </article>
          ) : (
            <div className="flex max-w-3xl flex-col gap-3">
              <h1 className="text-lg font-semibold tracking-tight">Agentic Inbox</h1>
              <p className="text-sm text-muted-foreground">
                Longer work than a chat: give an agent a task, and its finished report is read
                here like a delivered message, with the run it did underneath. The Researcher
                writes a sourced report over the record; the Tracker watches a topic and posts a
                digest.
              </p>
              <p className="text-sm text-muted-foreground">
                This site is public and has no accounts, so tasks are kept in this browser and
                nowhere else — nobody else can see them, and they do not follow you to another
                device. A task runs while this tab is open. What outlives the tab is the post the
                agent makes to Discord, which is where a finished report actually lands.
              </p>
              <div>
                <Button size="sm" onClick={() => setComposing(true)}>
                  New task
                </Button>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
