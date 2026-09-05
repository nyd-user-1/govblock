import { cn } from "@govblock/ui/lib/utils"
import { HeadingAnchor } from "@/components/heading-anchor"

// The prose pieces the docs pages use from livingston-v3's mdx-components:
// a heading that carries its own anchor, and a table that scrolls sideways.

function getNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(getNodeText).join("")
  if (node && typeof node === "object" && "props" in node) return getNodeText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children)
  return ""
}

export function headingId(children: React.ReactNode) {
  const id = getNodeText(children).trim().replace(/\s+/g, "-").replace(/'/g, "").replace(/\?/g, "").toLowerCase()
  return id || undefined
}

// text-2xl: the page's name is text-3xl and its sections sit one step under
// it, as shadcn's docs headings do (Brendan, 2026-09-05).
export function H2({ children, id, className, ...props }: React.ComponentProps<"h2">) {
  const hid = id ?? headingId(children)
  return (
    <h2 id={hid} className={cn("text-2xl", className)} {...props}>
      <HeadingAnchor id={hid}>{children}</HeadingAnchor>
    </h2>
  )
}

export function H3({ children, id, ...props }: React.ComponentProps<"h3">) {
  const hid = id ?? headingId(children)
  return (
    <h3 id={hid} {...props}>
      <HeadingAnchor id={hid}>{children}</HeadingAnchor>
    </h3>
  )
}

export function Table(props: React.ComponentProps<"table">) {
  return (
    <div className="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table {...props} />
    </div>
  )
}

export function Callout({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(
        "not-typeset mt-6 w-auto rounded-2xl border border-surface bg-surface px-4 py-3 text-sm text-surface-foreground md:-mx-1 **:[code]:border",
        className
      )}
      {...props}
    >
      <div data-slot="alert-description" className="text-card-foreground/80 [&_p]:leading-relaxed">
        {children}
      </div>
    </div>
  )
}
