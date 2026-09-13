"use client"

import * as React from "react"

import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs"
import { TableBlock } from "@/components/policy/table-block"
import { Table } from "@/components/typeset"

// A status vocabulary two ways (Brendan, 2026-09-13): the grid first, for the
// reader who wants the list as a table, and the prose list second. The tabs
// stand above the surface block, at its left; both views sit inside the one
// block, so the copy button and See more serve whichever is showing.

export function StatusViews({ rows, columns }: { rows: [string, string][]; columns: [string, string] }) {
  return (
    <Tabs defaultValue="table" className="gap-0">
      <TabsList>
        <TabsTrigger value="table">Table</TabsTrigger>
        <TabsTrigger value="list">List</TabsTrigger>
      </TabsList>
      <TableBlock rows={rows.length}>
        <TabsContents>
          <TabsContent value="table">
            <div className="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
              <table className="my-0 w-full border-collapse text-sm [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold">
                <thead>
                  <tr>
                    <th>{columns[0]}</th>
                    <th>{columns[1]}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([code, label]) => (
                    <tr key={code}>
                      <td className="font-mono text-xs">{code}</td>
                      <td>{label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
          <TabsContent value="list">
            <Table>
              <thead>
                <tr>
                  <th>{columns[0]}</th>
                  <th>{columns[1]}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([code, label]) => (
                  <tr key={code}>
                    <td>
                      <code>{code}</code>
                    </td>
                    <td>{label}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TabsContent>
        </TabsContents>
      </TableBlock>
    </Tabs>
  )
}
