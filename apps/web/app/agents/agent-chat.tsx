"use client"

import { AssistChat } from "@/components/chat/assist-chat"
import type { AgentDefinition } from "@/lib/agents/registry"

// The chat on an agent's page: the one chat component, addressed to this
// agent, one transcript per agent in this browser.

export function AgentChat({ agent }: { agent: AgentDefinition }) {
  return <AssistChat chatId={`agent-${agent.slug}`} agentSlug={agent.slug} placeholder={agent.placeholder} starters={agent.starters} className="min-h-[22rem]" />
}
