"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { Command as CommandPrimitive } from "cmdk"
import { Album, BadgeHelp, Check, ClipboardCopyIcon, CornerUpLeft, FeatherIcon, ListEnd, ListMinus, ListPlus, Loader2Icon, MessageSquareTextIcon, PauseIcon, PenLine, Wand, WandSparklesIcon, X } from "lucide-react"

import { Button } from "@/components/plate/ui/button"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/plate/ui/command"
import { SelectionToolbar, useSelectionAt, type SelectionAt } from "@/components/workspace/typeset-selection-toolbar"
import { unitAt, unitLabel } from "@/components/workspace/typeset-units"
import { runAgent } from "@/lib/agents/run-client"
import { cn } from "@govblock/ui/lib/utils"

// ⌘J and Ask AI on the Tiptap reader and the Fork editor (Brendan,
// 2026-09-15), in the shape Plate's AI menu had: a box under the text that
// says "Ask AI anything…" with a list under it, ⌘J at the cursor's unit and
// the selection toolbar's Ask AI on the selected words, the list rewritten for
// law. Every action asks the site's chat route (/api/agents/chat, the
// Drafter in lib/agents/registry.ts) on the reader's press and never on open;
// the answer streams into the box.

type Mode = "unit" | "selection"

type Box = {
  mode: Mode
  from: number
  to: number
  /** The words selected, or the start of the paragraph ⌘J was pressed in. */
  quote: string
  identifier: string | null
  label: string
  passage: string
  top: number
  left: number
  width: number
}

type Action = { value: string; label: string; icon: React.ReactNode; instruction: string; kind: "answer" | "edit" | "draft" | "comment" }

const PASSAGE_CHARS = 12_000

const ACTIONS: Record<Mode, Action[]> = {
  unit: [
    { value: "explain", label: "Explain this section", icon: <BadgeHelp />, instruction: "Explain this section", kind: "answer" },
    { value: "summarize", label: "Summarize", icon: <Album />, instruction: "Summarize", kind: "answer" },
    { value: "plainly", label: "Say it plainly", icon: <FeatherIcon />, instruction: "Say it plainly", kind: "answer" },
    { value: "comment", label: "Comment", icon: <MessageSquareTextIcon />, instruction: "Comment", kind: "comment" },
    { value: "continue", label: "Continue drafting", icon: <PenLine />, instruction: "Continue drafting", kind: "draft" },
  ],
  selection: [
    { value: "improve", label: "Improve the wording", icon: <Wand />, instruction: "Improve the wording", kind: "edit" },
    { value: "shorter", label: "Make shorter", icon: <ListMinus />, instruction: "Make shorter", kind: "edit" },
    { value: "longer", label: "Make longer", icon: <ListPlus />, instruction: "Make longer", kind: "edit" },
    { value: "spelling", label: "Fix spelling and grammar", icon: <Check />, instruction: "Fix spelling and grammar", kind: "edit" },
    { value: "comment", label: "Comment", icon: <MessageSquareTextIcon />, instruction: "Comment", kind: "comment" },
  ],
}

export type AiComment = { from: number; to: number; quote: string; identifier: string | null; text: string }

/**
 * The box and its keys. `open(selection)` is Ask AI on the selected words; ⌘J
 * inside the container opens it at the cursor's unit. `onComment` keeps a
 * Comment answer as the reader's comment where the view keeps comments.
 */
