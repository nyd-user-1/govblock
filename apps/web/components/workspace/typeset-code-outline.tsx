"use client"

import * as React from "react"
import { LoadingFlag } from "@/components/loading-flag"
import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import type { OutlineItem } from "@/lib/xml/code-outline"
import { workHref } from "@/lib/xml/library"
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// The section sidebar (Brendan's road test, 2026-09-14, item 5: "a section
// sidebar for the Library, like the Git view's outline"), in the rail of the
// Library page and the Work page. A code, a US Code title or a constitution
// shows its own outline, its articles and chapters with their sections
// (/api/typeset/outline); a bill's Work shows the levels the reader draws,
// read the way the file row's Outline reads them (typeset-file-chrome.tsx).
// Rows are the Git outline's rows.

const ROW = "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-muted data-[active=true]:bg-yellow-300/40"

type Node = { item: OutlineItem; children: Node[] }

/** The flat list as a tree: an item holds the items after it that sit deeper. */
function treeOf(items: OutlineItem[]): Node[] {
  const roots: Node[] = []
  const stack: Node[] = []
  for (const item of items) {
    const node = { item, children: [] }
    while (stack.length && stack[stack.length - 1].item[0] >= item[0]) stack.pop()
    ;(stack.length ? stack[stack.length - 1].children : roots).push(node)
    stack.push(node)
  }
  return roots
}

const holds = (node: Node, address: string | null): boolean => !!address && (node.item[3] === address || node.children.some((c) => holds(c, address)))

function OutlineNode({ node, current, depth }: { node: Node; current: string | null; depth: number }) {
  const [label, heading, address] = [node.item[1], node.item[2], node.item[3]]
  const [open, setOpen] = React.useState(() => holds(node, current) && node.item[3] !== current)
  const active = !!address && address === current
  const row = React.useRef<HTMLAnchorElement>(null)
  React.useEffect(() => {
    if (active) row.current?.scrollIntoView({ block: "center" })
  }, [active])
  const indent = { paddingLeft: `${0.5 + depth * 0.75}rem` }
  if (!node.children.length) {
    const text = (
      <>
        <span className="shrink-0 font-mono text-muted-foreground">{label}</span>
        {heading && <span className="truncate">{heading}</span>}
      </>
    )
    return address ? (
      <Link ref={row} href={workHref(address)} data-active={active} className={ROW} style={indent} title={heading ? `${label} ${heading}` : label}>
        {text}
      </Link>
    ) : (
      <div className={cn(ROW, "cursor-default text-muted-foreground hover:bg-transparent")} style={indent} title="Not in the XML store yet">
        {text}
      </div>
    )
  }
  return (
    <>
      <button type="button" className={ROW} style={indent} onClick={() => setOpen((o) => !o)} aria-expanded={open} title={heading ? `${label} ${heading}` : label}>
        <ChevronRightIcon className={cn("-ml-1 size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="shrink-0 font-medium">{label}</span>
        {heading && <span className="truncate text-muted-foreground">{heading}</span>}
      </button>
      {open && node.children.map((child, i) => <OutlineNode key={`${child.item[1]}-${child.item[3] ?? i}`} node={child} current={current} depth={depth + 1} />)}
    </>
  )
}

/** A code's outline, the open section marked and its article opened. */
export function CodeOutlineGroup({ prefix, current = null }: { prefix: string; current?: string | null }) {
  const [items, setItems] = React.useState<OutlineItem[] | null>(null)
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => {
    let live = true
    setItems(null)
    setFailed(false)
    fetch(`/api/typeset/outline?${new URLSearchParams({ prefix })}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ items: OutlineItem[] }>) : Promise.reject(new Error(String(r.status)))))
      .then((body) => live && setItems(body.items))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [prefix])
  const tree = React.useMemo(() => (items ? treeOf(items) : []), [items])
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Sections</SidebarGroupLabel>
      <SidebarGroupContent>
        {!items ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">{failed ? "The outline could not be read." : <LoadingFlag width={28} />}</p>
        ) : tree.length ? (
          tree.map((node, i) => <OutlineNode key={`${node.item[1]}-${node.item[3] ?? i}`} node={node} current={current} depth={0} />)
        ) : (
          <p className="px-2 py-1 text-xs text-muted-foreground">No sections.</p>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

type Heading = { label: string; depth: number; node: Element }

/** The levels the XML reader draws on this page, as the file row's Outline reads them. */
function usePageHeadings() {
  const [headings, setHeadings] = React.useState<Heading[]>([])
  React.useEffect(() => {
    let timer = 0
    const read = () => {
      const reader = document.querySelector("[data-xml-reader]")
      if (!reader) return
      const out: Heading[] = []
      for (const node of reader.querySelectorAll(".uslm-big, .uslm-primary")) {
        if (out.length >= 800 || (node as HTMLElement).offsetParent === null) continue
        const label = [node.querySelector(":scope > .uslm-num")?.textContent, node.querySelector(":scope > .uslm-heading")?.textContent].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
        if (label) out.push({ label, depth: node.classList.contains("uslm-big") ? 1 : 2, node })
      }
      setHeadings(out)
    }
    read()
    // The reader once it is on the page; the page until then.
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        read()
        const reader = document.querySelector("[data-xml-reader]")
        if (reader && watching !== reader) {
          observer.disconnect()
          observer.observe(reader, { subtree: true, childList: true })
          watching = reader
        }
      }, 300)
    })
    let watching: Element | null = document.querySelector("[data-xml-reader]")
    observer.observe(watching ?? document.body, { subtree: true, childList: true })
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [])
  return headings
}

/** A bill's Work: the page's own outline. */
export function PageOutlineGroup() {
  const headings = usePageHeadings()
  if (!headings.length) return null
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Sections</SidebarGroupLabel>
      <SidebarGroupContent>
        {headings.map((h, i) => (
          <button key={`${i}-${h.label}`} type="button" className={ROW} style={{ paddingLeft: `${0.5 + (h.depth - 1) * 0.75}rem` }} onClick={() => h.node.scrollIntoView({ block: "start", behavior: "smooth" })}>
            <span className="truncate">{h.label}</span>
          </button>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
