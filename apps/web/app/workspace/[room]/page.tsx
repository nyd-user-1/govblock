import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ROOMS, type Room } from "@/lib/workspace/path"
import { Designer } from "@/components/create/designer"

// The rooms beside the legislature (Brendan, 2026-09-07): the Agentic Inbox,
// the finance explorer, the forms and the documents, each at its own path
// now that /create is retired.
const TITLES: Record<Room, string> = { inbox: "Agentic Inbox", finance: "Finance", forms: "Forms", documents: "Documents" }

export function generateStaticParams() {
  return ROOMS.map((room) => ({ room }))
}

export async function generateMetadata({ params }: { params: Promise<{ room: string }> }): Promise<Metadata> {
  const { room } = await params
  return { title: TITLES[room as Room] ?? "Workspace" }
}

export default async function RoomPage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params
  if (!(ROOMS as readonly string[]).includes(room)) notFound()
  return <Designer route={{ room: room as Room }} />
}
