import { redirect } from "next/navigation"
import { getLocalTimeZone, today } from "@internationalized/date"

export default function PostsIndexPage() {
  redirect(`/posts/week/${today(getLocalTimeZone()).toString()}`)
}
