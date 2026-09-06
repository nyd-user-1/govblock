"use client"

import * as React from "react"
import { CheckCircle2Icon, ShieldCheckIcon, SmartphoneIcon } from "lucide-react"

import { useAdminNav } from "@/components/admin/nav"
import { Avatar, AvatarFallback } from "@govblock/ui/components/nova/avatar"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardContent } from "@govblock/ui/components/nova/card"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { Input } from "@govblock/ui/components/nova/input"
import { Label } from "@govblock/ui/components/nova/label"

// paceui's three authentication variants, six pages each, rebuilt from the
// rendered pages. Variant 1 is the split layout with a testimonial, 2 the
// bare centred card, 3 the account card for a known user. They open on the
// stage rather than a new tab, and every link moves within the variant.

type Kind = "login" | "register" | "forgot-password" | "reset-password" | "verify-email" | "2-factor-authentication"

function Field({ label, type = "text", placeholder }: { label: string; type?: string; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Input type={type} placeholder={placeholder} />
    </div>
  )
}

function Social({ names }: { names: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {names.map((n) => (
        <Button key={n} variant="outline">
          {n}
        </Button>
      ))}
    </div>
  )
}

function Or({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px grow bg-border" />
      {text}
      <span className="h-px grow bg-border" />
    </div>
  )
}

function Foot({ text, link, page }: { text: string; link: string; page: string }) {
  const { go } = useAdminNav()
  return (
    <p className="text-center text-sm text-muted-foreground">
      {text}{" "}
      <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => go(page)}>
        {link}
      </button>
    </p>
  )
}

// ── Variant 1 ───────────────────────────────────────────────────────────

