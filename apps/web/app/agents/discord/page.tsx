import Link from "next/link"

import { DocsPage } from "@/components/docs-page"
import { discord } from "@/lib/agents/connections/discord"
import {
  getBotStatus,
  getThreads,
  getWidget,
  type Widget,
} from "@/lib/agents/connections/discord-community"
import { Button } from "@govblock/ui/components/nova/button"

import { ConnectionMark } from "../connection-mark"
import { WidgetFrame } from "./widget-frame"

const title = "Discord"
const description =
  "Where the agents' finished work goes, and the two ways this site can see it back."

export const metadata = { title, description }
export const dynamic = "force-dynamic"

function Server({ widget }: { widget: Widget }) {
  if (!widget.enabled)
    return (
      <div className="flex flex-col gap-3 rounded-xl border p-5">
        <div className="flex items-center gap-2">
          <ConnectionMark name="Discord" logo={discord.logo} tint={discord.tint} live={false} />
          <span className="font-medium">The server widget is not switched on</span>
        </div>
        <p className="text-sm text-muted-foreground">{widget.reason}</p>
        <p className="text-sm text-muted-foreground">
          It takes four clicks in Discord and no code here: <strong>Server Settings</strong> →{" "}
          <strong>Widget</strong> (under Engagement on newer layouts) → <strong>Enable Server
          Widget</strong> → pick an invite channel. This card fills itself in the next time the
          page is served.
        </p>
      </div>
    )

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex flex-wrap items-center gap-3">
        <ConnectionMark name="Discord" logo={discord.logo} tint={discord.tint} />
        <span className="font-medium">{widget.name}</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {widget.online} online
        </span>
        {widget.invite && (
          <Button
            size="sm"
            className="ml-auto"
            render={<a href={widget.invite} target="_blank" rel="noreferrer" />}
            nativeButton={false}
          >
            Join the server
          </Button>
        )}
      </div>

      {widget.channels.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Voice channels the widget exposes: {widget.channels.map((c) => c.name).join(", ")}.
        </p>
      )}

      <WidgetFrame guildId={widget.id} title={`${widget.name} on Discord`} />
    </div>
  )
}

export default async function DiscordPage() {
  const [widget, bot, threads] = await Promise.all([getWidget(), getBotStatus(), getThreads()])

  return (
    <DocsPage
      title={title}
      description={description}
      slug="/agents/discord"
      previous={{ name: "Librarian", url: "/agents/researcher" }}
      next={{ name: "Agents", url: "/agents" }}
    >
      <p>
        The Whip posts its digests and the Librarian delivers its reports into a Discord
        channel, which is what makes a finished run outlive the tab it ran in. This page is the
        other direction: what the server looks like from here, and what this site can read back
        out of it.
      </p>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">The server</h2>
      <Server widget={widget} />

      <h2 className="mt-8 text-lg font-semibold tracking-tight">PolicyBot&apos;s threads</h2>
      {bot.connected ? (
        threads.length ? (
          <div className="divide-y divide-border rounded-xl border">
            {threads.map((thread) => (
              <a
                key={thread.id}
                href={thread.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-baseline gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{thread.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {thread.messageCount} message{thread.messageCount === 1 ? "" : "s"}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The bot can see the channel and there are no threads in it yet.
          </p>
        )
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border p-5">
          <div className="flex items-center gap-2">
            <ConnectionMark name="Discord" logo={discord.logo} tint={discord.tint} live={false} />
            <span className="font-medium">Not connected, so this shows nothing</span>
          </div>
          <p className="text-sm text-muted-foreground">{bot.detail}</p>
          <p className="text-sm text-muted-foreground">
            A webhook can write and cannot read — the URL is a one-way door — so putting the
            channel&apos;s threads on this page needs a read-only bot. Until that token exists
            this list stays empty rather than standing in the runs kept in your own browser:
            those are already on the{" "}
            <Link href="/blocks/intelligence" className="underline underline-offset-4">
              Inbox
            </Link>{" "}
            under a heading that tells the truth about where they live.
          </p>
          <p className="text-sm text-muted-foreground">
            The steps are in <code>scripts/agents/connect-discord-bot.sh</code>, which validates
            the token against Discord before it writes it.
          </p>
        </div>
      )}
    </DocsPage>
  )
}
