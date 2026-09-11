import * as React from "react"

import { ChatView } from "./chat-view"

// /chat: the one chat, filling the workspace shell's stage, with the Filer's
// starters first and the composer pinned to the bottom (Brendan, 2026-09-11:
// in the workspace shell, where it used to sit on the docs column).
const title = "Chat"
const description = "Apply for New York benefits with the Filer, or ask the Clerk about a bill, a vote, a hearing or a committee."

export const metadata = { title, description }

export default function ChatPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-4 md:px-6">
      <React.Suspense fallback={null}>
        <ChatView />
      </React.Suspense>
    </div>
  )
}
