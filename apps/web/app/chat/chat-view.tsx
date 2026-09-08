"use client"

import { useSearchParams } from "next/navigation"

import { AssistChat } from "@/components/chat/assist-chat"
import { agent as findAgent } from "@/lib/agents/registry"
import { formById, isFormId } from "@/lib/forms/programs"

// The chat on /chat, addressed to the Filer. `?form=ldss-2921` pre-seeds the
// first message, so the "Fill this form" button on a form's page opens on the
// first question rather than a blank box.

export function ChatView() {
  const params = useSearchParams()
  const form = params.get("form")
  const seed = isFormId(form) ? `Help me apply with the ${formById(form)!.code}, the ${formById(form)!.title}.` : undefined
  const filer = findAgent("form-filler")
  const clerk = findAgent("bill-reader")
  return (
    <AssistChat
      chatId="chat"
      agentSlug="form-filler"
      placeholder={filer?.placeholder ?? "Say which form to fill…"}
      starters={[...(filer?.starters ?? []), ...(clerk?.starters.slice(0, 2) ?? [])]}
      seed={seed}
      className="min-h-0 flex-1"
    />
  )
}
