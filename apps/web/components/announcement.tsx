import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { Badge } from "@govblock/ui/components/ny4/badge"

export function Announcement() {
  return (
    <Badge asChild variant="secondary" className="bg-muted">
      <Link href="/workspace/data">
        Build Your Own <ArrowRightIcon />
      </Link>
    </Badge>
  )
}
