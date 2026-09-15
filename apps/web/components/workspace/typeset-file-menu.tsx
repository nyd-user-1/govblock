"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { LIBRARY_ROOT } from "@/lib/xml/library"
import { TYPESET_VIEWS, typesetHref, type TypesetView } from "@/lib/typeset/views"
import { Button } from "@govblock/ui/components/nova/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"

// File, at the front of every toolbar (Brendan, 2026-09-15, Google Docs'
// File menu as the comp): the seven views live here now, not as numbers in
// the footer. The bill chrome says which bill and view the toolbar sits on;
// on a statute or a fork there is no bill, so only the Library opens.

type FileContext = { billId: number; view: TypesetView } | null
const Ctx = React.createContext<FileContext>(null)

export function TypesetFileProvider({ billId, view, children }: { billId: number; view: TypesetView; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ billId, view }), [billId, view])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function FileMenu() {
  const router = useRouter()
  const file = React.useContext(Ctx)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 font-medium">
          File <ChevronDownIcon className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-max min-w-44 rounded-lg">
        {TYPESET_VIEWS.map((option, i) => {
          const current = file?.view === option.key
          const open = option.key === "library" ? () => router.push(file ? typesetHref(file.billId, "library") : LIBRARY_ROOT) : file ? () => router.push(typesetHref(file.billId, option.key)) : undefined
          const Icon = option.icon
          return (
            <DropdownMenuItem key={option.key} disabled={!open} onClick={open} className="whitespace-nowrap">
              <Icon className="size-4 text-muted-foreground" />
              <span className="mr-2 font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              {option.label}
              {current && <CheckIcon className="ml-auto size-4" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
