import { LobbyingBoard } from "@/components/policy/lobbying-board"

const title = "Lobbying"
const description = "Every firm registered to lobby Congress, and who it is paid to speak for."

export const metadata = { title, description }

export default function Page() {
  return (
    <LobbyingBoard
      title={title}
      description={description}
      slug="/lobbying"
      kind="firms"
      previous={{ name: "Finance", url: "/money" }}
      next={{ name: "Clients", url: "/lobbying/clients" }}
    />
  )
}
