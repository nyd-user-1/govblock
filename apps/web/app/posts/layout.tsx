import { redirect } from "next/navigation"

import { adminId } from "@/lib/linkedin/session"
import { PostsShell } from "@/components/posts/posts-shell"

export const metadata = { title: "LinkedIn Posts" }

// /posts: the calendar, over LinkedIn posts instead of hearings. It posts as
// a real person and a real company, so it is an admin's alone.
export default async function PostsLayout({ children }: { children: React.ReactNode }) {
  if (!(await adminId())) redirect("/sign-in")
  return <PostsShell>{children}</PostsShell>
}
