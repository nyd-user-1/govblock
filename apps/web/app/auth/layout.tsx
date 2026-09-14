import { RailsFrame } from "@/components/rails-frame"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <RailsFrame>{children}</RailsFrame>
}
