"use client"

import * as React from "react"
import { CheckIcon, CopyIcon, CreditCardIcon, KeyIcon, PlusIcon, RefreshCwIcon, ShieldCheckIcon, UploadIcon, MonitorIcon, SmartphoneIcon, LaptopIcon } from "lucide-react"

import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { Applicant } from "@/components/admin/pages/applicant"
import { useAdminNav } from "@/components/admin/nav"
import { Avatar, AvatarFallback } from "@govblock/ui/components/nova/avatar"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader } from "@govblock/ui/components/nova/card"
import { Input } from "@govblock/ui/components/nova/input"
import { Label } from "@govblock/ui/components/nova/label"
import { Progress } from "@govblock/ui/components/progress"
import { Switch } from "@govblock/ui/components/ny4/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { Textarea } from "@govblock/ui/components/nova/textarea"
import { cn } from "@govblock/ui/lib/utils"

// paceui's Settings, seven pages under one tab strip, rebuilt from the
// rendered pages with their sample content. The account is the experience's
// demo account; the API page's keys are placeholders, since the site's own
// API needs no key.

export const SETTINGS_TABS = [
  { page: "settings/profile", label: "My profile" },
  { page: "settings/applicant", label: "Applicant" },
  { page: "settings/plan", label: "Plan" },
  { page: "settings/billing", label: "Billing" },
  { page: "settings/notifications", label: "Notifications" },
  { page: "settings/password", label: "Password" },
  { page: "settings/account-security", label: "Account security" },
  { page: "settings/api", label: "API" },
]

