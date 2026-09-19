import { redirect } from "next/navigation"

import { adminId } from "@/lib/linkedin/session"

export const metadata = { title: "Content Calendar" }

// /content-calendar (/posts until 2026-09-18) publishes as a real person and a real company, so it is an admin's alone.
export default async function PostsLayout({ children }: { children: React.ReactNode }) {
  if (!(await adminId())) redirect("/sign-in")
  return children
}
