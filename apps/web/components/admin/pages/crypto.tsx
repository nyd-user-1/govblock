"use client"

import * as React from "react"
import { CopyIcon, LinkIcon, CheckIcon } from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { StatCrypto } from "@/components/admin/blocks/stats"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { PageTitle } from "@/components/admin/page-title"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/nova/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"

// paceui's Crypto Wallet, rebuilt from its rendered page with its sample figures.

const trend = Array.from({ length: 30 }, (_, i) => ({
  d: i,
  btc: 60000 + Math.round(Math.sin(i / 4) * 4000 + i * 250),
  eth: 3000 + Math.round(Math.cos(i / 5) * 300),
  sol: 120 + Math.round(Math.sin(i / 3) * 20),
}))
const portfolio = [
  { name: "Bitcoin", value: 45000 },
  { name: "Ethereum", value: 28000 },
  { name: "Solana", value: 12000 },
  { name: "Cardano", value: 8500 },
  { name: "Polkadot", value: 4200 },
]
const holdings = [
  {
    name: "Bitcoin",
    sym: "BTC",
    apy: "1.5%",
    value: "$64,250.00",
    change: "4.85%",
    pct: 73,
  },
  {
    name: "Ethereum",
    sym: "ETH",
    apy: "4.2%",
    value: "$3,450.00",
    change: "2.10%",
    pct: 20,
  },
  {
    name: "Solana",
    sym: "SOL",
    apy: "7.5%",
    value: "$145.00",
    change: "1.25%",
    pct: 7,
  },
]

