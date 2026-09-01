import { emptyRun, type RunState } from "@/lib/agents/run-client"

// The Agentic Inbox's store, which is this browser's localStorage and nothing
// else.
//
// That is a deliberate v1 choice, not an oversight: govblock is public and has
// no accounts, so a server-side inbox would be one shared inbox — every visitor
// reading every other visitor's tasks and paying for them. Per-browser is the
// only honest place to keep them until there is an identity to key them to, and
// the surface says so rather than letting anyone assume otherwise. §4 prices
// what close-the-tab delivery would take.

export type TaskStatus = "running" | "delivered" | "failed"

export type Task = {
  id: string
  agent: string
  agentName: string
  tasking: string
  createdAt: number
  finishedAt?: number
  status: TaskStatus
  /** Where the report was delivered, if a connection took it. */
  deliveredTo?: string
  run: RunState
}

const KEY = "govblock:inbox"

export function loadTasks(): Task[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const tasks = JSON.parse(raw) as Task[]
    return Array.isArray(tasks) ? tasks : []
  } catch {
    return []
  }
}

export function saveTasks(tasks: Task[]) {
  try {
    // Twenty is a long history for one browser and keeps the whole store well
    // inside localStorage's few megabytes — a Researcher report with its run
    // attached is tens of kilobytes.
    window.localStorage.setItem(KEY, JSON.stringify(tasks.slice(0, 20)))
  } catch {}
}

export function newTask(agent: string, agentName: string, tasking: string): Task {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    agent,
    agentName,
    tasking,
    createdAt: Date.now(),
    status: "running",
    run: emptyRun(),
  }
}

/** What a row says a task is doing, in the space a mail teaser had. */
export function teaser(task: Task) {
  if (task.status === "running") {
    const step = [...task.run.steps].reverse().find((s) => s.kind === "tool")
    if (step && step.kind === "tool")
      return step.summary ? `${step.name} → ${step.summary}` : `${step.name}…`
    return task.run.rounds ? `Round ${task.run.rounds}…` : "Starting…"
  }
  if (task.status === "failed") return task.run.text.slice(0, 160) || "Failed."
  const body = task.run.text.replace(/\s+/g, " ").trim()
  return body.slice(0, 160)
}

export function when(at: number) {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return days === 1 ? "yesterday" : `${days} days ago`
}

/** Whether the run's own steps show it posted, and where. */
export function deliveredTo(run: RunState) {
  const post = run.steps.find(
    (step) => step.kind === "tool" && step.name.startsWith("post_to") && step.ok
  )
  if (post && post.kind === "tool" && post.summary) return post.summary.replace(/^posted to /, "")
  return undefined
}
