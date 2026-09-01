"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { Textarea } from "@govblock/ui/components/nova/textarea"

function textOf(message: UIMessage) {
  return message.parts
    .filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("")
}

// The assistant, framed by the surface it sits in (the bill, the member).
// One chat per `chatId`; the transcript stays in this browser.
export function AssistChat({
  chatId,
  system,
  placeholder = "Ask about this bill…",
  className,
  compact = false,
  starters = [],
}: {
  chatId: string
  system: string
  placeholder?: string
  className?: string
  compact?: boolean
  starters?: string[]
}) {
  const storageKey = `livingston:chat:${chatId}`
  const transport = React.useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { system } }),
    [system]
  )
  const { messages, sendMessage, status, setMessages, error } = useChat({
    id: chatId,
    transport,
  })
  const [input, setInput] = React.useState("")
  const [restored, setRestored] = React.useState<string | null>(null)
  const bottomRef = React.useRef<HTMLDivElement | null>(null)

  // Restore the transcript once per chat id, then keep it current.
  React.useEffect(() => {
    if (restored === chatId) return
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) setMessages(JSON.parse(raw) as UIMessage[])
      else setMessages([])
    } catch {}
    setRestored(chatId)
  }, [chatId, storageKey, restored, setMessages])

  React.useEffect(() => {
    if (restored !== chatId) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch {}
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages, restored, chatId, storageKey])

  const busy = status === "submitted" || status === "streaming"

  const submit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    void sendMessage({ text: trimmed })
    setInput("")
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
      <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto", compact ? "text-sm" : "")}>
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{placeholder}</p>
            {starters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {starters.map((starter) => (
                  <Button key={starter} variant="outline" size="sm" onClick={() => submit(starter)}>
                    {starter}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              message.role === "user"
                ? "ml-auto w-fit max-w-[85%] rounded-3xl bg-muted px-4 py-2.5"
                : "w-full whitespace-pre-wrap"
            )}
          >
            {textOf(message)}
          </div>
        ))}
        {busy && messages.at(-1)?.role === "user" && (
          <div className="text-sm text-muted-foreground">Thinking…</div>
        )}
        {error && (
          <div className="text-sm text-destructive">{error.message}</div>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        className="flex shrink-0 flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          submit(input)
        }}
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              submit(input)
            }
          }}
          placeholder={placeholder}
          className={compact ? "min-h-16" : "min-h-20"}
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setMessages([])}
            disabled={!messages.length || busy}
          >
            Clear
          </Button>
          <Button type="submit" size="sm" disabled={busy || !input.trim()}>
            {busy ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  )
}
