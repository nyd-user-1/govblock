import { Avatar, AvatarFallback } from "@govblock/ui/components/avatar"

import { cn } from "@/lib/utils"

// A connection wearing its own colours. Slack's quadricolour hash, Discord's
// blurple — a grayscale mark is a service nobody recognises at a glance, and
// recognising it at a glance is the entire job of a logo.
//
// The mark is positioned absolutely, and the reason is four attempts long. The
// Avatar root is a flex row: an image and a fallback rendered together sit side
// by side and the second falls out of a 24-pixel box. Clipping hid the logo
// entirely. Pinning both children left it low. Moving it inside AvatarFallback
// looked right in a screenshot and was still eight pixels down — measured, not
// eyeballed, after Brendan spotted it again on /connectors.
//
// Taking it out of flow ends the argument: the fallback fills the box, the mark
// centres inside it, and nothing about the primitive's own layout can push it
// anywhere. Measured after: image centre equals avatar centre.

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
      className={cn("relative size-6 shrink-0 rounded-md bg-white", !live && "opacity-50", className)}
      style={{ boxShadow: `inset 0 0 0 1px ${tint}33` }}
    >
      <AvatarFallback
        className="absolute inset-0 flex items-center justify-center rounded-md bg-white p-0.5 text-[10px] font-semibold"
        style={{ color: tint }}
      >
        <img src={logo} alt={name} className="block max-h-full max-w-full object-contain" />
      </AvatarFallback>
    </Avatar>
  )
}
