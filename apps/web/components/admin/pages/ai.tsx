"use client"

import * as React from "react"
import { ArrowUpRightIcon, MoreHorizontalIcon, SearchIcon } from "lucide-react"
import { Area, AreaChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis } from "recharts"

import { StatAi } from "@/components/admin/blocks/stats"
import { PageTitle } from "@/components/admin/page-title"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/nova/chart"
import { Input } from "@govblock/ui/components/nova/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Separator } from "@govblock/ui/components/nova/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { Tabs, TabsList, TabsTrigger } from "@govblock/ui/components/nova/tabs"
import { cn } from "@govblock/ui/lib/utils"

// paceui's AI Tokens dashboard, rebuilt from its rendered page. The figures
// are the template's sample ones: the agents run on Bedrock and the site
// keeps no per-call ledger yet, so there is nothing of ours to put here
// until one exists. The providers are named for what the agents could use.

const days = Array.from({ length: 30 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (29 - i))
  const base = 10 + Math.sin(i / 3) * 3
  return { date: d.toISOString().slice(0, 10), gpt: Math.round(base * 100 + Math.random() * 300), claude: Math.round(base * 70 + Math.random() * 200), gemini: Math.round(base * 30 + Math.random() * 100), cost: Math.round((base * 12 + Math.random() * 30) * 100) / 100 }
})
const usageConfig: ChartConfig = { gpt: { label: "GPT-4o", color: "var(--chart-1)" }, claude: { label: "Claude 3.5 Sonnet", color: "var(--chart-2)" }, gemini: { label: "Gemini 1.5 Pro", color: "var(--chart-3)" } }
const providers = [
  { name: "OpenAI", spend: 2074.78, share: 54, rate: "$0.032", fill: "var(--chart-1)" },
  { name: "Anthropic", spend: 1191.08, share: 31, rate: "$0.028", fill: "var(--chart-2)" },
  { name: "Google Cloud", spend: 422.64, share: 11, rate: "$0.018", fill: "var(--chart-3)" },
  { name: "Groq", spend: 153.68, share: 4, rate: "$0.004", fill: "var(--chart-4)" },
]
const latency = Array.from({ length: 24 }, (_, i) => ({ h: `${i}:00`, p99: 800 + Math.round(Math.random() * 300), p90: 500 + Math.round(Math.random() * 200), p50: 250 + Math.round(Math.random() * 100) }))
const latencyConfig: ChartConfig = { p99: { label: "P99", color: "var(--chart-1)" }, p90: { label: "P90", color: "var(--chart-2)" }, p50: { label: "P50", color: "var(--chart-3)" } }
const statuses = [
  { code: "200", label: "OK", n: 1385, tone: "text-green-600" },
  { code: "429", label: "Rate Limit", n: 184, tone: "text-amber-600" },
  { code: "500", label: "Server Error", n: 30, tone: "text-destructive" },
]
const traces = [
  { id: "trc_b1baf9177d84", status: 200, when: "Just now", model: "GPT-4o", provider: "OpenAI", tokens: "1,172 / 81", latency: "407", ttft: "157", cost: "0.00374" },
  { id: "trc_210cad5f6344", status: 200, when: "4m ago", model: "Claude 3.5 Sonnet", provider: "Anthropic", tokens: "486 / 395", latency: "931", ttft: "272", cost: "0.00620" },
  { id: "trc_c2eb42e215a9", status: 200, when: "8m ago", model: "Gemini 1.5 Pro", provider: "Google Cloud", tokens: "1,021 / 440", latency: "626", ttft: "251", cost: "0.00348" },
  { id: "trc_3830e41cd9bf", status: 200, when: "12m ago", model: "Llama 3.3", provider: "Groq", tokens: "537 / 443", latency: "845", ttft: "143", cost: "0.00062" },
  { id: "trc_411dbde8c87f", status: 200, when: "16m ago", model: "GPT-4o", provider: "OpenAI", tokens: "1,604 / 556", latency: "228", ttft: "156", cost: "0.00957" },
  { id: "trc_19726e9c7ed5", status: 429, when: "20m ago", model: "Claude 3.5 Sonnet", provider: "Anthropic", tokens: "1,160 / 418", latency: "890", ttft: "250", cost: "0.00850" },
  { id: "trc_e63d0a1b22c1", status: 500, when: "24m ago", model: "Gemini 1.5 Pro", provider: "Google Cloud", tokens: "812 / 0", latency: "1,204", ttft: "—", cost: "0.00000" },
]

