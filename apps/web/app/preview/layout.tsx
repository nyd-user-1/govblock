import { PreviewFontVariables } from "@/app/preview/font-variables"
import { previewFontVariables } from "@/app/preview/fonts"

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div data-slot="view" className={previewFontVariables}>
      <PreviewFontVariables className={previewFontVariables} />
      {children}
    </div>
  )
}
