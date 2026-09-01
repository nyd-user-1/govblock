import { siteConfig } from "@/lib/config"

export { cn } from "@govblock/ui/lib/utils"

export function absoluteUrl(path: string) {
  return `${siteConfig.url}${path}`
}
