import { cn } from "@govblock/ui/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/select"

// The footer picker. Our Select, never the browser's — the "all" label shows
// until something is chosen.
export function SubjectPicker({
  label,
  allLabel,
  items,
  size = "sm",
  className,
}: {
  label: string
  allLabel: string
  items: string[]
  size?: "sm" | "default"
  className?: string
}) {
  const labels: Record<string, string> = { "": allLabel }
  for (const item of items) labels[item] = item
  return (
    <Select defaultValue="" items={labels}>
      <SelectTrigger size={size} aria-label={label} className={cn("max-w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value="">{allLabel}</SelectItem>
        {items.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
