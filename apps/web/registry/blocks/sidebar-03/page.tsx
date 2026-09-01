import { ChamberBoard } from "@/components/policy/chamber-board"

// A rail-and-cards instance; the page is a thin mount so both registries'
// copies of this block render the same surface.
export default function Page() {
  return <ChamberBoard />
}
