# The Clerk's mail runner

Mail to `govblock-clerk@agentmail.to` gets an answer from the Clerk on the same thread.

- AgentMail posts `message.received` to `https://govblock-clerk-mail.brendan-stanton.workers.dev/agentmail` (webhook `ep_3J0mksGOaMU8L3W3f2IToyQTuRb`, scoped to the Clerk's inbox).
- The Worker verifies the Svix signature and queues the message in KV.
- A cron every two minutes runs the `bill-reader` agent against `https://policy.nysgpt.com/api/agents/chat`, one round per request, and replies through AgentMail as text and HTML.

Secrets (set with `npx wrangler secret put`): `AGENTMAIL_API_KEY` (an AgentMail key with inbox read, message read, send, reply and update), `AGENTMAIL_WEBHOOK_SECRET` (from the webhook record). Deploy with `npx wrangler deploy` from this directory; the wrangler login on this machine is the credential.

KV keeps `pending:`, `working:`, `done:`, `error:` and `failed:` records for a week. Two failed attempts park a message under `failed:`.
