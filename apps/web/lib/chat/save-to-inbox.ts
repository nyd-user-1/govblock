import { emptyRun } from "@/lib/agents/run-client"
import { loadThreads, messageId, newThread, reply, saveThreads } from "@/lib/agents/inbox"
import { attachmentMeta } from "@/lib/agents/report-pdf"
import { keyDef, optionLabel, splitMulti } from "@/lib/forms/keys"
import { askedSections, formById, type FormId } from "@/lib/forms/programs"
import { sectionKnown, type Values } from "@/lib/forms/profile"
import type { Filled } from "@/lib/forms/fill"

// The filled form as a delivered thread in the Agentic Inbox: sent by you to
// the Filer, answered with the form as an attachment. The bytes are not
// stored — the message carries the form id and the values used, and the
// file is built again when the card is clicked, so the file that opens is
// the one that was delivered even after the profile has moved on.

export function saveFormToInbox(form: FormId, built: Filled, values: Values): string | undefined {
  const program = formById(form)
  if (!program) return undefined
  const last = values["applicant.lastName"] || "the applicant"
  const programs = splitMulti(values["programs"]).map((p) => optionLabel("programs", p) ?? p)
  const sections = askedSections(program)
  const answered = sections.filter((s) => s.keys.length && sectionKnown(s, values).known.length > 0).length
  const known = Object.keys(values).filter((k) => keyDef(k) && values[k] && values[k] !== "skip" && values[k] !== "unknown").length

  const body = [
    `${program.code}, ${program.title}, filled from ${known} answers across ${answered} of ${sections.length} sections`,
    programs.length ? `, applying for ${programs.join(", ")}` : "",
    `; ${built.filled} fields written on ${built.pages} pages. A draft to read before filing; nothing has been sent to any agency.`,
  ].join("")

  const thread = newThread({ to: ["form-filler"], subject: `${program.name} for ${last}`, body: `Fill ${program.code} from the profile.`, status: "delivered" })
  const id = messageId()
  const run = { ...emptyRun(), text: body, done: true }
  const delivered = reply(thread, "form-filler", run, "delivered", id)
  const withFile = {
    ...delivered,
    messages: delivered.messages.map((message) =>
      message.id === id
        ? { ...message, unread: false, form: { id: form, values }, attachments: [{ name: built.filename, meta: attachmentMeta({ pages: built.pages, bytes: built.bytes.length }), href: "", build: "form-pdf" as const }] }
        : message
    ),
  }
  saveThreads([withFile, ...loadThreads()])
  return withFile.id
}
