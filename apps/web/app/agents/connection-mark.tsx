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
      className={cn(
        // overflow-hidden and the padding on the image rather than the box: the
        // Avatar root is a flex container and a padded box with a size-full
        // child pushes the mark out from under itself.
        "size-6 shrink-0 overflow-hidden rounded-md bg-white",
        !live && "opacity-50",
        className
      )}
      style={{ boxShadow: `inset 0 0 0 1px ${tint}33` }}
    >
      <AvatarImage src={logo} alt={name} className="size-full rounded-md object-contain p-0.5" />
      <AvatarFallback
        className="rounded-md text-[10px] font-semibold"
        style={{ color: tint }}
      >
        {name.slice(0, 1)}
      </AvatarFallback>
    </Avatar>
  )
}
