import { redirect } from "next/navigation"

// /plan (2026-09-13): the stub that stood here is /pricing now.
export default function PlanPage() {
  redirect("/pricing")
}
