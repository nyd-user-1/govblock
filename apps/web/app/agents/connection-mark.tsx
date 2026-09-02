import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/avatar"

import { cn } from "@/lib/utils"

// A connection wearing its own colours. Slack's quadricolour hash, Discord's
// blurple, Drive's tricolour — a grayscale mark is a service nobody recognises
// at a glance, and recognising it at a glance is the entire job of a logo.
//
// It is the shadcn Avatar rather than a bare <img> so the fallback is real: an
// asset that fails to load leaves the service's initial in its brand colour,
// not a broken-image glyph. The ring is the brand tint at low opacity, which
// keeps the mark legible on both themes without tinting the mark itself.

export function ConnectionMark({
  name,
  logo,
  tint,
  className,
  live = true,
}: {
  name: string
  logo: string
  tint: string
  className?: string
  /** A connection that is not live reads as dimmed rather than absent. */
  live?: boolean
}) {
  return (
    <Avatar
      className={cn("size-6 rounded-md bg-white p-0.5", !live && "opacity-50", className)}
      style={{ boxShadow: `inset 0 0 0 1px ${tint}33` }}
    >
      <AvatarImage src={logo} alt={name} className="object-contain" />
      <AvatarFallback
        className="rounded-md text-[10px] font-semibold"
        style={{ color: tint }}
      >
        {name.slice(0, 1)}
      </AvatarFallback>
    </Avatar>
  )
}
