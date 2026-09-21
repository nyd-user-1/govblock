"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search, XIcon } from "lucide-react"

import { SearchPanel, useSearchEngine, warmFlags } from "@/components/command-menu"
import { SEARCH_OPEN } from "@/components/page-rise"
import { FlagChip } from "@/components/policy/imagery"
import { SEARCH_SECTION_ID, goToSection } from "@/components/root-sections"
import { STATE_NAMES } from "@/lib/filters"
import { KIND_LABELS, parseQuery, withoutChip, type SearchKind } from "@/lib/search-query"
import { cn } from "@govblock/ui/lib/utils"
import { Command, CommandRawInput } from "@govblock/ui/components/nova/command"
import { Kbd } from "@govblock/ui/components/nova/kbd"

// The big search under the greeting (Brendan, 2026-09-07: Cloudflare's
// account home). The bar is the site's search itself, not a button to the
// ⌘K dialog: focus it and the results drop down from it, and ⌘K on the
// account home lands here, ahead of the header's dialog. Forty pixels tall
// (Brendan, 2026-09-07).
//
// For a morning on 2026-09-21 the bar only opened the dialog, because this
// bar and the dialog had drifted apart — the dialog had learned `/` and `@`
// and the bar had not. Brendan asked for the drop-down back the same day,
// "keep the changes to the engine": so the drop-down is the dialog's own
// engine and panel (useSearchEngine and SearchPanel, components/
// command-menu.tsx) in another frame — the grammar, the chips, the doors, the
// narrowed results — and there is nothing here to drift. The root's section
// two wears the same bar, for the comparison.
//
// Under it, a few searches to try, centred. They were the typed text and a
// gloss of the grammar ("artificial intelligence /ny — Words, in one state");
// Brendan, 2026-09-21: "replace them with something that is more illustrative
// and easier to understand". So each shows the bar as it will stand — the
// scopes as the chips they become, the rest as typed — and says what comes
// back, and a click sets the bar just so and drops the results. Congress
// leads because it is open to a reader who has not signed in; a state's lists
// wait for one who has. Every one answers with results (checked 2026-09-21).
type Example = { where?: string; kind?: SearchKind; words?: string; gloss: string }
const EXAMPLES: Example[] = [
  { where: "US", kind: "members", gloss: "Every member of Congress" },
  { where: "US", kind: "bills", words: "artificial intelligence", gloss: "This Congress's bills on artificial intelligence" },
  { where: "NY", kind: "committees", gloss: "Every New York committee" },
  { words: "@schumer", gloss: "A member, by name" },
  { words: "/us/usc/t26", gloss: "Title 26 of the U.S. Code" },
]
const CHIP = "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary"

// A scope that has been typed and let go of (Brendan, 2026-09-21): "/ak" and then a space, or Enter, and the chip is
// in the bar — as the bill file's box holds "bill:H.R. 5345" — with the box clear for the words. What the engine
// reads is the chips' tokens and the words together, so it is the same search typed out. Backspace on an empty box
// takes the last chip back.
type Held = { where: string | null; kind: SearchKind | null; inCommittee: boolean }
const NONE: Held = { where: null, kind: null, inCommittee: false }
const tokensOf = (held: Held) => [held.where ? `/${held.where.toLowerCase()}` : "", held.kind && !held.inCommittee ? `/${held.kind}` : "", held.inCommittee ? "@committee" : ""].filter(Boolean)

