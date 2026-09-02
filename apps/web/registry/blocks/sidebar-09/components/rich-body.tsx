"use client"

import * as React from "react"
import { Bold, Code, Italic, Link2, List, ListOrdered } from "lucide-react"
import { baseKeymap, chainCommands, toggleMark } from "prosemirror-commands"
import { history, redo, undo } from "prosemirror-history"
import { InputRule, inputRules, textblockTypeInputRule, undoInputRule } from "prosemirror-inputrules"
import { keymap } from "prosemirror-keymap"
import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  schema,
} from "prosemirror-markdown"
import { liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list"
import { EditorState, type Command, type Transaction } from "prosemirror-state"
import { EditorView } from "prosemirror-view"

import { cn } from "@/lib/utils"

// The composer's body: ProseMirror configured as a WYSIWYG *markdown* editor,
// ported from ~/Code/leuk's clinical-notes editor and reduced to what a task
// needs — bold, italic, code, links, and the two lists. No tables, no slash
// menu, no headings: this is a message to an agent, not a document, and the
// agent reads it as text.
//
// **Value in and out is a markdown string.** That is the whole point: the
// reader sees formatting, the agent receives `**bold**` and `- item`, and the
// transcript renderer speaks the same subset back when the thread shows what
// was sent. The three cannot disagree, because there is only one
// representation and the editor is a view onto it.
//
// prosemirror-markdown's default schema and serializer are used unchanged. Its
// dialect is CommonMark, which is a superset of what the renderer draws — a
// blockquote will serialise faithfully and render as its own text — so nothing
// is ever lost on the wire, only occasionally undecorated on the way back.

const BULLET = /^\s*([-+*])\s$/
const ORDERED = /^(\d+)\.\s$/
const CODE_BLOCK = /^```$/

/**
 * "- " starts a list — unless you are already in one, where it is just a dash.
 *
 * prosemirror's own wrappingInputRule fires inside a list item too and nests a
 * second list, which is how you indent by typing in a rich-text editor and is
 * exactly wrong for someone typing markdown line by line: the second bullet
 * comes out indented under the first. So the rule checks its ancestors first,
 * and where it does apply it deletes the marker and lets wrapInList do the
 * wrapping — the command's steps are appended to the same transaction, so it
 * stays one undo.
 */
function listRule(
  match: RegExp,
  type: (typeof schema.nodes)[string],
  attrs?: (m: RegExpMatchArray) => Record<string, unknown>
) {
  return new InputRule(match, (state, m, start, end) => {
    const $start = state.doc.resolve(start)
    for (let depth = $start.depth; depth > 0; depth -= 1)
      if ($start.node(depth).type === schema.nodes.list_item)
        // Already in a list: Enter has already made this bullet, so the marker
        // the reader typed is a duplicate. Swallow it rather than nesting a
        // list (ProseMirror's default) or leaving an escaped "\-" in the text.
        return state.tr.delete(start, end)

    const tr = state.tr.delete(start, end)
    let wrapped: Transaction | null = null
    wrapInList(type!, attrs?.(m))(state.apply(tr), (next) => {
      wrapped = next
    })
    if (!wrapped) return null
    for (const step of (wrapped as Transaction).steps) tr.step(step)
    return tr
  })
}

const rules = inputRules({
  rules: [
    listRule(BULLET, schema.nodes.bullet_list!),
    listRule(ORDERED, schema.nodes.ordered_list!, (m) => ({ order: Number(m[1]) })),
    textblockTypeInputRule(CODE_BLOCK, schema.nodes.code_block!),
  ],
})

/** Wrap the selection in a link, asking for the href the way mail does. */
const addLink: Command = (state, dispatch) => {
  const { from, to } = state.selection
  if (from === to) return false
  const href = window.prompt("Link to")
  if (!href) return false
  if (dispatch)
    dispatch(state.tr.addMark(from, to, schema.marks.link!.create({ href, title: null })))
  return true
}

type Tool = { icon: typeof Bold; label: string; run: Command }

const TOOLS: Tool[] = [
  { icon: Bold, label: "Bold", run: toggleMark(schema.marks.strong!) },
  { icon: Italic, label: "Italic", run: toggleMark(schema.marks.em!) },
  { icon: Code, label: "Code", run: toggleMark(schema.marks.code!) },
  { icon: Link2, label: "Link", run: addLink },
  { icon: List, label: "Bulleted list", run: wrapInList(schema.nodes.bullet_list!) },
  { icon: ListOrdered, label: "Numbered list", run: wrapInList(schema.nodes.ordered_list!) },
]

export function RichBody({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  className?: string
}) {
  const host = React.useRef<HTMLDivElement | null>(null)
  const view = React.useRef<EditorView | null>(null)
  const emit = React.useRef(onChange)
  const last = React.useRef(value)
  const [empty, setEmpty] = React.useState(!value)

  emit.current = onChange

  React.useEffect(() => {
    const node = host.current
    if (!node) return

    const state = EditorState.create({
      doc: defaultMarkdownParser.parse(last.current) ?? undefined,
      plugins: [
        rules,
        keymap({
          "Mod-z": undo,
          "Mod-y": redo,
          "Mod-Shift-z": redo,
          "Mod-b": toggleMark(schema.marks.strong!),
          "Mod-i": toggleMark(schema.marks.em!),
          "Mod-e": toggleMark(schema.marks.code!),
          "Mod-Shift-8": wrapInList(schema.nodes.bullet_list!),
          "Mod-Shift-9": wrapInList(schema.nodes.ordered_list!),
          Enter: splitListItem(schema.nodes.list_item!),
          Tab: sinkListItem(schema.nodes.list_item!),
          "Shift-Tab": liftListItem(schema.nodes.list_item!),
          // A rule that fired when you meant the characters is one key away
          // from being undone, which is the standard escape hatch.
          Backspace: undoInputRule,
          "Shift-Enter": chainCommands((state, dispatch) => {
            if (dispatch)
              dispatch(
                state.tr.replaceSelectionWith(schema.nodes.hard_break!.create()).scrollIntoView()
              )
            return true
          }),
        }),
        keymap(baseKeymap),
        history(),
      ],
    })

    const editor = new EditorView(node, {
      state,
      attributes: { class: "outline-none min-h-40" },
      dispatchTransaction(tr) {
        const next = editor.state.apply(tr)
        editor.updateState(next)
        setEmpty(next.doc.textContent.length === 0 && next.doc.childCount <= 1)
        if (tr.docChanged) {
          const markdown = defaultMarkdownSerializer.serialize(next.doc)
          last.current = markdown
          emit.current(markdown)
        }
      },
    })
    view.current = editor
    return () => {
      view.current = null
      editor.destroy()
    }
  }, [])

  // Re-seed only when the value changed underneath us — a starter button, or a
  // draft being opened. Echoing our own serialisation back in would reset the
  // caret on every keystroke.
  React.useEffect(() => {
    const editor = view.current
    if (!editor || value === last.current) return
    last.current = value
    const doc = defaultMarkdownParser.parse(value)
    if (!doc) return
    editor.dispatch(editor.state.tr.replaceWith(0, editor.state.doc.content.size, doc.content))
    setEmpty(doc.textContent.length === 0)
  }, [value])

  const run = (command: Command) => {
    const editor = view.current
    if (!editor) return
    command(editor.state, editor.dispatch, editor)
    editor.focus()
  }

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lg border", className)}>
      <div className="flex items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            // ProseMirror loses the selection to a focus change; keeping it is
            // the difference between bolding the selected words and bolding
            // nothing at all.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(tool.run)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <tool.icon className="size-4" />
          </button>
        ))}
      </div>
      <div className="relative px-3 py-2 text-sm">
        {empty && placeholder && (
          <span className="pointer-events-none absolute px-0 text-muted-foreground">
            {placeholder}
          </span>
        )}
        <div
          ref={host}
          className={cn(
            "[&_.ProseMirror]:min-h-40 [&_.ProseMirror]:whitespace-pre-wrap [&_.ProseMirror]:break-words [&_.ProseMirror]:outline-none",
            "[&_.ProseMirror_p]:my-1",
            "[&_.ProseMirror_ul]:my-1 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5",
            "[&_.ProseMirror_ol]:my-1 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5",
            "[&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5",
            "[&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-2",
            "[&_.ProseMirror_a]:underline [&_.ProseMirror_a]:underline-offset-4"
          )}
        />
      </div>
    </div>
  )
}
