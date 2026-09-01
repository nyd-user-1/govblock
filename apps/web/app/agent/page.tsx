import { redirect } from "next/navigation"

// The singular is what people type. It used to render an empty shell.
export default function AgentRedirect() {
  redirect("/agents")
}
