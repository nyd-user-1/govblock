import { ApiCard } from "./api"
import { BillsCard } from "./bills"
import { CalendarCard } from "./calendar"
import { ChambersCard } from "./chambers"
import { CommitteesCard } from "./committees"
import { ConnectCard } from "./connect"
import { LobbyingCard } from "./lobbying"
import { MembersCard } from "./members"
import { ModelBillsCard } from "./model-bills"
import { NavigationCard } from "./navigation"
import { NotificationSettings } from "./notifications"
import { PartyCard } from "./party"
import { SessionsCard } from "./sessions"
import { StockPerformance } from "./stock-performance"
import { NoTeamMembers } from "./team"
import { TopicsCard } from "./topics"
import { BarChartCard } from "./traffic"
import { VotesCard } from "./votes"

// The home grid, ported from livingston-v3 app/(app)/(root)/cards/index.tsx:
// four equal-width stacks inside a muted well, a gradient at the top and a
// fade at the bottom. The well is capped (Brendan, 2026-09-01) so the cut is
// one line for every stack — shadcn's is uncapped and only looks even because
// its stacks happen to be balanced; every stack here runs past the cap and the
// fade hides where it is cut. The drag-to-rearrange layer is not ported.
const STACKS: { id: string; node: React.ReactNode }[][] = [
  [
    { id: "bills-status", node: <BillsCard /> },
    { id: "votes", node: <VotesCard /> },
    { id: "subjects", node: <TopicsCard /> },
    { id: "lobbying", node: <LobbyingCard /> },
  ],
  [
    { id: "chambers", node: <ChambersCard /> },
    { id: "party", node: <PartyCard /> },
    { id: "sessions", node: <SessionsCard /> },
    { id: "model-bills", node: <ModelBillsCard /> },
  ],
  [
    { id: "committees", node: <CommitteesCard /> },
    { id: "members", node: <MembersCard /> },
    { id: "notifications", node: <NotificationSettings /> },
    { id: "nav", node: <NavigationCard /> },
  ],
  [
    { id: "hearings", node: <CalendarCard /> },
    { id: "stock", node: <StockPerformance /> },
    { id: "connect", node: <ConnectCard /> },
    { id: "traffic", node: <BarChartCard /> },
    { id: "team", node: <NoTeamMembers /> },
    { id: "api", node: <ApiCard /> },
  ],
]

export function CardsDemo() {
  return (
    <div
      data-slot="demo"
      className="relative flex w-full max-w-none flex-col gap-(--gap) overflow-hidden bg-muted p-12 pb-0! lg:max-h-[1500px] xl:max-h-[1600px] [--gap:--spacing(8)] 3xl:[--gap:--spacing(8)] min-[1900px]:p-12 min-[1900px]:[--gap:--spacing(10)]! lg:p-6 lg:[--gap:--spacing(6)] dark:bg-background"
    >
      <div className="relative z-10 mx-auto grid w-full max-w-[1600px] grid-cols-1 items-start gap-(--gap) md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {STACKS.map((stack, index) => (
          <div key={index} className="flex min-w-0 flex-col gap-(--gap)">
            {stack.map((item) => (
              <div key={item.id} data-sortable={item.id} className="flex min-w-0 flex-col outline-none **:data-[slot=card]:h-full">
                {item.node}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 z-1 h-120 bg-linear-to-b from-background via-muted to-transparent dark:hidden" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-48 bg-linear-to-t from-background via-muted/80 to-transparent lg:h-80 xl:h-64 dark:via-background/80" />
    </div>
  )
}
