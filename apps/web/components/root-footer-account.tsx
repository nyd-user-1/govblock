"use client"

import * as React from "react"
import Link from "next/link"

import { useAccount } from "@/lib/auth/use-account"
import { Button } from "@govblock/ui/components/nova/button"
import { Input } from "@govblock/ui/components/input"
import { Separator } from "@govblock/ui/components/nova/separator"

// The footer's card: the way into an account (or back to it), the subscribe
// field — the home page's Subscribe card's endpoint, /api/subscribe, which
// keeps the address and sends nothing yet — and where the project lives.

const GitHubMark = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.74-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
  </svg>
)
const XMark = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
  </svg>
)

export function FooterAccount({ github, twitter }: { github: string; twitter: string }) {
  const { signedIn } = useAccount()
  const [email, setEmail] = React.useState("")
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "error">("idle")
  const [message, setMessage] = React.useState<string | null>(null)
  const subscribe = async (event: React.FormEvent) => {
    event.preventDefault()
    if (state === "busy") return
    setState("busy")
    try {
      const response = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, topics: ["bills", "committees", "members"] }) })
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? "That did not go through.")
      setState("done")
      setMessage(`${email} is on the list.`)
      setEmail("")
    } catch (error) {
      setState("error")
      setMessage(error instanceof Error ? error.message : "That did not go through.")
    }
  }
  return (
    <div className="flex h-fit flex-col gap-6 rounded-2xl bg-muted p-6">
      <Link href={signedIn ? "/home" : "/sign-in"} className="w-fit text-lg font-medium text-foreground underline underline-offset-4">
        {signedIn ? "Account Home" : "Sign In or Create Account"}
      </Link>
      <Separator />
      <form onSubmit={subscribe} className="flex flex-col gap-2">
        <label htmlFor="footer-subscribe" className="text-sm font-medium">
          New bills, hearings and votes, by email.
        </label>
        <div className="flex gap-2">
          <Input id="footer-subscribe" type="email" required autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background" />
          <Button type="submit" disabled={state === "busy"}>
            Subscribe
          </Button>
        </div>
        {message && (
          <p role="status" className={state === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {message}
          </p>
        )}
      </form>
      <Separator />
      <div className="flex items-center gap-4 text-foreground">
        <a href={github} target="_blank" rel="noreferrer" aria-label="GovBlock on GitHub" className="transition-opacity hover:opacity-70">
          <GitHubMark className="size-5" />
        </a>
        <a href={twitter} target="_blank" rel="noreferrer" aria-label="GovBlock on X" className="transition-opacity hover:opacity-70">
          <XMark className="size-5" />
        </a>
      </div>
    </div>
  )
}
