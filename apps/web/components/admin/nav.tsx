"use client"

import * as React from "react"

// Where the Admin experience is, and how to move: the page after `admin/` in
// the URL, and the writer that changes it. Every link inside the experience
// goes through this, so the rail, the breadcrumb and a card's "View all" are
// one navigation, never three.

export type AdminNav = { page: string; go: (page: string) => void; /** The crumb's root: the dashboards menu (Brendan, 2026-09-07). */ home?: () => void }

const Ctx = React.createContext<AdminNav>({ page: "", go: () => {} })

export const AdminNavProvider = Ctx.Provider

export function useAdminNav() {
  return React.useContext(Ctx)
}

/** A plain link inside the experience: a button that moves the stage. */
export function AdminLink({ page, className, children, ...props }: { page: string } & Omit<React.ComponentProps<"button">, "onClick">) {
  const { go } = useAdminNav()
  return (
    <button type="button" className={className} onClick={() => go(page)} {...props}>
      {children}
    </button>
  )
}