function Tabs({ page }: { page: string }) {
  const { go } = useAdminNav()
  return (
    <div className="flex flex-wrap gap-1 border-b">
      {SETTINGS_TABS.map((t) => (
        <button
          key={t.page}
          type="button"
          onClick={() => go(t.page)}
          className={cn("-mb-px border-b-2 px-3 py-2 text-sm transition-colors", page === t.page ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

/** The reader's profile, live (2026-09-11): what onboarding captured, editable here. */
type ProfileRow = { name: string | null; email: string | null; phone: string | null; bio: string | null; home_state: string | null; zip: string | null; role: string | null; organization: string | null; created_at: string | null }

function useProfile() {
  const [profile, setProfile] = React.useState<ProfileRow | null | undefined>(undefined)
  React.useEffect(() => {
    let live = true
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : { profile: null }))
      .then((d: { profile: ProfileRow | null }) => live && setProfile(d.profile))
      .catch(() => live && setProfile(null))
    return () => {
      live = false
    }
  }, [])
  return [profile, setProfile] as const
}

function Profile() {
  const [profile, setProfile] = useProfile()
  const [form, setForm] = React.useState<ProfileRow | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  React.useEffect(() => {
    if (profile !== undefined && form === null) setForm(profile ?? { name: "", email: "", phone: "", bio: "", home_state: null, zip: "", role: "", organization: "", created_at: null })
  }, [profile, form])
  const set = (key: keyof ProfileRow, value: string) => setForm((f) => (f ? { ...f, [key]: value } : f))
  const save = async () => {
    if (!form) return
    setSaving(true)
    const r = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) })
    setSaving(false)
    if (r.ok) {
      const d = (await r.json()) as { profile: ProfileRow }
      setProfile(d.profile)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    }
  }
  const initials = (form?.name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")
  const signedOut = profile === null && form?.email === ""
  const joined = form?.created_at ? new Date(form.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"
  return (
    <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader>
          <CardAnchor>My profile</CardAnchor>
          <CardAction>
            <CardTools />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="size-16">
              <AvatarFallback className="text-lg">{initials || "?"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">Profile photo</p>
              <Button variant="outline" size="sm" className="mt-1 gap-1.5" disabled>
                <UploadIcon className="size-3.5" />
                Upload
              </Button>
            </div>
          </div>
          {signedOut && <p className="text-sm text-muted-foreground">Sign in to edit your profile.</p>}
          <Field label="Full name">
            <Input value={form?.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Email address">
            <Input value={form?.email ?? ""} readOnly className="text-muted-foreground" />
          </Field>
          <Field label="Phone number">
            <Input value={form?.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Home state">
            <Input value={form?.home_state ?? ""} onChange={(e) => set("home_state", e.target.value.toUpperCase().slice(0, 2))} placeholder="NY" />
          </Field>
          <Field label="ZIP">
            <Input value={form?.zip ?? ""} onChange={(e) => set("zip", e.target.value)} />
          </Field>
          <Field label="Organization">
            <Input value={form?.organization ?? ""} onChange={(e) => set("organization", e.target.value)} />
          </Field>
          <Field label="Bio">
            <Textarea value={form?.bio ?? ""} onChange={(e) => set("bio", e.target.value)} rows={3} />
          </Field>
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={save} disabled={saving || signedOut || !form}>
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </Button>
          <Button variant="outline" onClick={() => setForm(profile ?? null)} disabled={!profile}>
            Cancel
          </Button>
        </CardFooter>
      </Card>
      <div className="flex flex-col gap-4 sm:gap-5">
        <Card>
          <CardHeader>
            <CardAnchor>Personal information</CardAnchor>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="text-sm">
            {[
              ["Role", form?.role || "—"],
              ["Organization", form?.organization || "—"],
              ["Home state", form?.home_state || "—"],
              ["ZIP", form?.zip || "—"],
              ["Joined", joined],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b py-2.5 last:border-b-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Plan() {
  const usage = [
    ["Storage", "7.5 GB", "10 GB", 75],
    ["Team members", "8", "10", 80],
    ["Projects", "15", "20", 75],
    ["API calls", "8,450", "10,000", 84],
  ] as const
  const plans = [
    {
      name: "Free",
      price: "$0",
      per: "forever",
      cta: "Downgrade",
      points: ["1 team member", "2 GB storage", "5 projects", "Basic support"],
    },
    {
      name: "Pro",
      price: "$89.99",
      per: "/month",
      cta: "Current",
      current: true,
      points: ["10 team members", "10 GB storage", "20 projects", "Priority support", "API access"],
    },
    {
      name: "Enterprise",
      price: "$249.99",
      per: "/month",
      cta: "Upgrade",
      points: ["Unlimited members", "100 GB storage", "Unlimited projects", "24/7 support", "Custom integrations"],
    },
  ]
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardAnchor>Current plan</CardAnchor>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="flex items-center gap-2 font-medium">
                Pro Plan
                <Badge variant="outline" className="h-5 text-green-600">
                  Active
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground">Billed monthly</p>
            </div>
            <p className="text-2xl font-semibold">
              $89.99
              <span className="text-sm font-normal text-muted-foreground">/month</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardAnchor>Usage overview</CardAnchor>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            {usage.map(([k, used, limit, p]) => (
              <div key={k} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span>{k}</span>
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{used}</span> / {limit}
                  </span>
                </div>
                <Progress value={p} className="**:data-[slot=progress-indicator]:bg-primary *:data-[slot=progress-track]:h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardAnchor>Available plans</CardAnchor>
          <CardAction>
            <CardTools />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className={cn("flex flex-col gap-4 rounded-lg border p-4", p.current && "border-primary")}>
              <div className="flex items-center justify-between">
                <p className="font-medium">{p.name}</p>
                {p.current && <Badge>Current</Badge>}
              </div>
              <p className="text-2xl font-semibold">
                {p.price}
                <span className="text-sm font-normal text-muted-foreground"> {p.per}</span>
              </p>
              <ul className="grid gap-1.5 text-sm">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-center gap-2">
                    <CheckIcon className="size-3.5 text-green-600" />
                    {pt}
                  </li>
                ))}
              </ul>
              <Button variant={p.current ? "secondary" : "outline"} className="mt-auto" disabled={p.current}>
                {p.cta}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function Billing() {
  const cards = [
    { last4: "2735", exp: "08/26", isDefault: true },
    { last4: "8375", exp: "08/26" },
    { last4: "3994", exp: "08/26" },
  ]
  const invoices = [
    ["INV-93900456", "2022/12/02"],
    ["INV-93900357", "2022/11/04"],
    ["INV-38503361", "2022/10/04"],
    ["INV-42275902", "2022/09/02"],
    ["INV-93900456", "2022/08/02"],
    ["INV-38503361", "2022/07/05"],
    ["INV-25748552", "2022/06/03"],
    ["INV-39405536", "2022/05/04"],
    ["INV-42275902", "2022/04/02"],
  ]
  return (
    <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card>
        <CardHeader>
          <CardAnchor>Payment method</CardAnchor>
          <CardAction>
            <CardTools />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3">
          {cards.map((c) => (
            <div key={c.last4} className={cn("flex items-center gap-3 rounded-lg border p-3", c.isDefault && "border-primary")}>
              <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                <CreditCardIcon className="size-4" />
              </div>
              <div className="grow text-sm">
                <p className="font-medium">XXXX XXXX XXXX {c.last4}</p>
                <p className="text-xs text-muted-foreground">Expiry date: {c.exp}</p>
              </div>
              <Button variant="link" size="xs">
                {c.isDefault ? "Remove from default" : "Set as default"}
              </Button>
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </div>
          ))}
          <Button variant="outline" className="gap-1.5">
            <PlusIcon className="size-4" />
            Add new payment method
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardAnchor>Billing history</CardAnchor>
          <CardAction>
            <CardTools />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>Invoice</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(([id, d], i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{id}</TableCell>
                  <TableCell>89.99EUR</TableCell>
                  <TableCell>{d}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="h-5 text-green-600">
                      Paid
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Notifications() {
  const channels = [
    ["Email notifications", "Receive notifications via email", true],
    ["Push notifications", "Receive push notifications on your device", true],
    ["SMS notifications", "Receive text message alerts", false],
  ] as const
  const types = [
    ["Security alerts", "Login attempts and password changes", true],
    ["Product updates", "New features and improvements", true],
    ["Team activity", "Member joins, leaves, and role changes", false],
    ["Marketing", "Tips, offers, and product news", false],
    ["Weekly digest", "Summary of your weekly activity", true],
  ] as const
  const Row = ({ t, d, on }: { t: string; d: string; on: boolean }) => (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{t}</p>
        <p className="text-xs text-muted-foreground">{d}</p>
      </div>
      <Switch defaultChecked={on} />
    </div>
  )
  return (
    <div className="grid gap-4 sm:gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardAnchor>Notification channels</CardAnchor>
          <CardAction>
            <CardTools />
          </CardAction>
        </CardHeader>
        <CardContent className="divide-y">
          {channels.map(([t, d, on]) => (
            <Row key={t} t={t} d={d} on={on} />
          ))}
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4 sm:gap-5">
        <Card>
          <CardHeader>
            <CardAnchor>Notification types</CardAnchor>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="divide-y">
            {types.map(([t, d, on]) => (
              <Row key={t} t={t} d={d} on={on} />
            ))}
          </CardContent>
        </Card>
        <Card className="bg-muted/40">
          <CardHeader>
            <CardAnchor>Email digest preference</CardAnchor>
            <CardDescription>Weekly digests are sent every Monday at 9:00 AM in your local timezone.</CardDescription>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}

function Password() {
  const sessions = [
    {
      icon: LaptopIcon,
      name: "MacBook Pro",
      where: "San Francisco, CA",
      when: "Now",
      current: true,
    },
    {
      icon: SmartphoneIcon,
      name: "iPhone 15 Pro",
      where: "San Francisco, CA",
      when: "2 hours ago",
    },
    {
      icon: MonitorIcon,
      name: "Windows Desktop",
      where: "New York, NY",
      when: "3 days ago",
    },
  ]
  return (
    <div className="grid gap-4 sm:gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardAnchor>Change password</CardAnchor>
          <CardAction>
            <CardTools />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Current password">
            <Input type="password" />
          </Field>
          <Field label="New password">
            <Input type="password" />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" />
          </Field>
        </CardContent>
        <CardFooter>
          <Button>Update password</Button>
        </CardFooter>
      </Card>
      <div className="flex flex-col gap-4 sm:gap-5">
        <Card>
          <CardHeader>
            <CardAnchor>Password requirements</CardAnchor>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {["Minimum 8 characters", "At least one uppercase letter", "At least one lowercase letter", "At least one number", "At least one special character"].map((r) => (
                <li key={r} className="flex items-center gap-2">
                  <CheckIcon className="size-3.5 text-green-600" />
                  {r}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardAnchor>Active sessions</CardAnchor>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            {sessions.map((s) => (
              <div key={s.name} className="flex items-center gap-3 text-sm">
                <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                  <s.icon className="size-4" />
                </div>
                <div className="grow">
                  <p className="flex items-center gap-2 font-medium">
                    {s.name}
                    {s.current && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        This device
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.where} - {s.when}
                  </p>
                </div>
                {!s.current && (
                  <Button variant="outline" size="sm">
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AccountSecurity() {
  const codes = ["A7K2-M9X4", "B3P8-N5R1", "C6Q1-W2Y7", "D9S4-T8V3", "E2U7-F5Z6", "G8H1-J4L9"]
  const logins = [
    ["MacBook Pro", "San Francisco, CA", "2024/01/15", "Success"],
    ["iPhone 15 Pro", "San Francisco, CA", "2024/01/14", "Success"],
    ["Unknown Device", "London, UK", "2024/01/13", "Blocked"],
    ["Windows Desktop", "New York, NY", "2024/01/12", "Success"],
    ["Android Phone", "Berlin, DE", "2024/01/10", "Blocked"],
    ["MacBook Pro", "San Francisco, CA", "2024/01/09", "Success"],
  ]
  return (
    <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-4 sm:gap-5">
        <Card>
          <CardHeader>
            <CardAnchor>Two-factor authentication</CardAnchor>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                <ShieldCheckIcon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">2FA via authenticator</p>
                <p className="text-xs text-muted-foreground">Currently disabled</p>
              </div>
            </div>
            <Switch />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardAnchor>Backup codes</CardAnchor>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {codes.map((c) => (
              <code key={c} className="rounded-md bg-muted px-2 py-1.5 text-center font-mono text-xs">
                {c}
              </code>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" className="gap-1.5">
              <RefreshCwIcon className="size-3.5" />
              Regenerate codes
            </Button>
          </CardFooter>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardAnchor>Login activity</CardAnchor>
          <CardAction>
            <CardTools />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>Device</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logins.map(([d, l, t, s], i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{d}</TableCell>
                  <TableCell>{l}</TableCell>
                  <TableCell>{t}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("h-5", s === "Success" ? "text-green-600" : "text-destructive")}>
                      {s}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Api() {
  const keys = [
    ["Production", "pk_live_••••••••••••3a9f", "2024/01/05", "2 min ago"],
    ["Development", "pk_test_••••••••••••7b2c", "2023/11/20", "1 hour ago"],
    ["Staging", "pk_stag_••••••••••••4e1d", "2023/09/14", "5 days ago"],
  ]
  return (
    <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader>
          <CardAnchor>API keys</CardAnchor>
          <CardAction>
            <CardTools className="gap-2">
              <Button size="sm" className="gap-1.5">
                <PlusIcon className="size-3.5" />
                Create new key
              </Button>
            </CardTools>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3">
          {keys.map(([n, k, c, u]) => (
            <div key={n} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                <KeyIcon className="size-4" />
              </div>
              <div className="min-w-0 grow">
                <p className="text-sm font-medium">{n}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{k}</p>
                <p className="text-[11px] text-muted-foreground">
                  Created {c} - Last used {u}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Copy">
                <CopyIcon className="size-4" />
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            GovBlock's own API needs no key: every route under <code className="rounded bg-muted px-1">/api/policy</code> is open. See the API docs for the routes.
          </p>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4 sm:gap-5">
        <Card>
          <CardHeader>
            <CardAnchor>API usage</CardAnchor>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              ["Requests today", "1,247"],
              ["Avg response time", "124ms"],
              ["Success rate", "99.8%"],
              ["Rate limit", "10,000/day"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="text-lg font-semibold">{v}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardAnchor>Webhook endpoint</CardAnchor>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Endpoint URL">
              <div className="flex gap-2">
                <Input defaultValue="https://hooks.example.com/govblock" />
                <Button variant="outline">Verify</Button>
              </div>
            </Field>
            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">Connection status</p>
                <p className="text-xs text-muted-foreground">Active - Last ping 2 min ago</p>
              </div>
              <Badge variant="outline" className="h-5 text-green-600">
                Connected
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function SettingsPage({ page }: { page: string }) {
  const current = SETTINGS_TABS.some((t) => t.page === page) ? page : "settings/profile"
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <p className="text-lg font-medium sm:text-xl">Settings</p>
      <Tabs page={current} />
      {current === "settings/profile" && <Profile />}
      {current === "settings/applicant" && <Applicant />}
      {current === "settings/plan" && <Plan />}
      {current === "settings/billing" && <Billing />}
      {current === "settings/notifications" && <Notifications />}
      {current === "settings/password" && <Password />}
      {current === "settings/account-security" && <AccountSecurity />}
      {current === "settings/api" && <Api />}
    </div>
  )
}
