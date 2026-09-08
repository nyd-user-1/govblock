import { LobbyingBoard } from "@/components/policy/lobbying-board"

const title = "Lobbyists"
const description = "Every lobbyist named on a federal filing, and who they filed for."

export const metadata = { title, description }

export default function Page() {
  return (
    <LobbyingBoard
      title={title}
      description={description}
      slug="/docs/lobbying/lobbyists"
      kind="lobbyists"
      previous={{ name: "Clients", url: "/docs/lobbying/clients" }}
      next={{ name: "Roll call votes", url: "/docs/roll-call-votes" }}
    />
  )
}