export function AiPage() {
  const [tab, setTab] = React.useState("tokens")
  return (
    <div>
      <PageTitle
        title="Cost & Usage Observability"
        endContent={
          <Badge variant="outline" className="h-6 gap-1.5 text-green-600">
            <span className="size-1.5 rounded-full bg-green-500" />
            All Providers Operational
          </Badge>
        }
      />
      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatAi title="Total Spend (30d)" badge="+12.4%" prefix="$" value="3,842.18" note="Across 4 providers, 12 models" />
        <StatAi title="Aggregated Token Volume" badge="+8.1%" value="412.8" unit="M" note="308.2M prompt / 104.6M completion" />
        <StatAi title="P95 Latency & TTFT" badge="-32ms" badgeTone="down" value="740" unit="ms" note="195ms TTFT | 0.14% error rate" />
        <StatAi title="Cache & Fallback Efficiency" badge="Saved" badgeTone="neutral" prefix="$" value="614.30" note="28.4% prompt cache hit rate" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Card className="max-2xl:gap-3 max-2xl:pt-4">
            <CardHeader className="max-2xl:px-4">
              <CardTitle>Model Usage & Cost Trends</CardTitle>
              <CardDescription className="max-sm:text-xs">Daily token consumption and cost breakdown by model</CardDescription>
              <CardAction>
                <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
                  <TabsList className="h-8">
                    <TabsTrigger value="tokens">Tokens</TabsTrigger>
                    <TabsTrigger value="cost">Cost ($)</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardAction>
            </CardHeader>
            <CardContent className="sm:px-4">
              <ChartContainer config={tab === "tokens" ? usageConfig : { cost: { label: "Cost", color: "var(--chart-1)" } }} className="aspect-auto h-68 w-full">
                <AreaChart data={days}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(v) => new Date(`${v}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  {tab === "tokens" ? (
                    <>
                      <Area dataKey="gpt" type="monotone" stackId="a" stroke="var(--color-gpt)" fill="var(--color-gpt)" fillOpacity={0.5} />
                      <Area dataKey="claude" type="monotone" stackId="a" stroke="var(--color-claude)" fill="var(--color-claude)" fillOpacity={0.5} />
                      <Area dataKey="gemini" type="monotone" stackId="a" stroke="var(--color-gemini)" fill="var(--color-gemini)" fillOpacity={0.5} />
                    </>
                  ) : (
                    <Area dataKey="cost" type="monotone" stroke="var(--color-cost)" fill="var(--color-cost)" fillOpacity={0.3} />
                  )}
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
        <div className="xl:col-span-2">
          <Card>
            <CardHeader className="max-2xl:px-4">
              <CardTitle>Provider Spend Allocation</CardTitle>
              <CardDescription className="max-sm:text-xs">Cost distribution and token rates across providers</CardDescription>
              <CardAction>
                <Button variant="ghost" size="icon-sm" aria-label="Options">
                  <MoreHorizontalIcon />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ChartContainer config={Object.fromEntries(providers.map((p) => [p.name, { label: p.name, color: p.fill }]))} className="mx-auto aspect-square h-56">
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="name" />} />
                    <Pie data={providers} dataKey="spend" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3} cornerRadius={4} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-col justify-center gap-3">
                  {providers.map((p) => (
                    <div key={p.name} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: p.fill }} />
                        <span className="text-sm font-medium">{p.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          <span className="text-muted-foreground">$</span>
                          {p.spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.share}% · {p.rate}/1K tokens
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-3">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Input vs Output Ratio</CardTitle>
            <CardAction>
              <Select defaultValue="24h">
                <SelectTrigger className="h-8 w-24" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24h</SelectItem>
                  <SelectItem value="7d">7d</SelectItem>
                  <SelectItem value="30d">30d</SelectItem>
                </SelectContent>
              </Select>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-3xl font-semibold">
              75<span className="text-base text-muted-foreground">%</span> <span className="text-muted-foreground">/</span> 25<span className="text-base text-muted-foreground">%</span>
            </p>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: "75%" }} />
              <div className="h-full bg-primary/40" style={{ width: "25%" }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">308.2M</span> prompt
              </span>
              <span>
                <span className="font-medium text-foreground">104.6M</span> completion
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <p className="text-xl font-semibold">1,240</p>
                <p className="text-xs text-muted-foreground">Avg Prompt Length</p>
              </div>
              <Separator orientation="vertical" className="h-10" />
              <div>
                <p className="text-xl font-semibold">413</p>
                <p className="text-xs text-muted-foreground">Avg Completion Length</p>
              </div>
            </div>
            <div className="flex justify-between rounded-lg bg-muted/50 p-3 text-xs">
              <span>
                Prompt cache: <span className="font-medium">28.4%</span>
              </span>
              <span>
                Ratio: <span className="font-medium">3.0:1</span>
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Latency Timeline</CardTitle>
            <CardAction className="gap-1.5">
              <Button variant="ghost" size="icon-sm" aria-label="Options">
                <MoreHorizontalIcon />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-3xl font-semibold">
              944<span className="text-base text-muted-foreground">ms</span>
            </p>
            <div className="flex gap-3 text-xs text-muted-foreground">
              {["P99", "P90", "P50"].map((p, i) => (
                <span key={p} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: `var(--chart-${i + 1})` }} />
                  {p}
                </span>
              ))}
            </div>
            <ChartContainer config={latencyConfig} className="aspect-auto h-40 w-full">
              <LineChart data={latency}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="h" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Line dataKey="p99" type="monotone" stroke="var(--color-p99)" dot={false} strokeWidth={2} />
                <Line dataKey="p90" type="monotone" stroke="var(--color-p90)" dot={false} strokeWidth={2} />
                <Line dataKey="p50" type="monotone" stroke="var(--color-p50)" dot={false} strokeWidth={2} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Request Status</CardTitle>
            <CardAction>
              <Button variant="outline" size="sm">
                View Logs
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div>
              <p className="text-3xl font-semibold">1,599</p>
              <p className="text-xs text-muted-foreground">Total requests (24h)</p>
            </div>
            <div className="flex flex-col gap-4">
              {statuses.map((s) => (
                <div key={s.code} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("h-5 gap-1 font-mono", s.tone)}>
                      {s.code}
                    </Badge>
                    <span className="text-sm">{s.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{s.n.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">occurrences</p>
                  </div>
                  <ChartContainer config={{ v: { label: "", color: "var(--chart-2)" } }} className="aspect-video h-10 w-20">
                    <AreaChart data={Array.from({ length: 12 }, (_, i) => ({ i, v: Math.random() * 10 }))}>
                      <Area dataKey="v" type="monotone" stroke="var(--color-v)" fill="var(--color-v)" fillOpacity={0.3} />
                    </AreaChart>
                  </ChartContainer>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:mt-5">
        <Card>
          <CardHeader className="max-2xl:px-4">
            <CardTitle>API Traces</CardTitle>
            <CardDescription className="max-sm:text-xs">Monitor and analyze your recent API requests.</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">
                Actions
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative grow sm:max-w-xs">
                <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search traces" className="h-9 pl-8" />
              </div>
              {["Status", "Provider", "Model"].map((f) => (
                <Select key={f} defaultValue="all">
                  <SelectTrigger className="h-9 sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All {f.toLowerCase()}s</SelectItem>
                  </SelectContent>
                </Select>
              ))}
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Trace ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {traces.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("h-5 font-mono", t.status === 200 ? "text-green-600" : t.status === 429 ? "text-amber-600" : "text-destructive")}>
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{t.when}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium whitespace-nowrap">{t.model}</span>
                        <span className="text-xs text-muted-foreground">{t.provider}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{t.tokens}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="whitespace-nowrap">{t.latency}ms</span>
                        <span className="text-xs text-muted-foreground">{t.ttft}ms TTFT</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">${t.cost}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="gap-1">
                        Inspect
                        <ArrowUpRightIcon className="size-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
