"use client"

import * as React from "react"
import {
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react"
import Placeholder from "@tiptap/extension-placeholder"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Underline } from "@tiptap/extension-underline"
import { Markdown, type MarkdownStorage } from "tiptap-markdown"

import { cn } from "@/lib/utils"

// The composer's writing surface: TipTap 3, ported from
// ~/Code/policy/src/components/TipTapEditor.tsx and reduced to what a mail
// composer offers — bold, italic, underline, strike, the two lists, quote,
// code and links. StarterKit 3 already carries Link and Underline, so the
// extension list is short on purpose rather than by omission.
//
// **Markdown is the wire format.** tiptap-markdown does the round trip, so the
// reader sees formatting, the agent receives `**bold**` and `- item`, and the
// transcript renders the same subset back — one representation, three views of
// it, and no way for them to disagree.
//
// Underline has no markdown of its own. Rather than drop the button Gmail has
// or invent a syntax, it serialises to `<u>…</u>` — legal markdown, readable to
// an agent as text, and drawn by the transcript renderer. The alternative was
// silently losing a format the reader had applied, which is worse.
const UnderlineAsHtml = Underline.extend({
  addStorage() {
    return {
      markdown: {
        serialize: { open: "<u>", close: "</u>", expelEnclosingWhitespace: true },
        parse: {},
      },
    }
  },
})

// tiptap-markdown declares its storage but does not augment TipTap's Storage
// map, so the extension's own exported type is what makes this honest — one
// named cast rather than `any` at every call site.
function markdownOf(editor: Editor) {
  return (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown()
}

export function useTaskEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
}) {
  const emit = React.useRef(onChange)
  const last = React.useRef(value)
  emit.current = onChange

  const editor = useEditor({
    // Next renders this on the server first; TipTap wants the DOM.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false, underline: false }),
      UnderlineAsHtml,
      Markdown.configure({ html: true, breaks: true, transformPastedText: true }),
      Placeholder.configure({ placeholder: placeholder ?? "Write…" }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "outline-none",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = markdownOf(editor)
      last.current = markdown
      emit.current(markdown)
    },
  })

  // Re-seed only when the value changed underneath us — a starter button, or a
  // draft being opened. Echoing our own serialisation back would reset the
  // caret on every keystroke.
  React.useEffect(() => {
    if (!editor || value === last.current) return
    last.current = value
    editor.commands.setContent(value)
  }, [editor, value])

  return editor
}

/** The writing surface, with nothing above it. */
export function TaskSurface({ editor, className }: { editor: Editor | null; className?: string }) {
  return (
    <EditorContent
      editor={editor}
      className={cn(
        "min-h-40 w-full rounded-lg text-sm",
        "[&_.ProseMirror]:min-h-40 [&_.ProseMirror]:outline-none",
        "[&_.ProseMirror_p]:my-1.5",
        "[&_.ProseMirror_ul]:my-1.5 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5",
        "[&_.ProseMirror_ol]:my-1.5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5",
        "[&_.ProseMirror_blockquote]:my-1.5 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-muted-foreground",
        "[&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5",
        "[&_.ProseMirror_pre]:my-1.5 [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-2",
        "[&_.ProseMirror_a]:underline [&_.ProseMirror_a]:underline-offset-4",
        // Placeholder: TipTap marks the first empty paragraph and the text
        // comes from CSS, so it never lands in the document or the markdown.
        "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
        "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
        "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
        "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
        "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        className
      )}
    />
  )
}

type Tool =
  | { kind: "button"; icon: typeof Bold; label: string; run: (editor: Editor) => void; active?: string }
  | { kind: "divider" }

const TOOLS: Tool[] = [
  { kind: "button", icon: Bold, label: "Bold", active: "bold", run: (e) => e.chain().focus().toggleBold().run() },
  { kind: "button", icon: Italic, label: "Italic", active: "italic", run: (e) => e.chain().focus().toggleItalic().run() },
  { kind: "button", icon: UnderlineIcon, label: "Underline", active: "underline", run: (e) => e.chain().focus().toggleUnderline().run() },
  { kind: "button", icon: Strikethrough, label: "Strikethrough", active: "strike", run: (e) => e.chain().focus().toggleStrike().run() },
  { kind: "divider" },
  { kind: "button", icon: List, label: "Bulleted list", active: "bulletList", run: (e) => e.chain().focus().toggleBulletList().run() },
  { kind: "button", icon: ListOrdered, label: "Numbered list", active: "orderedList", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { kind: "button", icon: Quote, label: "Quote", active: "blockquote", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { kind: "divider" },
  { kind: "button", icon: Code, label: "Code", active: "code", run: (e) => e.chain().focus().toggleCode().run() },
  {
    kind: "button",
    icon: Link2,
    label: "Link",
    active: "link",
    run: (editor) => {
      if (editor.isActive("link")) {
        editor.chain().focus().unsetLink().run()
        return
      }
      const href = window.prompt("Link to")
      if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    },
  },
]

/** The formatting row. It belongs in the bottom bar, beside Send. */
export function TaskToolbar({ editor, className }: { editor: Editor | null; className?: string }) {
  // Re-render on selection so the active states are true rather than stale.
  const [, bump] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => {
    if (!editor) return
    editor.on("selectionUpdate", bump)
    editor.on("transaction", bump)
    return () => {
      editor.off("selectionUpdate", bump)
      editor.off("transaction", bump)
    }
  }, [editor])

  if (!editor) return null

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {TOOLS.map((tool, i) =>
        tool.kind === "divider" ? (
          <span key={i} aria-hidden className="mx-1 h-4 w-px bg-border" />
        ) : (
          <button
            key={tool.label}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            aria-pressed={tool.active ? editor.isActive(tool.active) : undefined}
            // TipTap loses the selection to a focus change; keeping it is the
            // difference between bolding the selected words and bolding
            // nothing at all.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => tool.run(editor)}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
              tool.active && editor.isActive(tool.active) && "bg-muted text-foreground"
            )}
          >
            <tool.icon className="size-4" />
          </button>
        )
      )}
    </div>
  )
}
