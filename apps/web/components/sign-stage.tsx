"use client"

import * as React from "react"
import { motion } from "motion/react"

import { FlagLoader } from "@/components/flag-loader"
import ParticleMark from "@/components/flag-particles"
import { Motto } from "@/components/motto"
import { SignForm, type Mode } from "@/components/sign-forms"
import { AlertsPreview, BLANK, DEV_PREFILL, DeskPreview, RepresentativesPreview, stepOneDone, WelcomeClose, WelcomeStepOne, WelcomeStepTwo, type Profile } from "@/components/welcome-steps"
import { Button } from "@govblock/ui/components/nova/button"

import { cacheAccount } from "@/lib/auth/use-account"
import { stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"

// The hero (Brendan, 2026-09-13): the flag dead centre, the motto under it,
// the buttons under that. Sign-Up or Sign-In smoothly scrolls the page to
// the section below, which becomes the form that was asked for — login-05 or
// signup-05 — and the address takes a hash, #sign-in or #sign-up, so a
// reload or a link lands on the same form. The form emails a magic link;
// opening it brings a new reader to /sign-up#welcome, where the welcome
// steps wait: the form, then the people who sit for the address, then the
// interests, the desk, the alerts, and the close.
//
// One hero, four pages (Brendan, 2026-09-14): the root wears no buttons
// (the flag and the motto under the particle scroller); /sign-up wears
// Sign-Up alone and holds the whole onboarding; /sign-in wears Sign-In alone
// and its form, and a signed-in reader is sent to /home; /auth keeps the
// three and its scroll. The form's cross-link on /sign-in or /sign-up goes
// to the other page.
export type Stage = "root" | "sign-up" | "sign-in" | "auth"

export function SignStage({
  stage = "auth",
  welcome,
  email,
  saved: savedInitial,
  google,
  interests,
}: {
  stage?: Stage
  /** Signed in with no finished profile: the welcome steps are on the page from the start and the sign-in buttons are not. */
  welcome: boolean
  /** The signed-in reader's address, for the welcome form. */
  email: string
  /** What the reader saved before, so a reload picks the steps up where they were. */
  saved?: Partial<Profile> & { lng?: number | null; lat?: number | null }
  google?: () => Promise<void>
  interests: readonly string[]
}) {
  const [mode, setMode] = React.useState<Mode | null>(null)
  const section = React.useRef<HTMLElement | null>(null)
  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }))

  const choose = (next: Mode) => {
    // The root sends each button to its page; a sign page sends the other
    // form's cross-link to the other page, with the hash that opens it.
    if (stage === "root") return window.location.assign(`/${next}`)
    if (stage !== "auth" && next !== stage) return window.location.assign(`/${next}#${next}`)
    setMode(next)
    window.history.replaceState(null, "", `#${next}`)
    scrollTo(section)
  }
  // No buttons on the root (Brendan, 2026-09-14): the flag and the motto alone, dissolving into the scroller's sand; the header's Sign In is the way in.
  const shows = (button: Mode | "explore") => stage === "auth" || button === stage

  // The order of arrival (Brendan, 2026-09-13): the state flags cycle while the
  // field loads; the flag comes first, once its particles are on screen and the
  // loader has had at least 700ms — a cached load would otherwise flash it —
  // and the words and buttons follow it.
  const [flagReady, setFlagReady] = React.useState(false)
  const [minimum, setMinimum] = React.useState(false)
  React.useEffect(() => {
    const id = window.setTimeout(() => setMinimum(true), 700)
    return () => window.clearTimeout(id)
  }, [])
  const flagIn = flagReady && minimum
  // A plain fade, nothing moves (Brendan, 2026-09-13): a second long, easing out.
  const arrive = { initial: { opacity: 0 }, transition: { duration: 1, ease: "easeOut" as const } }

  // The welcome form, in two steps.
  const [profile, setProfile] = React.useState<Profile | null>(() => {
    if (!welcome) return null
    const { lng: _lng, lat: _lat, ...rest } = savedInitial ?? {}
    const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null && v !== undefined))
    // Nothing saved yet: in development the form arrives filled (DEV_PREFILL).
    const prefill = Object.keys(clean).length === 0 && DEV_PREFILL ? DEV_PREFILL : {}
    return { ...BLANK, ...prefill, ...clean, email }
  })
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((f) => (f ? { ...f, [key]: value } : f))
  const third = React.useRef<HTMLElement | null>(null)
  const fourth = React.useRef<HTMLElement | null>(null)
  const [stepTwo, setStepTwo] = React.useState(false)
  React.useEffect(() => {
    if (!stepTwo && profile && stepOneDone(profile)) setStepTwo(true)
  }, [profile, stepTwo])

  // Saved as it is typed (Brendan, 2026-09-13): the moment step one is
  // complete, and after every later change with a short pause, so nothing a
  // reader has given is lost if they never reach the end. The home state
  // rides the session the instant it is saved; the closing section, still to
  // come, is what marks the profile finished.
  const { setState: setJurisdiction } = useJurisdiction()
  // What came back from the server counts as saved, so a reload does not re-save it.
  const [saved, setSaved] = React.useState<Profile | null>(() => (profile && savedInitial && stepOneDone(profile) ? profile : null))
  /** The address as a point, from the last save: what the representatives are drawn from. */
  const [point, setPoint] = React.useState<{ lng: number; lat: number } | null>(() => (savedInitial?.lng != null && savedInitial?.lat != null ? { lng: savedInitial.lng, lat: savedInitial.lat } : null))
  const save = React.useCallback(async (p: Profile) => {
    let where: { lng: number; lat: number } | null = null
    if (p.zip || p.address) {
      try {
        const r = (await (await fetch(`/api/map/geocode?q=${encodeURIComponent([p.address, stateName(p.home_state ?? undefined), p.zip].filter(Boolean).join(" "))}`)).json()) as { match?: { lng: number; lat: number } | null }
        where = r.match ?? null
      } catch {}
    }
    setPoint(where)
    const r = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...p, ...(where ?? {}), complete: false }) })
    if (!r.ok) return
    setSaved(p)
    if (p.home_state) {
      cacheAccount({ home: p.home_state })
      setJurisdiction(p.home_state, { force: true })
    }
  }, [setJurisdiction])
  React.useEffect(() => {
    if (!profile || !stepOneDone(profile) || profile === saved) return
    const first = saved === null
    const id = window.setTimeout(() => void save(profile), first ? 0 : 800)
    return () => window.clearTimeout(id)
  }, [profile, saved, save])

  // The previews and the close, after Interests; the close is the one
  // Finish: it marks the profile complete and goes home.
  const [previews, setPreviews] = React.useState(false)
  const fifth = React.useRef<HTMLElement | null>(null)
  React.useEffect(() => {
    if (previews) scrollTo(fifth)
  }, [previews])
  /** Next, on a preview: the section below it. */
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  const [finishing, setFinishing] = React.useState(false)
  const finish = async () => {
    if (!profile) return
    setFinishing(true)
    const r = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...profile, complete: true }) })
    if (!r.ok) return setFinishing(false)
    if (profile.home_state) cacheAccount({ home: profile.home_state })
    window.location.assign("/home")
  }
  // The scroll waits for the section to be in the tree; before, it asked for
  // it in the same beat it was created and found nothing to scroll to.
  React.useEffect(() => {
    if (stepTwo) scrollTo(fourth)
  }, [stepTwo])

  // The hash on arrival: a form to open, or the welcome step the link landed on.
  React.useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "")
    if (hash === "sign-in" || hash === "sign-up") {
      if (!welcome) choose(hash)
    } else if (hash === "welcome" && welcome) {
      scrollTo(third)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className="flex min-h-[calc(100svh-var(--header-height))] flex-col items-center justify-center p-6">
        <div className="relative aspect-[1.9] w-full max-w-[760px]">
          {/* Mounted from the start so it loads under the loader; shown once it is ready. */}
          <motion.div {...arrive} animate={flagIn ? { opacity: 1 } : { opacity: 0 }} className="absolute inset-0">
            <ParticleMark fit={1} className="absolute inset-0" onReady={() => setFlagReady(true)} />
          </motion.div>
          {!flagIn && (
            <div className="absolute inset-0 flex items-center justify-center">
              <FlagLoader width={96} />
            </div>
          )}
        </div>
        <motion.div {...arrive} animate={flagIn ? { opacity: 1 } : { opacity: 0 }} transition={{ ...arrive.transition, delay: 0.45 }} className="flex flex-col items-center">
          <Motto />
          {/* The flag's own red and blue, the mark's colours (Brendan, 2026-09-13); Explore has nowhere to go yet. */}
          <div className="mt-10 flex items-center gap-3">
            {!welcome && shows("sign-up") && (
              <Button size="lg" onClick={() => choose("sign-up")} className="bg-[#b31942] text-white hover:bg-[#b31942]/90">
                Sign-Up
              </Button>
            )}
            {!welcome && shows("sign-in") && (
              <Button variant="outline" size="lg" onClick={() => choose("sign-in")}>
                Sign-In
              </Button>
            )}
            {shows("explore") && (
              <Button size="lg" type="button" className="bg-[#0a3161] text-white hover:bg-[#0a3161]/90">
                Explore
              </Button>
            )}
          </div>
        </motion.div>
      </div>
      {mode && !welcome && (
        <motion.section ref={section} id={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={arrive.transition} className="flex min-h-[calc(100svh-var(--header-height))] scroll-mt-(--header-height) items-center justify-center p-6">
          <SignForm mode={mode} onSwitch={choose} google={google} className="w-full max-w-sm" />
        </motion.section>
      )}
      {profile && (
        <motion.section ref={third} id="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={arrive.transition} className="flex min-h-[calc(100svh-var(--header-height))] scroll-mt-(--header-height) items-center justify-center p-6">
          <WelcomeStepOne form={profile} set={set} onSkip={() => setStepTwo(true)} onNext={() => setStepTwo(true)} />
        </motion.section>
      )}
      {profile && stepTwo && (
        <motion.section ref={fourth} id="representatives" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={arrive.transition} className="flex min-h-[calc(100svh-var(--header-height))] scroll-mt-(--header-height) items-center justify-center p-6">
          <RepresentativesPreview form={profile} point={point} onNext={() => go("interests")} />
        </motion.section>
      )}
      {profile && stepTwo && (
        <section id="interests" className="flex min-h-[calc(100svh-var(--header-height))] scroll-mt-(--header-height) items-center justify-center p-6">
          <WelcomeStepTwo form={profile} set={set} interests={interests} onNext={() => setPreviews(true)} />
        </section>
      )}
      {profile && previews && (
        <>
          <motion.section ref={fifth} id="desk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={arrive.transition} className="flex min-h-[calc(100svh-var(--header-height))] scroll-mt-(--header-height) items-center justify-center p-6">
            <DeskPreview form={profile} onNext={() => go("alerts")} />
          </motion.section>
          <section id="alerts" className="flex min-h-[calc(100svh-var(--header-height))] scroll-mt-(--header-height) items-center justify-center p-6">
            <AlertsPreview form={profile} onNext={() => go("done")} />
          </section>
          <section id="done" className="flex min-h-[calc(100svh-var(--header-height))] scroll-mt-(--header-height) items-center justify-center p-6">
            <WelcomeClose form={profile} onFinish={finish} busy={finishing} />
          </section>
        </>
      )}
    </>
  )
}
