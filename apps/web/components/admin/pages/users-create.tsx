"use client"

import * as React from "react"
import { ArrowUpIcon } from "lucide-react"

import { PageTitle } from "@/components/admin/page-title"
import { useAdminNav } from "@/components/admin/nav"
import { Avatar, AvatarFallback } from "@govblock/ui/components/nova/avatar"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { Input } from "@govblock/ui/components/nova/input"
import { Label } from "@govblock/ui/components/nova/label"
import { NativeSelect, NativeSelectOption } from "@govblock/ui/components/nova/native-select"
import { Switch } from "@govblock/ui/components/ny4/switch"
import { Textarea } from "@govblock/ui/components/nova/textarea"

// paceui's Create User, rebuilt from its rendered page: five sections of a
// form beside a preview card that updates as you type.

type Form = { first: string; last: string; email: string; phone: string; bio: string; title: string; role: string; department: string; manager: string; timezone: string; location: string; employeeId: string; joined: string; language: string; timeout: string; password: string; confirm: string; active: boolean; welcome: boolean; mfa: boolean }

const EMPTY: Form = { first: "", last: "", email: "", phone: "", bio: "", title: "", role: "", department: "", manager: "", timezone: "", location: "", employeeId: "", joined: "", language: "", timeout: "", password: "", confirm: "", active: true, welcome: true, mfa: false }

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  )
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "flex flex-col gap-2 sm:col-span-2" : "flex flex-col gap-2"}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Pick({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
      <NativeSelectOption value="">{placeholder}</NativeSelectOption>
      {options.map((o) => (
        <NativeSelectOption key={o} value={o}>
          {o}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

export function UsersCreatePage() {
  const { go } = useAdminNav()
  const [f, setF] = React.useState<Form>(EMPTY)
  const set = (k: keyof Form) => (v: string | boolean) => setF((o) => ({ ...o, [k]: v }))
  const name = `${f.first} ${f.last}`.trim() || "New User"
  const initials = (f.first[0] ?? "U") + (f.last[0] ?? "")

  return (
    <div>
      <PageTitle title="Create User" links={[{ label: "Users", page: "apps/users" }]} />
      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4 sm:gap-5">
          <Section title="Personal Information" description="Basic identity details for the new team member">
            <F label="First Name">
              <Input value={f.first} onChange={(e) => set("first")(e.target.value)} />
            </F>
            <F label="Last Name">
              <Input value={f.last} onChange={(e) => set("last")(e.target.value)} />
            </F>
            <F label="Email Address">
              <Input type="email" value={f.email} onChange={(e) => set("email")(e.target.value)} />
            </F>
            <F label="Phone (Optional)">
              <Input value={f.phone} onChange={(e) => set("phone")(e.target.value)} />
            </F>
            <F label="Bio" full>
              <Textarea value={f.bio} onChange={(e) => set("bio")(e.target.value)} rows={3} />
            </F>
          </Section>
          <Section title="Role & Organization" description="Assign position, department, and workspace preferences">
            <F label="Job Title">
              <Input value={f.title} onChange={(e) => set("title")(e.target.value)} />
            </F>
            <F label="Role">
              <Pick value={f.role} onChange={set("role")} placeholder="Select role" options={["admin", "editor", "viewer", "member"]} />
            </F>
            <F label="Department">
              <Pick value={f.department} onChange={set("department")} placeholder="Select department" options={["Engineering", "Design", "Marketing", "Sales", "Policy"]} />
            </F>
            <F label="Reporting Manager">
              <Pick value={f.manager} onChange={set("manager")} placeholder="Select manager" options={["Alice Johnson", "Diana Prince", "George Clooney"]} />
            </F>
            <F label="Timezone">
              <Pick value={f.timezone} onChange={set("timezone")} placeholder="Select timezone" options={["(GMT-08:00) Pacific Time", "(GMT-05:00) Eastern Time", "(GMT+00:00) UTC", "(GMT+01:00) Central European"]} />
            </F>
            <F label="Office Location">
              <Pick value={f.location} onChange={set("location")} placeholder="Select location" options={["Albany", "New York", "Washington", "Remote"]} />
            </F>
          </Section>
          <Section title="Employment Details" description="Employee identification and scheduling information">
            <F label="Employee ID (Optional)">
              <Input value={f.employeeId} onChange={(e) => set("employeeId")(e.target.value)} />
            </F>
            <F label="Joining Date">
              <Input type="date" value={f.joined} onChange={(e) => set("joined")(e.target.value)} />
            </F>
            <F label="Preferred Language">
              <Pick value={f.language} onChange={set("language")} placeholder="Select language" options={["English", "Spanish", "French"]} />
            </F>
            <F label="Session Timeout">
              <Pick value={f.timeout} onChange={set("timeout")} placeholder="Select timeout" options={["15 minutes", "1 hour", "8 hours", "Never"]} />
            </F>
          </Section>
          <Section title="Security & Credentials" description="Set password and configure account security settings">
            <F label="Password">
              <Input type="password" value={f.password} onChange={(e) => set("password")(e.target.value)} />
            </F>
            <F label="Confirm Password">
              <Input type="password" value={f.confirm} onChange={(e) => set("confirm")(e.target.value)} />
            </F>
          </Section>
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Account status, notifications, and authentication controls</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {[
                { k: "active" as const, t: "Active Account", d: "User can sign in and access the platform" },
                { k: "welcome" as const, t: "Welcome Email", d: "Send credentials via welcome email" },
                { k: "mfa" as const, t: "Multi-Factor Authentication", d: "Require MFA for enhanced security" },
              ].map((p) => (
                <div key={p.k} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{p.t}</p>
                    <p className="text-xs text-muted-foreground">{p.d}</p>
                  </div>
                  <Switch checked={f[p.k]} onCheckedChange={(v) => set(p.k)(v)} />
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Review all sections before creating the user account.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setF(EMPTY)}>
                Reset
              </Button>
              <Button onClick={() => go("apps/users")}>Create User</Button>
            </div>
          </div>
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => document.querySelector("[data-slot=block-shell] [data-slot=sidebar-inset] > div:last-child")?.scrollTo({ top: 0, behavior: "smooth" })}>
              <ArrowUpIcon className="size-3.5" />
              Back to top
            </Button>
          </div>
        </div>
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 text-center">
              <Avatar size="lg" className="size-16">
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{name}</p>
                <p className="text-xs text-muted-foreground">{f.title || "No title"}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                <Badge variant="outline" className={f.active ? "text-green-600" : "text-muted-foreground"}>
                  {f.active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="secondary">{f.role || "member"}</Badge>
                <Badge variant="outline">{f.department || "unassigned"}</Badge>
              </div>
              <div className="w-full text-left text-sm">
                {[
                  ["Email", f.email || "no-email@organization.com"],
                  ["Location", f.location || "unassigned"],
                  ["Timezone", f.timezone || "Not set"],
                  ["Reports to", f.manager || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b py-2 last:border-b-0">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="truncate font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Live preview updates as you type</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
