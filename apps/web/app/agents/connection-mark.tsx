import { Avatar, AvatarFallback } from "@govblock/ui/components/avatar"

import { cn } from "@/lib/utils"

// A connection wearing its own colours. Slack's quadricolour hash, Discord's
// blurple — a grayscale mark is a service nobody recognises at a glance, and
// recognising it at a glance is the entire job of a logo.
//
// The mark rides inside AvatarFallback rather than AvatarImage, which took
// three tries to get right and is worth writing down: the Avatar root is a
// flex row, so an image and a fallback rendered together sit side by side and
// the second falls out of a 24-pixel box — the logo hanging below its circle.
// Clipping that hid the logo entirely; pinning both children still left the
// image low. The fallback is already `flex size-full items-center
// justify-center`, which is exactly the box a small square mark wants, and
// with no AvatarImage present it is what the primitive renders. If an asset
// ever goes missing the alt text shows in the same place, in the brand colour.
//
// A plain <img>: a 24px static mark that the image optimiser would cost a
// request to serve and save nothing on.

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
      className={cn("size-6 shrink-0 rounded-md bg-white", !live && "opacity-50", className)}
      style={{ boxShadow: `inset 0 0 0 1px ${tint}33` }}
    >
      <AvatarFallback
        className="rounded-md bg-white p-0.5 text-[10px] font-semibold"
        style={{ color: tint }}
      >
        <img src={logo} alt={name} className="size-full object-contain" />
      </AvatarFallback>
    </Avatar>
  )
}
