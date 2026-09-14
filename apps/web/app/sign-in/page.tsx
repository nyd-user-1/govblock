import { SignPage, type SignSearch } from "@/components/sign-page"

// /sign-in (Brendan, 2026-09-14): the hero with Sign-In alone, then the
// login form; a signed-in reader goes to /home.
export const metadata = { title: "Sign in", description: "Sign in so what you connect follows you instead of this browser." }
export const dynamic = "force-dynamic"

export default function SignInPage({ searchParams }: { searchParams: SignSearch }) {
  return <SignPage stage="sign-in" searchParams={searchParams} />
}
