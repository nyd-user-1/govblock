import { type Metadata } from "next"

import { fmtNumber } from "@/lib/format"
import { getLobbyingEntity } from "@/lib/policy/lobbying-queries"
import { LobbyingEntity } from "@/components/policy/lobbying-entity"

// One client. The page is the shared entity page; this file is the route it
// answers on, and the board it belongs to is /lobbying/clients.

export const revalidate = 3600
export const dynamicParams = true

type Props = { params: Promise<{ name: string }> }

export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decodeURIComponent((await params).name)
  const entity = await getLobbyingEntity("client", name).catch(() => null)
  if (!entity) return { title: "Clients" }
  return {
    title: entity.name,
    description: `${fmtNumber(entity.filings)} federal lobbying filings, ${entity.first_year} to ${entity.last_year}.`,
  }
}

export default async function Page({ params }: Props) {
  return <LobbyingEntity kind="client" name={decodeURIComponent((await params).name)} />
}
