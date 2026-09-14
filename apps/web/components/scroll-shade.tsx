"use client"

import * as React from "react"

// Marks <html> with data-scrolled while the page is scrolled past the top
// (Brendan, 2026-09-13), so the sticky header can wear a shadow only once
// something is passing under it.
export function ScrollShade() {
  React.useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      if (window.scrollY > 0) root.setAttribute("data-scrolled", "")
      else root.removeAttribute("data-scrolled")
    }
    apply()
    window.addEventListener("scroll", apply, { passive: true })
    return () => {
      window.removeEventListener("scroll", apply)
      root.removeAttribute("data-scrolled")
    }
  }, [])
  return null
}
