import { ChatShell } from "@/components/chat/chat-shell"

// The workspace shell (Brendan, 2026-09-11), where the docs shell stood.
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <ChatShell>{children}</ChatShell>
}
