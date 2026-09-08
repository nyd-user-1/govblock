import { LobbyingBoard } from "@/components/policy/lobbying-board"

const title = "Clients"
const description = "Every client that has paid a registered firm to lobby Congress, and what it reported."

export const metadata = { title, description }

export default function Page() {
  return (
    <LobbyingBoard
      title={title}
      description={description}
      slug="/docs/lobbying/clients"
      kind="clients"
      previous={{ name: "Lobbying", url: "/docs/lobbying" }}
      next={{ name: "Lobbyists", url: "/docs/lobbying/lobbyists" }}
    />
  )
}