export function useAiMenu({ editor, container, state, onComment }: { editor: Editor | null; container: React.RefObject<HTMLElement | null>; state?: string | null; onComment?: (comment: AiComment) => Promise<void> }) {
  const [box, setBox] = React.useState<Box | null>(null)
  const [answer, setAnswer] = React.useState("")
  const [status, setStatus] = React.useState<"idle" | "thinking" | "writing" | "done" | "failed">("idle")
  const [asked, setAsked] = React.useState<Action | null>(null)
  const abort = React.useRef<AbortController | null>(null)
  const pointer = React.useRef<{ x: number; y: number } | null>(null)

  const close = React.useCallback(() => {
    abort.current?.abort()
    abort.current = null
    setBox(null)
    setAnswer("")
    setStatus("idle")
    setAsked(null)
  }, [])

  /** Where the box goes, in the container's scrolled coordinates, under a rectangle on screen. */
  const place = React.useCallback(
    (rect: DOMRect, width: number) => {
      const root = container.current!
      const frame = root.getBoundingClientRect()
      const w = Math.min(width, frame.width - 16)
      const center = rect.left - frame.left + root.scrollLeft + rect.width / 2
      return { top: rect.bottom - frame.top + root.scrollTop + 6, left: Math.max(w / 2 + 8, Math.min(center, frame.width - w / 2 - 8)), width: w }
    },
    [container]
  )

  const passageOf = (from: number) => {
    const unit = unitAt(editor!.state.doc, from)
    return { identifier: unit.identifier, label: unitLabel(unit), passage: editor!.state.doc.textBetween(unit.start, unit.end, "\n").slice(0, PASSAGE_CHARS) }
  }

  const open = React.useCallback(
    (at: SelectionAt) => {
      if (!editor || !container.current) return
      const selection = window.getSelection()
      const rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null
      if (!rect) return
      abort.current?.abort()
      setAnswer("")
      setStatus("idle")
      setAsked(null)
      setBox({ mode: "selection", from: at.from, to: at.to, quote: at.text, ...passageOf(at.from), ...place(rect, 560) })
    },
    [editor, container, place] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // ⌘J at the unit under the cursor: the caret the click left, else where the pointer last pressed, else the top of the view.
  React.useEffect(() => {
    const root = container.current
    if (!editor || !root) return
    const down = (event: MouseEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY }
    }
    const key = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "j" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      const target = event.target as Node | null
      if (target && target !== document.body && !root.contains(target)) return
      if (editor.isDestroyed) return
      event.preventDefault()
      const view = editor.view
      let pos: number | null = null
      const selection = window.getSelection()
      if (selection?.rangeCount && view.dom.contains(selection.anchorNode)) {
        try {
          pos = view.posAtDOM(selection.anchorNode!, selection.anchorOffset)
        } catch {}
      }
      if (pos === null && pointer.current) pos = view.posAtCoords({ left: pointer.current.x, top: pointer.current.y })?.pos ?? null
      if (pos === null) {
        const frame = root.getBoundingClientRect()
        pos = view.posAtCoords({ left: frame.left + frame.width / 2, top: frame.top + 24 })?.pos ?? 0
      }
      const $pos = view.state.doc.resolve(pos)
      const blockPos = $pos.depth > 0 ? $pos.before($pos.depth) : 0
      const dom = view.nodeDOM(blockPos) as HTMLElement | null
      const rect = (dom instanceof HTMLElement ? dom : (view.domAtPos(pos).node as HTMLElement).parentElement ?? root).getBoundingClientRect()
      abort.current?.abort()
      setAnswer("")
      setStatus("idle")
      setAsked(null)
      setBox({ mode: "unit", from: pos, to: pos, quote: $pos.parent.textContent.trim().slice(0, 200), ...passageOf(pos), ...place(rect, Math.max(rect.width, 420)) })
    }
    root.addEventListener("mousedown", down)
    document.addEventListener("keydown", key)
    return () => {
      root.removeEventListener("mousedown", down)
      document.removeEventListener("keydown", key)
    }
  }, [editor, container, place]) // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async (action: Action) => {
    if (!box) return
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setAsked(action)
    setAnswer("")
    setStatus("thinking")
    const text = [
      `Passage: ${[box.label, box.identifier && `(${box.identifier})`].filter(Boolean).join(" ") || "the text open in Typeset"}`,
      "<passage>",
      box.passage,
      "</passage>",
      box.mode === "selection" ? `Selected words:\n<selection>\n${box.quote}\n</selection>` : "",
      `Instruction: ${action.instruction}`,
    ]
      .filter(Boolean)
      .join("\n")
    try {
      const run = await runAgent({
        agent: "drafter",
        turns: [{ role: "user", text }],
        jurisdiction: state ?? undefined,
        maxRounds: 3,
        signal: controller.signal,
        onUpdate: (r) => {
          if (controller.signal.aborted) return
          setAnswer(r.text)
          if (r.text) setStatus("writing")
        },
      })
      if (controller.signal.aborted) return
      setAnswer(run.text)
      setStatus(run.failed || !run.text.trim() ? "failed" : "done")
    } catch {
      if (!controller.signal.aborted) setStatus("failed")
    }
  }

  const menu = box ? (
    <AiBox
      box={box}
      answer={answer}
      status={status}
      asked={asked}
      editable={Boolean(editor?.isEditable)}
      canComment={Boolean(onComment)}
      onAsk={ask}
      onClose={close}
      onStop={() => {
        abort.current?.abort()
        setStatus(answer ? "done" : "idle")
      }}
      onReplace={() => {
        editor?.chain().focus().insertContentAt({ from: box.from, to: box.to }, answer.trim()).run()
        close()
      }}
      onInsertBelow={() => {
        if (!editor) return
        const $pos = editor.state.doc.resolve(box.to)
        const after = $pos.depth > 0 ? $pos.after($pos.depth) : editor.state.doc.content.size
        editor.chain().focus().insertContentAt(after, answer.trim().split(/\n{2,}/).map((para) => ({ type: "p", content: [{ type: "text", text: para }] }))).run()
        close()
      }}
      onKeepComment={async () => {
        await onComment?.({ from: box.from, to: box.to, quote: box.quote, identifier: box.identifier, text: answer.trim() })
        close()
      }}
    />
  ) : null

  return { open, close, menu, isOpen: Boolean(box) }
}

