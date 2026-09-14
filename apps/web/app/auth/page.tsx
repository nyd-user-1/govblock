import { SignPage, type SignSearch } from "@/components/sign-page"

// The account surface: the hero with its three buttons, and with ?signout
// the way out. A signed-in reader is otherwise sent on (components/sign-page.tsx).
export const metadata = { title: "Account", description: "Sign in so what you connect follows you instead of this browser." }
export const dynamic = "force-dynamic"

export default function AuthPage({ searchParams }: { searchParams: SignSearch }) {
  return <SignPage stage="auth" searchParams={searchParams} />
}
