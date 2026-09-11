"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { STATE_CODES, STATE_NAMES, stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { ACCOUNT_CACHE_KEY } from "@/lib/auth/use-account"
import { Button } from "@govblock/ui/components/nova/button"
import { Checkbox } from "@govblock/ui/components/nova/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@govblock/ui/components/nova/field"
import { Input } from "@govblock/ui/components/nova/input"
import { NativeSelect, NativeSelectOption } from "@govblock/ui/components/nova/native-select"
import { Textarea } from "@govblock/ui/components/nova/textarea"
import { cn } from "@govblock/ui/lib/utils"

// Onboarding (Brendan, 2026-09-11): the one form a new reader meets after
// sign-in, on the login form's parts. It asks for the home state above all —
// the second entitlement beside Congress — and for whatever else a desk can
// use: where they are, what they do, what they follow. Saved to the profile;
// the home state goes into the session and becomes the header's flag.

export type OnboardingInitial = { name: string; email: string; home_state: string | null; zip: string | null; address: string | null; role: string | null; organization: string | null; phone: string | null; interests: string[]; brief_opt_in: boolean; bio: string | null }

export function Onboarding({ initial, roles, interests }: { initial: OnboardingInitial; roles: readonly string[]; interests: readonly string[] }) {
  const router = useRouter()
  const { setState } = useJurisdiction()
  const [form, setForm] = React.useState(initial)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const set = <K extends keyof OnboardingInitial>(key: K, value: OnboardingInitial[K]) => setForm((f) => ({ ...f, [key]: value }))
  const toggle = (interest: string) => set("interests", form.interests.includes(interest) ? form.interests.filter((i) => i !== interest) : [...form.interests, interest])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.home_state) return setError("Choose your home state.")
    setBusy(true)
    setError(null)
    // The address to a point, when one was given; not a condition of finishing.
    let where: { lng: number; lat: number } | null = null
    if (form.zip || form.address) {
      try {
        const r = (await (await fetch(`/api/map/geocode?q=${encodeURIComponent([form.address, stateName(form.home_state), form.zip].filter(Boolean).join(" "))}`)).json()) as { match?: { lng: number; lat: number } | null }
        where = r.match ?? null
      } catch {}
    }
    const r = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, ...(where ?? {}), complete: true }) })
    if (!r.ok) {
      setBusy(false)
      return setError("That did not save. Try again in a moment.")
    }
    // The header's flag follows the home state, and the tab's cached account is stale until the next read.
    try {
      sessionStorage.removeItem(ACCOUNT_CACHE_KEY)
    } catch {}
    setState(form.home_state)
    router.push("/home")
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="ob-name">Your name</FieldLabel>
          <Input id="ob-name" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="ob-email">Email</FieldLabel>
          <Input id="ob-email" value={form.email} readOnly className="text-muted-foreground" />
        </Field>
        <Field>
          <FieldLabel htmlFor="ob-state">Home state</FieldLabel>
          <NativeSelect id="ob-state" value={form.home_state ?? ""} onChange={(e) => set("home_state", e.target.value || null)} required>
            <NativeSelectOption value="">Choose a state…</NativeSelectOption>
            {[...STATE_CODES, "DC"].map((code) => (
              <NativeSelectOption key={code} value={code}>
                {STATE_NAMES[code]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>Congress is open to everyone. Your home state opens with it.</FieldDescription>
        </Field>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Field>
            <FieldLabel htmlFor="ob-address">Street address</FieldLabel>
            <Input id="ob-address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" placeholder="Optional" />
          </Field>
          <Field>
            <FieldLabel htmlFor="ob-zip">ZIP</FieldLabel>
            <Input id="ob-zip" value={form.zip ?? ""} onChange={(e) => set("zip", e.target.value)} inputMode="numeric" autoComplete="postal-code" placeholder="10001" />
          </Field>
        </div>
        <FieldDescription className="-mt-2">Your address finds your districts and the people who represent you. It stays yours.</FieldDescription>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ob-role">You are</FieldLabel>
            <NativeSelect id="ob-role" value={form.role ?? ""} onChange={(e) => set("role", e.target.value || null)}>
              <NativeSelectOption value="">Choose one…</NativeSelectOption>
              {roles.map((r) => (
                <NativeSelectOption key={r} value={r}>
                  {r}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="ob-org">Organization</FieldLabel>
            <Input id="ob-org" value={form.organization ?? ""} onChange={(e) => set("organization", e.target.value)} autoComplete="organization" placeholder="Optional" />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="ob-phone">Phone</FieldLabel>
          <Input id="ob-phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} type="tel" autoComplete="tel" placeholder="Optional" />
        </Field>
        <Field>
          <FieldLabel>What you follow</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => {
              const on = form.interests.includes(interest)
              return (
                <button key={interest} type="button" aria-pressed={on} onClick={() => toggle(interest)} className={cn("rounded-full border px-3 py-1 text-sm transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>
                  {interest}
                </button>
              )
            })}
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="ob-bio">About you</FieldLabel>
          <Textarea id="ob-bio" value={form.bio ?? ""} onChange={(e) => set("bio", e.target.value)} rows={3} placeholder="Optional" />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <Checkbox checked={form.brief_opt_in} onCheckedChange={(v) => set("brief_opt_in", !!v)} />
          Send me the weekly brief for my home state.
        </label>
      </FieldGroup>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Saving…" : "Finish"}
      </Button>
    </form>
  )
}