/** Ask AI and ⌘J alone, for an editor that keeps no comments: the Fork editor. */
export function AiLayer({ editor, container, state }: { editor: Editor | null; container: React.RefObject<HTMLElement | null>; state?: string | null }) {
  const [selection, setSelection] = useSelectionAt(editor, container)
  const ai = useAiMenu({ editor, container, state })
  return (
    <>
      {selection && !ai.isOpen && (
        <SelectionToolbar at={selection}>
          <Button
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-sm"
            onClick={() => {
              ai.open(selection)
              setSelection(null)
            }}
          >
            <WandSparklesIcon className="size-4" />
            Ask AI
          </Button>
        </SelectionToolbar>
      )}
      {ai.menu}
    </>
  )
}

function AiBox({
  box,
  answer,
  status,
  asked,
  editable,
  canComment,
  onAsk,
  onClose,
  onStop,
  onReplace,
  onInsertBelow,
  onKeepComment,
}: {
  box: Box
  answer: string
  status: "idle" | "thinking" | "writing" | "done" | "failed"
  asked: Action | null
  editable: boolean
  canComment: boolean
  onAsk: (action: Action) => void
  onClose: () => void
  onStop: () => void
  onReplace: () => void
  onInsertBelow: () => void
  onKeepComment: () => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [input, setInput] = React.useState("")
  const [value, setValue] = React.useState("")
  const loading = status === "thinking" || status === "writing"
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    const down = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      if (loading) onStop()
      else onClose()
    }
    document.addEventListener("mousedown", down)
    document.addEventListener("keydown", key)
    return () => {
      document.removeEventListener("mousedown", down)
      document.removeEventListener("keydown", key)
    }
  }, [onClose, onStop, loading])

  const typed = (question: string): Action => ({ value: "typed", label: question, icon: null, instruction: question, kind: "answer" })

  // After an answer: what can be done with it where the reader is.
  const after: { value: string; label: string; icon: React.ReactNode; onSelect: () => void }[] = []
  if (status === "done" && asked) {
    if (asked.kind === "comment" && canComment) after.push({ value: "keep", label: "Keep as a comment", icon: <Check />, onSelect: onKeepComment })
    if (asked.kind === "edit" && editable) after.push({ value: "replace", label: "Replace selection", icon: <Check />, onSelect: onReplace })
    if ((asked.kind === "draft" || asked.kind === "edit") && editable) after.push({ value: "below", label: "Insert below", icon: <ListEnd />, onSelect: onInsertBelow })
    after.push({
      value: "copy",
      label: copied ? "Copied" : "Copy",
      icon: <ClipboardCopyIcon />,
      onSelect: () => {
        void navigator.clipboard?.writeText(answer.trim())
        setCopied(true)
      },
    })
    after.push({ value: "again", label: "Try again", icon: <CornerUpLeft />, onSelect: () => onAsk(asked) })
    after.push({ value: "discard", label: "Discard", icon: <X />, onSelect: onClose })
  }
  if (status === "failed" && asked) {
    after.push({ value: "again", label: "Try again", icon: <CornerUpLeft />, onSelect: () => onAsk(asked) })
    after.push({ value: "discard", label: "Discard", icon: <X />, onSelect: onClose })
  }
  const items = status === "idle" ? ACTIONS[box.mode] : []

  React.useEffect(() => {
    const first = after[0]?.value ?? items[0]?.value ?? ""
    setValue(first)
  }, [status, box.mode]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className="absolute z-50 -translate-x-1/2" style={{ top: box.top, left: box.left, width: box.width }}>
      <Command className="w-full rounded-lg border bg-popover shadow-md" value={value} onValueChange={setValue}>
        {answer && <div className="max-h-72 overflow-y-auto border-b px-3 py-2 text-sm whitespace-pre-wrap">{answer}</div>}
        {status === "failed" && <div className="border-b px-3 py-2 text-sm text-muted-foreground">No answer came back.</div>}
        {loading ? (
          <div className="flex grow items-center gap-2 p-2 text-sm text-muted-foreground select-none">
            <Loader2Icon className="size-4 animate-spin" />
            {status === "thinking" ? "Thinking..." : "Writing..."}
            <Button className="ml-auto flex items-center gap-1 text-xs" onClick={onStop} size="sm" variant="ghost">
              <PauseIcon className="size-4" />
              Stop
              <kbd className="ml-1 rounded bg-border px-1 font-mono text-[10px] text-muted-foreground shadow-sm">Esc</kbd>
            </Button>
          </div>
        ) : (
          <CommandPrimitive.Input
            autoFocus
            className={cn("flex h-9 w-full min-w-0 border-b border-input bg-transparent px-3 py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm dark:bg-input/30")}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !input) {
                event.preventDefault()
                onClose()
              }
              if (event.key === "Enter" && !event.shiftKey && input.trim() && !value) {
                event.preventDefault()
                onAsk(typed(input.trim()))
                setInput("")
              }
            }}
            onValueChange={setInput}
            placeholder="Ask AI anything..."
            value={input}
          />
        )}
        {!loading && (items.length > 0 || after.length > 0) && (
          <CommandList>
            <CommandGroup>
              {items.map((action) => (
                <CommandItem
                  key={action.value}
                  className="[&_svg]:text-muted-foreground"
                  value={action.value}
                  keywords={[action.label]}
                  onSelect={() => {
                    onAsk(input.trim() ? { ...action, instruction: `${action.instruction}. ${input.trim()}` } : action)
                    setInput("")
                  }}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </CommandItem>
              ))}
              {after.map((item) => (
                <CommandItem key={item.value} className="[&_svg]:text-muted-foreground" value={item.value} keywords={[item.label]} onSelect={item.onSelect}>
                  {item.icon}
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        )}
      </Command>
    </div>
  )
}