export function CryptoPage() {
  const [coin, setCoin] = React.useState<"btc" | "eth" | "sol">("btc")
  const config: ChartConfig = {
    [coin]: { label: coin.toUpperCase(), color: "var(--chart-1)" },
  }
  return (
    <div>
      <PageTitle title="Crypto Wallet" />
      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
        <StatCrypto title="Bitcoin HODL" description="Cold storage accumulation" value="1.25" of="2" percent={63} note="from BTC target" />
        <StatCrypto title="Ethereum Stash" description="dApp transaction fees" value="4.5" of="10" percent={45} note="from ETH target" />
        <StatCrypto title="USDC Yield Farm" description="Liquidity pool provision" value="15,450" of="25,000" percent={62} note="from USDC target" />
        <StatCrypto title="Solana Swing" description="Short term trading bag" value="145" of="500" percent={29} note="from SOL target" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-2 2xl:grid-cols-7">
        <div className="2xl:col-span-4">
          <Card>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <CardAnchor>Market Trends</CardAnchor>
                    <div className="flex gap-1">
                      {(["btc", "eth", "sol"] as const).map((c) => (
                        <Button key={c} variant={coin === c ? "secondary" : "ghost"} size="sm" onClick={() => setCoin(c)}>
                          {c.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Badge variant="outline" className="h-5 gap-1.5 text-green-600">
                      Grow <span className="font-semibold">+17%</span>
                    </Badge>
                    <p className="mt-2 text-3xl font-semibold">$68,332.00</p>
                  </div>
                  <div>
                    <CardTitle className="text-sm">Comparison</CardTitle>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">$60,477.50</span>
                      <span className="font-medium">$68,332.00</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: "88%" }} />
                    </div>
                  </div>
                </div>
                <ChartContainer config={config} className="aspect-video w-full">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="fillCoin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={`var(--color-${coin})`} stopOpacity={0.6} />
                        <stop offset="95%" stopColor={`var(--color-${coin})`} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="d" hide />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="dot" />} />
                    <Area dataKey={coin} type="monotone" stroke={`var(--color-${coin})`} fill="url(#fillCoin)" />
                  </AreaChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="2xl:col-span-3">
          <Card className="gap-0 sm:pb-0">
            <CardHeader>
              <CardAnchor>Portfolio Overview</CardAnchor>
              <CardAction>
                <CardTools className="gap-2">
                  <Select defaultValue="weekly">
                    <SelectTrigger className="h-8 w-max min-w-24" size="sm">
                      <SelectValue>{(v: unknown) => (v === "monthly" ? "Monthly" : "Weekly")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-max min-w-44">
                      <SelectItem value="weekly" className="whitespace-nowrap">
                        Weekly
                      </SelectItem>
                      <SelectItem value="monthly" className="whitespace-nowrap">
                        Monthly
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </CardTools>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
                <ChartContainer
                  config={{
                    value: { label: "Value", color: "var(--chart-2)" },
                  }}
                  className="aspect-video h-75 w-full"
                >
                  <BarChart data={portfolio} layout="vertical" margin={{ left: 0, right: 0 }}>
                    <XAxis type="number" hide />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={6} />
                  </BarChart>
                </ChartContainer>
                <div className="flex flex-col justify-center gap-3 md:pl-4">
                  {portfolio.map((p) => (
                    <div key={p.name} className="flex items-center justify-between border-b pb-2 text-sm last:border-b-0">
                      <span>{p.name}</span>
                      <span className="font-medium">
                        <span className="text-muted-foreground">$</span>
                        {p.value.toLocaleString()}
                      </span>
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
            <CardAnchor>Secure Vault</CardAnchor>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div>
                <p className="text-2xl font-semibold">$87,420.00</p>
                <p className="text-xs text-muted-foreground">Total holdings valuation</p>
              </div>
              <Badge variant="outline" className="h-5 self-start text-green-600">
                +3.45%
              </Badge>
            </div>
            <div className="grid gap-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Allocation</span>
                <span>100% Total</span>
              </div>
              <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
                {holdings.map((h, i) => (
                  <div
                    key={h.sym}
                    className="h-full"
                    style={{
                      width: `${h.pct}%`,
                      background: `var(--chart-${i + 1})`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-3">
              {holdings.map((h) => (
                <div key={h.sym} className="grid grid-cols-[1fr_auto] gap-4">
                  <div className="grid gap-0.5">
                    <span className="text-sm font-medium">{h.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {h.sym} • {h.apy} APY
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{h.value}</p>
                    <p className="text-xs text-green-600">{h.change}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader>
            <CardAnchor>My Wallets</CardAnchor>
            <CardAction>
              <CardTools className="gap-2">
                <Button variant="outline" size="sm" className="gap-1">
                  <LinkIcon className="size-3.5" />
                  Link Wallet
                </Button>
              </CardTools>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div>
                <p className="text-2xl font-semibold">$4.8 M</p>
                <p className="text-xs text-muted-foreground">Total wallet valuation</p>
              </div>
              <Badge variant="outline" className="h-5 self-start text-green-600">
                +12.80%
              </Badge>
            </div>
            {[
              { addr: "0x7a5b...8F9b", net: "Ethereum", bal: "4.2 ETH" },
              { addr: "HN7c...k3T1", net: "Solana", bal: "145 SOL" },
            ].map((w) => (
              <div key={w.addr} className="rounded-lg border p-3 text-sm">
                <Badge variant="outline" className="mb-2 h-5 gap-1 text-green-600">
                  <CheckIcon className="size-3" />
                  Connected
                </Badge>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Wallet Address", w.addr],
                    ["Network", w.net],
                    ["Balance", w.bal],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[11px] text-muted-foreground">{k}</p>
                      <p className="truncate font-medium">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader className="flex-col gap-2.5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">API Feature</CardTitle>
            <CardAnchor>Unlock Crypto Market Data API</CardAnchor>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="grid gap-2 text-sm">
              {["Unlimited WebSocket connections", "Real-time order book snapshots", "API access to 500+ trading pairs", "Historical tick-level market data"].map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <CheckIcon className="size-4 text-green-600" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 font-mono text-xs">
              <span className="truncate">curl https://api.acme.com/v1/crypto/ticker</span>
              <Button variant="ghost" size="icon-xs" aria-label="Copy">
                <CopyIcon />
              </Button>
            </div>
            <Button size="lg" className="gap-1.5">
              Upgrade to Developer API
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
