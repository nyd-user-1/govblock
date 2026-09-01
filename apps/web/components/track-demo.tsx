import { CodeFigure } from "@/components/code-block"
import { PreviewFrame } from "@/components/preview-frame"
import { Checkbox } from "@govblock/ui/components/nova/checkbox"
import { Field, FieldLabel } from "@govblock/ui/components/nova/field"

// The Track section of a bill page: livingston-v3 renders the docs'
// checkbox demo here, as a stand-in until tracking exists.
const SOURCE = `import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"

export function CheckboxDemo() {
  return (
    <Field orientation="horizontal">
      <Checkbox id="terms" />
      <FieldLabel htmlFor="terms">Accept terms and conditions</FieldLabel>
    </Field>
  )
}`

export function TrackDemo() {
  return (
    <PreviewFrame
      component={
        <Field orientation="horizontal">
          <Checkbox id="terms" />
          <FieldLabel htmlFor="terms">Accept terms and conditions</FieldLabel>
        </Field>
      }
      source={<CodeFigure code={SOURCE} />}
      sourcePreview={<CodeFigure code={SOURCE.split("\n").slice(0, 3).join("\n")} />}
    />
  )
}
