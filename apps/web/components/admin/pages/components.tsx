"use client"

import * as React from "react"

import { Chart1, Chart2, Chart3, Chart4 } from "@/components/admin/blocks/charts"
import { Stat1, Stat2, StatAi, StatCrypto, StatCustomer, StatDatabaseGrid, StatEducation, StatOrder } from "@/components/admin/blocks/stats"
import { Table1, Table3 } from "@/components/admin/blocks/tables"
import { Analytics7, Promo1, Widget1, Widget5 } from "@/components/admin/blocks/widgets"
import { PageTitle } from "@/components/admin/page-title"
import { useAdminNav } from "@/components/admin/nav"
import { Button } from "@govblock/ui/components/nova/button"

// paceui's Components entries point at its block library on paceui.com. Ours
// point at the blocks this experience is built from, each family on its own
// page with the template's sample figures, so a reader can see the piece
// before finding it on a dashboard.

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export function ComponentsPage({ page }: { page: string }) {
  const { go } = useAdminNav()
  const family = page.replace("components/", "")
  const title = family === "charts" ? "Charts" : family === "stats" ? "Stats" : family === "widgets" ? "Widgets" : "Data Table"
  return (
    <div>
      <PageTitle title={title} links={[{ label: "Components", page: "components/charts" }]} />
      <div className="mt-4 flex flex-col gap-8 sm:mt-5">
        {family === "charts" && (
          <>
            <Section title="Chart 1" description="A two-series area over time with a range select. The Log page's traffic.">
              <Chart1 />
            </Section>
            <Section title="Chart 2" description="A day-by-slot heatmap. The Log page's weekly grid.">
              <div className="h-90">
                <Chart2 />
              </div>
            </Section>
            <Section title="Chart 3" description="Three figures over a stacked bar chart with a menu. The Sales page's performance.">
              <Chart3 />
            </Section>
            <Section title="Chart 4" description="A half donut with the total in the middle. The Sales page's channels.">
              <div className="max-w-md">
                <Chart4 />
              </div>
            </Section>
          </>
        )}
        {family === "stats" && (
          <>
            <Section title="Stat 1" description="Title, value, a coloured change. Logs.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Stat1 title="Total Throughput" value="45.2k RPM" changeValue="+5.2%" />
                <Stat1 title="P99 Latency" value="210ms" changeValue="+15ms" direction="down" />
                <Stat1 title="Failed Requests (5xx)" value="14" changeValue="-21.4%" />
                <Stat1 title="Success Rate (2xx)" value="99.92%" changeValue="+0.04%" direction="neutral" />
              </div>
            </Section>
            <Section title="Stat 2" description="A trend badge and a two-line footer. Sales.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Stat2 title="Gross Revenue" value="$7,142,480" trendValue={12.5} footerLabel="Record high" footerSubtext="vs. $6,300,368 last month" />
                <Stat2 title="Total Orders" value="1,248" trendValue={5.2} footerLabel="Increased volume" footerSubtext="Successful holiday promotion" />
                <Stat2 title="Avg. Order Value" value="$114.16" trendValue={-2.1} footerLabel="Minor decrease" footerSubtext="Due to high volume of small items" />
                <Stat2 title="Customer LTV" value="$892.00" trendValue={0} footerLabel="Flat" footerSubtext="No change this month" />
              </div>
            </Section>
            <Section title="Customer, Order, Education" description="The tiles the Customer, Order and Education pages open with.">
              <div className="grid gap-4 md:grid-cols-3">
                <StatCustomer title="Total Customers" value="24,892" trend="+8.2%" note="Steady user growth" />
                <StatOrder label="Total Orders" value="12,450" target="15,000 target" change="+10.2%" />
                <StatEducation title="Total Enrollments" period="This Semester" value="12,847" badge="+8.3%" note="vs last semester" />
              </div>
            </Section>
            <Section title="AI and Crypto" description="A value with a unit; a value against a target.">
              <div className="grid gap-4 md:grid-cols-2">
                <StatAi title="Total Spend (30d)" badge="+12.4%" prefix="$" value="3,842.18" note="Across 4 providers, 12 models" />
                <StatCrypto title="Bitcoin HODL" description="Cold storage accumulation" value="1.25" of="2" percent={63} note="from BTC target" />
              </div>
            </Section>
            <Section title="Database grid" description="Six tiles in one card, a hairline between them.">
              <StatDatabaseGrid
                stats={[
                  { title: "Queries Per Second", value: "3,240", change: "8.5%", note: "Peak: 4,100 QPS" },
                  { title: "Avg Query Latency", value: "12.4 ms", change: "2.1 ms", direction: "down", note: "p99 latency: 38.5 ms" },
                  { title: "Active Connections", value: "845", change: "12%", note: "Max allowed: 2,000" },
                  { title: "Cache Hit Ratio", value: "96.2%", change: "1.4%", note: "Buffer size: 16 GB" },
                  { title: "Storage Usage", value: "842 GB", change: "15 GB", note: "84% of 1 TB allocated" },
                  { title: "Slow Queries", value: "24", change: "12%", direction: "down", note: "Queries taking > 100ms" },
                ]}
              />
            </Section>
          </>
        )}
        {family === "widgets" && (
          <>
            <Section title="Widget 1" description="A console that fills a line at a time.">
              <div className="h-90">
                <Widget1 />
              </div>
            </Section>
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              <Section title="Widget 5" description="Quotas as a list with a thin bar each.">
                <Widget5 />
              </Section>
              <Section title="Analytics 7" description="Sources with an icon tile, two lines, a figure and a bar.">
                <Analytics7 />
              </Section>
              <Section title="Promo 1" description="The locked-feature card.">
                <Promo1 />
              </Section>
            </div>
          </>
        )}
        {family === "tables" && (
          <>
            <Section title="Table 1" description="The Log page's request list.">
              <Table1 />
            </Section>
            <Section title="Table 3" description="The Sales page's product list, a picture per row.">
              <Table3 />
            </Section>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          {["charts", "stats", "widgets", "tables"].map((f) => (
            <Button key={f} variant={f === family ? "secondary" : "outline"} size="sm" onClick={() => go(`components/${f}`)} className="capitalize">
              {f === "tables" ? "Data Table" : f}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
