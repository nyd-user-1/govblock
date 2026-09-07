"use client"

import * as React from "react"

// The chat panel as part of the app shell (Brendan, 2026-09-07): mounted once
// in the root layout, off screen until summoned, and still there — same
// conversation, same scroll — after a move to another page. Modelled on 44b's
// DiscussionProvider and the sports AppPanel. A page that has something to
// talk about (a bill in typeset) hands the panel its subject through
// `setChat`; with none the panel talks about the jurisdiction in scope.

export type AssistSubject = {
  /** Names the conversation; a different id is a different transcript. */
  chatId: string
  system: string
  agentSlug?: string
  placeholder?: string
  title?: string
}

type Value = {
  open: boolean
  openPanel: () => void
  close: () => void
  toggle: () => void
  subject: AssistSubject | null
  setSubject: (subject: AssistSubject | null) => void
}

const AssistPanelContext = React.createContext<Value | null>(null)

export function AssistPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [subject, setSubject] = React.useState<AssistSubject | null>(null)
  const value = React.useMemo<Value>(
    () => ({
      open,
      openPanel: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((o) => !o),
      subject,
      setSubject,
    }),
    [open, subject]
  )
  return <AssistPanelContext.Provider value={value}>{children}</AssistPanelContext.Provider>
}

export function useAssistPanel(): Value {
  const value = React.useContext(AssistPanelContext)
  if (!value) throw new Error("useAssistPanel must be used within AssistPanelProvider")
  return value
}

/** A page's subject for the panel while the page is mounted; cleared when it leaves. */
export function useAssistSubject(subject: AssistSubject | null) {
  const { setSubject } = useAssistPanel()
  const key = subject ? `${subject.chatId}|${subject.system}|${subject.placeholder ?? ""}|${subject.title ?? ""}` : ""
  React.useEffect(() => {
    setSubject(subject)
    return () => setSubject(null)
    // The key captures every field; the object identity changes each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setSubject])
}
