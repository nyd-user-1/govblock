"use client"

import * as React from "react"

import { AnimateIcon } from "@govblock/ui/components/animate-ui/icons/icon"
import { LogoMark } from "@/components/logo-mark"
import { Button } from "@govblock/ui/components/nova/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@govblock/ui/components/nova/field"
import { Input } from "@govblock/ui/components/nova/input"
import { cn } from "@govblock/ui/lib/utils"

import { sendLink } from "@/app/actions/sign-in"
import type { RequestLinkResult } from "@/lib/auth/email-link"

// shadcn's login-05 and signup-05 (Brendan, 2026-09-13), on the site's parts:
// the mark that moves where Acme's icon stood, "Welcome to govBlocks", and the
// two forms differing only in their verb and their cross-link. Either one
// emails a magic link (app/actions/sign-in.ts) and then says so in place.

const Apple = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden>
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" fill="currentColor" />
  </svg>
)

const Google = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden>
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="currentColor" />
  </svg>
)

export type Mode = "sign-in" | "sign-up"

const REASONS: Record<Exclude<RequestLinkResult, { ok: true }>["reason"], string> = {
  invalid: "That does not look like an email address.",
  "too-soon": "A link is already on its way. Give it a minute before asking for another.",
  "send-failed": "The link could not be sent just now. Try again in a moment.",
}

export function SignForm({ mode, onSwitch, google, className, ...props }: React.ComponentProps<"div"> & { mode: Mode; /** The cross-link under the title: the other form. */ onSwitch: (mode: Mode) => void; /** The server action that starts the Google handoff, when the page has one. */ google?: () => Promise<void> }) {
  const signUp = mode === "sign-up"
  const id = `${mode}-email`
  const [email, setEmail] = React.useState("")
  const [pending, start] = React.useTransition()
  const [sent, setSent] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setError(null)
    start(async () => {
      const r = await sendLink(form)
      if (r.ok) setSent(String(form.get("email") ?? ""))
      else setError(REASONS[r.reason])
    })
  }
  if (sent) {
    return (
      <div className={cn("flex flex-col items-center gap-3 text-center", className)} {...props}>
        <AnimateIcon animateOnHover>
          <div className="flex size-8 items-center justify-center rounded-md">
            <LogoMark className="size-7" aria-hidden />
          </div>
        </AnimateIcon>
        <h1 className="text-xl font-bold">Check your email</h1>
        <p className="text-muted-foreground">
          A sign-in link is on its way to <span className="font-medium text-foreground">{sent}</span>. Open it and you are in.
        </p>
        <button type="button" onClick={() => setSent(null)} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Use a different address
        </button>
      </div>
    )
  }
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={submit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <AnimateIcon animateOnHover>
              <div className="flex size-8 items-center justify-center rounded-md">
                <LogoMark className="size-7" aria-hidden />
              </div>
            </AnimateIcon>
            <h1 className="text-xl font-bold">Welcome to govBlocks</h1>
            <FieldDescription>
              {signUp ? "Already have an account? " : "Don't have an account? "}
              <button type="button" onClick={() => onSwitch(signUp ? "sign-in" : "sign-up")} className="underline underline-offset-4 hover:text-foreground">
                {signUp ? "Sign in" : "Sign up"}
              </button>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor={id}>Email</FieldLabel>
            <Input id={id} name="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : signUp ? "Create Account" : "Login"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </Field>
        </FieldGroup>
      </form>
      {/* Outside the email form: a form may not nest a form, and Google's button is one. */}
      <FieldGroup>
        <FieldSeparator>Or</FieldSeparator>
        <Field className="grid gap-4 sm:grid-cols-2">
          <Button variant="outline" type="button">
            <Apple />
            Continue with Apple
          </Button>
          {google ? (
            <form action={google} className="contents">
              <Button variant="outline" type="submit">
                <Google />
                Continue with Google
              </Button>
            </form>
          ) : (
            <Button variant="outline" type="button">
              <Google />
              Continue with Google
            </Button>
          )}
        </Field>
      </FieldGroup>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
