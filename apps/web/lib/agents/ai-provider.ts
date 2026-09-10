import "server-only"

import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import type { LanguageModel } from "ai"

import { bedrock } from "@/lib/agents/bedrock"
import { MODELS } from "@/lib/agents/models"

// The Vercel AI SDK's Bedrock provider, on the credentials and region the
// agents already use (2026-09-09, for the Typeset editor's AI). Plate's
// playground routes were written for Vercel's AI Gateway and a key the
// reader pastes into a settings dialog; here the server holds the model, so
// no key crosses the wire and the dialog is not rendered.
const provider = createAmazonBedrock({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentialProvider: async () => {
    const c = await bedrock().config.credentials()
    return {
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
      sessionToken: c.sessionToken,
    }
  },
})

/** `fast` for choosing and completing, `main` for writing and editing. */
export function bedrockModel(kind: "fast" | "main"): LanguageModel {
  return provider(kind === "fast" ? MODELS.routing.id : MODELS.grounded.id)
}
