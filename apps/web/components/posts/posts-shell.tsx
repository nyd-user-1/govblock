"use client"

import { CalendarShell } from "@/components/calendar/calendar-shell"

import { LinkedInProvider, usePostSource } from "./post-source"
import { PostsRail } from "./posts-rail"

export function PostsShell({ children }: { children: React.ReactNode }) {
  return (
    <LinkedInProvider>
      <CalendarShell base="/posts" title="LinkedIn Posts" rail={<PostsRail />} useSource={usePostSource}>
        {children}
      </CalendarShell>
    </LinkedInProvider>
  )
}