/** `hotkey` off leaves ⌘K to the header's dialog, for a bar that is not at the top of its page: the root's section two, the root's frozen sheet. */
export function HomeSearch({ hotkey = true }: { hotkey?: boolean } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [term, setTerm] = React.useState("")
  const [held, setHeld] = React.useState<Held>(NONE)
  const [tips, setTips] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const full = [...tokensOf(held), term].join(" ").trimStart()
  const engine = useSearchEngine(open, full)

  /** The scope tokens in what is typed move into the bar as chips; true if any did. */
  const commit = (text: string) => {
    const found = parseQuery(text).chips.filter((chip) => (chip.key === "where" ? !held.where : chip.key === "kind" ? !held.kind : !held.inCommittee))
    if (!found.length) return false
    const next = { ...held }
    let rest = text
    // Last first, so each chip's place in the text still holds when it is cut out.
    for (const chip of [...found].sort((a, b) => b.start - a.start)) {
      if (chip.key === "where") next.where = chip.state ?? null
      else if (chip.key === "kind") next.kind = (Object.keys(KIND_LABELS) as SearchKind[]).find((k) => KIND_LABELS[k] === chip.label) ?? null
      else next.inCommittee = true
      rest = withoutChip(rest, chip)
    }
    setHeld(next)
    setTerm(rest)
    return true
  }
  const typed = (next: string) => {
    // A space after a token lets go of it.
    if (next.endsWith(" ") && next.length > term.length && commit(next)) return
    setTerm(next)
  }
  const chipsHeld: { key: keyof Held; label: string; state?: string }[] = [
    ...(held.where ? [{ key: "where" as const, label: held.where === "US" ? "U.S. Congress" : STATE_NAMES[held.where], state: held.where }] : []),
    ...(held.kind && !held.inCommittee ? [{ key: "kind" as const, label: KIND_LABELS[held.kind] }] : []),
    ...(held.inCommittee ? [{ key: "inCommittee" as const, label: "In committee" }] : []),
  ]
  const drop = (key: keyof Held) => setHeld((h) => ({ ...h, [key]: key === "inCommittee" ? false : null }))

  // ⌘K here focuses the bar. The header's dialog listens on the document, so
  // this listens on the window in the capture phase and stops the key there.
  React.useEffect(() => {
    if (!hotkey) return
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        event.stopPropagation()
        input.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", down, true)
    return () => window.removeEventListener("keydown", down, true)
  }, [hotkey])

  // "/" from anywhere on the page goes to the bar (Brendan, 2026-09-21), as it does on GitHub: the key itself is not
  // typed, and it is left alone wherever the reader is already typing. On the root the bar is a screen down, so the
  // page goes to its section as the hero's arrow would. Where two bars are mounted — the root's and its sheet's — the
  // first to hear the key keeps it.
  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      const bar = input.current
      if (!bar) return
      event.preventDefault()
      bar.focus({ preventScroll: true })
      setOpen(true)
      if (bar.closest(`#${SEARCH_SECTION_ID}`)) goToSection(SEARCH_SECTION_ID)
      else bar.scrollIntoView({ behavior: "smooth", block: "center" })
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [])

  // A page change closes the list; so does a choice from it.
  React.useEffect(() => setOpen(false), [pathname])
  const close = () => {
    setOpen(false)
    input.current?.blur()
  }
  // The page chosen rises into place under the header, as the next section of a long page would scroll into view
  // (components/page-rise.tsx), and its address is warmed the moment it is chosen.
  const go = (href: string) => {
    close()
    setTerm("")
    setHeld(NONE)
    router.prefetch(href)
    router.push(href, { transitionTypes: [SEARCH_OPEN] })
  }
  const suggest = (example: Example) => {
    setHeld({ ...NONE, where: example.where ?? null, kind: example.kind ?? null })
    setTerm(example.words ?? "")
    input.current?.focus()
    setOpen(true)
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Command
        shouldFilter={false}
        value={engine.selected}
        onValueChange={engine.setSelected}
        className="relative w-full overflow-visible rounded-none! bg-transparent p-0 text-foreground"
        onFocusCapture={() => {
          warmFlags()
          setOpen(true)
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") close()
        }}
      >
        <label
          className={cn(
            "flex h-10 w-full cursor-text items-center gap-3 rounded-xl border bg-background px-3 text-[15px] shadow-xs ring-4 ring-muted/60 transition-[box-shadow,border-color]",
            open && "border-ring/60 ring-ring/15"
          )}
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          {chipsHeld.map((chip) => (
            <span key={chip.key} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 py-0.5 pr-1 pl-2 text-xs font-medium whitespace-nowrap text-primary">
              {chip.state && <FlagChip state={chip.state} width={16} />}
              {chip.label}
              <button type="button" aria-label={`Remove ${chip.label}`} onMouseDown={(event) => event.preventDefault()} onClick={() => drop(chip.key)} className="rounded-full p-0.5 hover:bg-primary/15">
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          <CommandRawInput
            ref={input}
            value={term}
            onValueChange={typed}
            onKeyDown={(event) => {
              // Enter on a token alone lets go of it too, before it can choose a row; Backspace on an empty box takes the last chip back.
              if (event.key === "Enter" && term.trim() && commit(term)) {
                event.preventDefault()
                event.stopPropagation()
              } else if (event.key === "Backspace" && !term && chipsHeld.length) {
                drop(chipsHeld[chipsHeld.length - 1].key)
              }
            }}
            placeholder="Search"
            aria-label="Search"
            className="h-full min-w-0 flex-1 bg-transparent text-foreground outline-hidden placeholder:text-muted-foreground"
          />
          <span className="flex items-center gap-1">
            <Kbd className="border bg-background">⌘</Kbd>
            <Kbd className="border bg-background">K</Kbd>
          </span>
        </label>
        {open && (
          // The list keeps the bar's focus: a press inside it must not blur the
          // input, or the list would close before the click landed on a row.
          <div
            className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border bg-popover text-left text-popover-foreground shadow-lg [&_[cmdk-item]]:py-2"
            onMouseDown={(event) => event.preventDefault()}
          >
            <SearchPanel engine={engine} term={full} setTerm={setTerm} go={go} listClassName="max-h-[420px]" chips={false} />
            {/* The foot, as the bill file's box has it (components/policy/file-row.tsx): the syntax tips at the left, the keys at the right. */}
            <div className="flex items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
              <button type="button" className="text-primary hover:underline" aria-expanded={tips} onClick={() => setTips((t) => !t)}>
                Search syntax tips
              </button>
              <span className="ml-auto flex items-center gap-1">
                <Kbd className="border bg-background">↑</Kbd>
                <Kbd className="border bg-background">↓</Kbd> to navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd className="border bg-background">↵</Kbd> to select
              </span>
            </div>
            {tips && (
              <div className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <p className="m-0">
                  <span className="font-mono text-primary">/ny</span> narrows to one jurisdiction, by its letters or its name. <span className="font-mono text-primary">/bills</span>, <span className="font-mono text-primary">/laws</span>, <span className="font-mono text-primary">/members</span>, <span className="font-mono text-primary">/committees</span> and{" "}
                  <span className="font-mono text-primary">/sessions</span> keep one kind, and beside a jurisdiction list it. <span className="font-mono text-primary">/809</span> finds a bill by its number, <span className="font-mono text-primary">/us/usc/t26</span> a law by its address.{" "}
                  <span className="font-mono text-primary">@martinez</span> finds a member or a committee; <span className="font-mono text-primary">@committee</span> keeps the bills that sit in one. A space or Enter after a scope puts it in the bar; Backspace on an empty box takes it back; Escape closes.
                </p>
              </div>
            )}
          </div>
        )}
      </Command>
      <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-2 p-0">
        {EXAMPLES.map((example) => (
          <li key={example.gloss} className="m-0 p-0">
            <button
              type="button"
              onClick={() => suggest(example)}
              className="inline-flex items-center gap-2 rounded-full border bg-background py-1 pr-3 pl-1.5 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {example.where && (
                <span className={CHIP}>
                  <FlagChip state={example.where} width={16} />
                  {example.where === "US" ? "U.S. Congress" : STATE_NAMES[example.where]}
                </span>
              )}
              {example.kind && <span className={CHIP}>{KIND_LABELS[example.kind]}</span>}
              {example.words && <span className={cn("font-mono font-medium text-foreground", !example.where && "pl-1.5")}>{example.words}</span>}
              {example.gloss}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