function V1({ kind, v }: { kind: Kind; v: number }) {
  const { go } = useAdminNav()
  const p = (k: Kind) => `auth-${v}/${k}`
  const body: Record<Kind, React.ReactNode> = {
    login: (
      <>
        <Head title="Welcome Back" text="Please enter your details to sign in to your workspace" />
        <Social names={["Google", "GitHub"]} />
        <Or text="Or continue with email" />
        <Field label="Email Address" type="email" />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Password</Label>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => go(p("forgot-password"))}>
              Forgot password?
            </button>
          </div>
          <Input type="password" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox /> Remember this device
        </label>
        <Button size="lg" onClick={() => go("")}>
          Sign In to Dashboard
        </Button>
        <Foot text="Don't have an account?" link="Request access" page={p("register")} />
      </>
    ),
    register: (
      <>
        <Head title="Start Your Free Trial" text="Enter your details to create your workspace account" />
        <Social names={["Google", "GitHub"]} />
        <Or text="Or continue with email" />
        <Field label="Full Name" />
        <Field label="Email Address" type="email" />
        <Field label="Password" type="password" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox /> I agree to the Terms of Service & Privacy Policy
        </label>
        <Button size="lg" onClick={() => go(p("verify-email"))}>
          Create Free Account
        </Button>
        <Foot text="Already have an account?" link="Sign in" page={p("login")} />
      </>
    ),
    "forgot-password": (
      <>
        <Head title="Reset Password" text="Enter your account email to receive a password reset link" />
        <Field label="Email Address" type="email" />
        <Button size="lg" onClick={() => go(p("reset-password"))}>
          Send Instructions
        </Button>
        <Foot text="Remember your password?" link="Sign in" page={p("login")} />
      </>
    ),
    "reset-password": (
      <>
        <Head title="Set New Password" text="Choose a strong password for your workspace account" />
        <Field label="New Password" type="password" />
        <Field label="Confirm Password" type="password" />
        <Button size="lg" onClick={() => go(p("login"))}>
          Save New Password
        </Button>
        <Foot text="Back to" link="Sign in" page={p("login")} />
      </>
    ),
    "verify-email": (
      <>
        <Head title="Verify Email Address" text="Enter the confirmation code sent to your registered email to continue" />
        <Field label="6-Digit Verification Code" placeholder="000000" />
        <Button size="lg" onClick={() => go("")}>
          Confirm & Complete Trial Setup
        </Button>
        <Foot text="Didn't get code?" link="Resend Email" page={p("verify-email")} />
      </>
    ),
    "2-factor-authentication": (
      <>
        <Head title="2FA Verification" text="Enter the security code generated by your authenticator app" />
        <Field label="6-Digit Code" placeholder="000000" />
        <Button size="lg" onClick={() => go("")}>
          Authenticate Account
        </Button>
        <Foot text="Lost device?" link="Enter Backup Code" page={p("2-factor-authentication")} />
      </>
    ),
  }
  return (
    <div className="grid min-h-[70vh] overflow-hidden rounded-xl border lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="flex w-full max-w-sm flex-col gap-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheckIcon className="size-4" />
            </div>
            <span className="font-semibold">Auth</span>
          </div>
          {body[kind]}
        </div>
      </div>
      <div className="flex flex-col justify-between gap-8 bg-muted p-8 max-lg:hidden sm:p-12">
        <p className="text-sm font-medium text-muted-foreground">Trusted by 10,000+ teams</p>
        <blockquote className="text-2xl leading-snug font-medium">"PaceUI transformed our entire workflow. We shipped 3x faster with absolute consistency across all our enterprise applications."</blockquote>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>SC</AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <p className="font-medium">Sarah Chen</p>
            <p className="text-muted-foreground">VP of Engineering at TechFlow</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            ["+148%", "Productivity Boost"],
            ["99.99%", "Uptime SLA"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-lg border bg-background p-4">
              <p className="text-2xl font-semibold">{v}</p>
              <p className="text-xs text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Head({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

// ── Variant 2 ───────────────────────────────────────────────────────────

function V2({ kind, v }: { kind: Kind; v: number }) {
  const { go } = useAdminNav()
  const p = (k: Kind) => `auth-${v}/${k}`
  const body: Record<Kind, React.ReactNode> = {
    login: (
      <>
        <Head title="Account Access" text="Enter your credentials below" />
        <Field label="Work Email" type="email" />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Password</Label>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => go(p("forgot-password"))}>
              Forgot?
            </button>
          </div>
          <Input type="password" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox /> Remember this browser
        </label>
        <Button size="lg" onClick={() => go("")}>
          Login to Workspace
        </Button>
        <Foot text="Don't have an account?" link="Sign up" page={p("register")} />
      </>
    ),
    register: (
      <>
        <Head title="Create Account" text="Enter your details below to register" />
        <Field label="Full Name" />
        <Field label="Work Email" type="email" />
        <Field label="Password" type="password" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox /> I agree to Terms & Conditions
        </label>
        <Button size="lg" onClick={() => go(p("verify-email"))}>
          Create Free Account
        </Button>
        <Foot text="Already have an account?" link="Sign in" page={p("login")} />
      </>
    ),
    "forgot-password": (
      <>
        <Head title="Recover Password" text="Enter your work email address below" />
        <Field label="Work Email" type="email" />
        <Button size="lg" onClick={() => go(p("reset-password"))}>
          Reset Password
        </Button>
        <Foot text="Remember your password?" link="Sign in" page={p("login")} />
      </>
    ),
    "reset-password": (
      <>
        <Head title="Set New Password" text="Enter your new password below" />
        <Field label="New Password" type="password" />
        <Field label="Confirm Password" type="password" />
        <Button size="lg" onClick={() => go(p("login"))}>
          Save Password
        </Button>
        <Foot text="Back to" link="Sign in" page={p("login")} />
      </>
    ),
    "verify-email": (
      <>
        <Head title="Verify Your Account" text="Enter the 6-digit code sent to your email" />
        <Field label="Security Code" placeholder="000000" />
        <Button size="lg" onClick={() => go("")}>
          Verify Email
        </Button>
        <Foot text="Didn't receive email?" link="Resend Code" page={p("verify-email")} />
      </>
    ),
    "2-factor-authentication": (
      <>
        <Head title="Enter 2FA Code" text="Confirm your identity with your authenticator code" />
        <Field label="2FA Security Code" placeholder="000000" />
        <Button size="lg" onClick={() => go("")}>
          Verify & Proceed
        </Button>
        <Foot text="Lost device?" link="Use Backup Code" page={p("2-factor-authentication")} />
      </>
    ),
  }
  return (
    <div className="flex min-h-[70vh] items-center justify-center rounded-xl border bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-4">{body[kind]}</CardContent>
      </Card>
    </div>
  )
}

// ── Variant 3 ───────────────────────────────────────────────────────────

function V3({ kind, v }: { kind: Kind; v: number }) {
  const { go } = useAdminNav()
  const p = (k: Kind) => `auth-${v}/${k}`
  const who = { name: "Alex Chen", email: "alex.chen@company.com" }
  const copy: Record<Kind, { title: string; text: string; sub: string; cta: string; to: string; alt: string; altTo: string; social?: string; help: string; icon?: React.ReactNode }> = {
    login: { title: "Welcome Back", text: "Re-authenticate to proceed to PaceUI Workspace", sub: who.email, cta: "Continue as Alex", to: "", alt: "Switch or remove account", altTo: p("register"), social: "or sign in with", help: "Enterprise Help Center" },
    register: { title: "Join Your Team", text: "Complete registration to join PaceUI Workspace", sub: "Invited to TechFlow Workspace", cta: "Accept Invite & Create Account", to: p("verify-email"), alt: "Use a different email address", altTo: p("login"), social: "or sign up with", help: "Enterprise Help Center" },
    "forgot-password": { title: "Reset Password", text: "Confirm password reset for your active account session", sub: who.email, cta: "Send Reset Link for Alex", to: p("reset-password"), alt: "Use a different email address", altTo: p("login"), help: "Enterprise Help Center" },
    "reset-password": { title: "Password Reset Complete", text: "Your password has been successfully updated", sub: who.email, cta: "Sign In with New Password", to: p("login"), alt: "Return to Workspace Home", altTo: "", help: "Enterprise Help Center", icon: <CheckCircle2Icon className="size-5 text-green-600" /> },
    "verify-email": { title: "Email Verified!", text: "Your email has been successfully verified for PaceUI Workspace", sub: who.email, cta: "Continue to Dashboard", to: "", alt: "Switch or link another account", altTo: p("login"), help: "Enterprise Help Center", icon: <CheckCircle2Icon className="size-5 text-green-600" /> },
    "2-factor-authentication": { title: "2FA Device Approved", text: "Two-factor authentication prompt approved for active session", sub: "Device: iPhone 15 Pro (Verified)", cta: "Proceed to Workspace", to: "", alt: "Deny request or remove device", altTo: p("login"), help: "Enterprise Security Desk", icon: <SmartphoneIcon className="size-5" /> },
  }
  const c = copy[kind]
  return (
    <div className="flex min-h-[70vh] items-center justify-center rounded-xl border bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 self-start">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheckIcon className="size-4" />
            </div>
            <span className="font-semibold">Auth</span>
          </div>
          <Head title={c.title} text={c.text} />
          <div className="flex w-full items-center gap-3 rounded-lg border p-3 text-left">
            <Avatar>
              <AvatarFallback>AC</AvatarFallback>
            </Avatar>
            <div className="min-w-0 grow text-sm">
              <p className="font-medium">{who.name}</p>
              <p className="truncate text-xs text-muted-foreground">{c.sub}</p>
            </div>
            {c.icon}
          </div>
          <Button size="lg" className="w-full" onClick={() => go(c.to)}>
            {c.cta}
          </Button>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => go(c.altTo)}>
            {c.alt}
          </button>
          {c.social && (
            <div className="flex w-full flex-col gap-3">
              <Or text={c.social} />
              <Social names={["Google", "Apple"]} />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Need assistance? <span className="font-medium text-foreground">{c.help}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

const KINDS: Kind[] = ["login", "register", "forgot-password", "reset-password", "verify-email", "2-factor-authentication"]

export function AuthPage({ page }: { page: string }) {
  const m = /^auth-([123])\/(.+)$/.exec(page)
  const v = m ? Number(m[1]) : 1
  const kind = (m && KINDS.includes(m[2] as Kind) ? m[2] : "login") as Kind
  if (v === 2) return <V2 kind={kind} v={v} />
  if (v === 3) return <V3 kind={kind} v={v} />
  return <V1 kind={kind} v={v} />
}
