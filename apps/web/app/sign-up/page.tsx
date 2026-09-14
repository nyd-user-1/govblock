import { SignPage, type SignSearch } from "@/components/sign-page"

// /sign-up (Brendan, 2026-09-14): the hero with Sign-Up alone, the sign-up
// form, and the whole onboarding once the magic link lands at #welcome.
export const metadata = { title: "Sign up", description: "An account, so what you connect follows you instead of this browser." }
export const dynamic = "force-dynamic"

export default function SignUpPage({ searchParams }: { searchParams: SignSearch }) {
  return <SignPage stage="sign-up" searchParams={searchParams} />
}
