"use client"

import * as React from "react"
import { addMinutes, format } from "date-fns"
import { Trash2Icon } from "lucide-react"

import { toLocalISO } from "@/lib/calendar/dates"
import type { CalendarEvent } from "@/lib/calendar/types"
import { POST_MAX, POST_TARGETS, type PostTarget } from "@/lib/linkedin/types"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@govblock/ui/components/nova/select"
import { Textarea } from "@govblock/ui/components/nova/textarea"

import { useLatest } from "@/components/calendar/calendar-provider"
import {
  DateField,
  EditorAnchor,
  parseDateTime,
  TimeField,
  type EventFormProps,
} from "@/components/calendar/event-form"

import { useLinkedIn } from "./post-source"

// The event form's twin for a LinkedIn post: when it goes out, where, and
// what it says. Like the event form there is nothing to submit; an edit saves
// on the next pause, and a draft walks its ghost to the new time.

const SAVE_DELAY = 400
const LENGTH = 30

interface FormState {
  title: string
  target: PostTarget
  date: string
  time: string
  body: string
}

export function PostForm({ event, draft, onUpdate, onSave, onRemove, onEscape }: EventFormProps) {
  const { account } = useLinkedIn()
  const locked = event?.post?.status === "posted" || event?.post?.status === "publishing"

  const [state, setState] = React.useState<FormState>(() => {
    const start = event ? new Date(event.start) : draft!.start
    return {
      title: event ? (event.post?.title ?? "") : draft!.title,
      target: event?.post?.target ?? draft?.target ?? "profile",
      date: format(start, "yyyy-MM-dd"),
      time: format(start, "HH:mm"),
      body: (event ? event.description : draft!.description) ?? "",
    }
  })

  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = React.useRef<CalendarEvent | null>(null)
  const saveRef = useLatest(onSave)

  const flush = React.useCallback(() => {
    clearTimeout(timer.current)
    if (pending.current) {
      saveRef.current?.(pending.current)
      pending.current = null
    }
  }, [saveRef])

  // The last edit is still waiting when the popover takes the form down.
  React.useEffect(() => flush, [flush])

  const first = React.useRef(true)
  const eventRef = useLatest(event)
  const updateRef = useLatest(onUpdate)

  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const start = parseDateTime(state.date, state.time)
    if (!start) return
    const end = addMinutes(start, LENGTH)
    const source = eventRef.current

    if (source) {
      pending.current = {
        ...source,
        description: state.body,
        start: toLocalISO(start),
        end: toLocalISO(end),
        post: source.post && { ...source.post, title: state.title, target: state.target },
      }
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DELAY)
      return
    }

    updateRef.current?.({ title: state.title, target: state.target, description: state.body, allDay: false, start, end })
  }, [state, flush, eventRef, updateRef])

  function patch(next: Partial<FormState>) {
    setState((current) => ({ ...current, ...next }))
  }

  const companyUnavailable = state.target !== "profile" && account?.connected && !account.company

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(submit) => submit.preventDefault()}
      onKeyDownCapture={(keyboard) => {
        if (keyboard.key === "Escape") {
          keyboard.stopPropagation()
          onEscape?.()
        }
      }}
    >
      {event && <EditorAnchor />}

      <fieldset disabled={locked} className="flex flex-col gap-2">
        <div className="flex items-center rounded-md bg-muted px-3 py-2">
          <input
            autoFocus
            value={state.title}
            maxLength={200}
            placeholder="New Post"
            aria-label="Title"
            onChange={(change) => patch({ title: change.target.value })}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 rounded-md bg-muted px-3 py-2">
          <span className="w-16 text-end text-sm text-muted-foreground">Posts to:</span>
          <Select value={state.target} onValueChange={(value) => value && patch({ target: value as PostTarget })} disabled={locked}>
            <SelectTrigger size="sm" aria-label="Posts to" className="h-7 w-fit border-transparent bg-transparent px-1.5 dark:bg-transparent">
              <SelectValue>{POST_TARGETS.find((t) => t.value === state.target)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent align="start" className="min-w-fit">
              {POST_TARGETS.map((target) => (
                <SelectItem key={target.value} value={target.value}>
                  {target.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="w-16 text-end text-sm text-muted-foreground">Posts at:</span>
          <div className="flex items-center gap-2">
            <DateField label="Date" value={state.date} onChange={(date) => patch({ date })} />
            <TimeField label="Time" value={state.time} onChange={(time) => patch({ time })} />
          </div>
        </div>

        {companyUnavailable && (
          <p className="px-1 text-xs text-muted-foreground">
            The company page needs LinkedIn&apos;s Community Management API, which this app does not have yet.
          </p>
        )}

        <div className="rounded-md bg-muted px-3 py-2">
          <Textarea
            value={state.body}
            maxLength={POST_MAX}
            rows={8}
            placeholder="What should the post say?"
            aria-label="Post text"
            onChange={(change) => patch({ body: change.target.value })}
            className="max-h-80 min-h-32 resize-none rounded-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <div className={cn("pt-1 text-end text-xs tabular-nums text-muted-foreground", state.body.length > POST_MAX - 100 && "text-destructive")}>
            {state.body.length.toLocaleString()} / {POST_MAX.toLocaleString()}
          </div>
        </div>
      </fieldset>

      {event && (
        <Button type="button" variant="destructive" size="sm" className="w-full" onClick={() => onRemove?.(event.id)}>
          <Trash2Icon data-icon="inline-start" />
          {locked ? "Remove from calendar" : "Delete Post"}
        </Button>
      )}
    </form>
  )
}
