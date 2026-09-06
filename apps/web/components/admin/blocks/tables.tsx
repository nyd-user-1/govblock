"use client"

import * as React from "react"
import { ClockFadingIcon, Edit2Icon, FileDownIcon, ListFilterIcon, MoreHorizontalIcon, NotepadTextIcon, WarehouseIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"

// paceui's table blocks. Table1 is the Logs page's request list; Table3 the
// Sales page's product list with a picture per row.

export type RequestRow = { id: string; method: string; path: React.ReactNode; status: React.ReactNode; bad?: boolean; time: string; duration: string }

export const SAMPLE_REQUESTS: RequestRow[] = [
  { id: "1", method: "GET", path: "/v1/users", status: 200, time: "just now", duration: "12ms" },
  { id: "2", method: "POST", path: "/v1/auth/login", status: 201, time: "15 mins ago", duration: "45ms" },
  { id: "3", method: "DELETE", path: "/v1/billing", status: 404, bad: true, time: "2 hours ago", duration: "8ms" },
  { id: "4", method: "PATCH", path: "/v1/settings", status: 500, bad: true, time: "Yesterday", duration: "102ms" },
  { id: "5", method: "GET", path: "/v1/settings", status: 201, time: "Last week", duration: "64ms" },
]

export function Table1({
  title = "Recent Requests",
  description = "A list of the latest API calls to your project.",
  rows = SAMPLE_REQUESTS,
  columns = ["Method", "Endpoint", "Status", "Time", "Duration"],
  pending,
  onRow,
}: {
  title?: string
  description?: string
  rows?: RequestRow[]
  columns?: [string, string, string, string, string]
  pending?: boolean
  onRow?: (row: RequestRow) => void
}) {
  return (
    <Card className="gap-3 pt-4 pb-3">
      <CardHeader className="px-4">
        <div className="flex items-center gap-2">
          <ClockFadingIcon className="size-4.5" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-3">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead>{columns[0]}</TableHead>
              <TableHead>{columns[1]}</TableHead>
              <TableHead>{columns[2]}</TableHead>
              <TableHead>{columns[3]}</TableHead>
              <TableHead className="text-right">{columns[4]}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending && rows.length === 0
              ? Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow key={row.id} className={cn(onRow && "cursor-pointer")} onClick={() => onRow?.(row)}>
                    <TableCell className="text-xs font-semibold">
                      <span className={cn(row.method === "DELETE" ? "text-destructive" : "text-primary")}>{row.method}</span>
                    </TableCell>
                    <TableCell className="max-w-56 truncate font-mono text-xs">{row.path}</TableCell>
                    <TableCell>
                      <Badge variant={row.bad ? "destructive" : "secondary"}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{row.time}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{row.duration}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export type ProductRow = { id: string; name: string; sku: string; category: string; image?: string | null; revenue: React.ReactNode; sales: string; status: string; statusVariant?: "default" | "secondary" | "destructive" | "outline"; onEdit?: () => void }

export const SAMPLE_PRODUCTS: ProductRow[] = [
  { id: "PROD-001", name: "Wireless Noise-Canceling Headphones", sku: "WLNCH", category: "Electronics", image: "https://picsum.photos/id/14/80/80", revenue: "$370,760", sales: "1,240 sold", status: "in stock", statusVariant: "secondary" },
  { id: "PROD-002", name: "Ergonomic Office Chair", sku: "ERGOC", category: "Furniture", image: "https://picsum.photos/id/431/80/80", revenue: "$127,500", sales: "850 sold", status: "low stock", statusVariant: "default" },
  { id: "PROD-003", name: "Mechanical Gaming Keyboard", sku: "MECHGK", category: "Electronics", image: "https://picsum.photos/id/409/80/80", revenue: "$53,994", sales: "600 sold", status: "in stock", statusVariant: "secondary" },
  { id: "PROD-004", name: "Smartphone Stand", sku: "SPST", category: "Accessories", image: "https://picsum.photos/id/265/80/80", revenue: "$8,995", sales: "450 sold", status: "out of stock", statusVariant: "destructive" },
  { id: "PROD-005", name: "4K Monitor 27-inch", sku: "Moni-4K", category: "Electronics", image: "https://picsum.photos/id/96/80/80", revenue: "$127,680", sales: "320 sold", status: "in stock", statusVariant: "secondary" },
  { id: "PROD-006", name: "Smart Home Security Camera", sku: "SH-CAM-01", category: "Smart Home", image: "https://picsum.photos/id/91/80/80", revenue: "$98,989", sales: "1,100 sold", status: "low stock", statusVariant: "default" },
]

export function Table3({
  title = "Top Selling Products",
  description = "Your highest performing products for this month.",
  rows = SAMPLE_PRODUCTS,
  columns = ["Image", "Name", "Category", "Status", "Revenue", "Actions"],
  pending,
  menu = ["View Report", "Manage Inventory"],
}: {
  title?: string
  description?: string
  rows?: ProductRow[]
  columns?: [string, string, string, string, string, string]
  pending?: boolean
  menu?: [string, string]
}) {
  return (
    <Card className="w-full gap-5 pb-5 max-md:py-4!">
      <CardHeader className="max-md:px-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" aria-label="Filter" className="max-md:hidden">
              <ListFilterIcon className="size-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button size="icon-sm" variant="outline" aria-label="Menu">
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-max min-w-44">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem className="whitespace-nowrap">
                    <NotepadTextIcon className="size-4" />
                    {menu[0]}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="whitespace-nowrap">
                    <WarehouseIcon className="size-4" />
                    {menu[1]}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="whitespace-nowrap">
                    <FileDownIcon className="size-4" />
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="max-md:px-4">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead className="w-12">{columns[0]}</TableHead>
              <TableHead>{columns[1]}</TableHead>
              <TableHead>{columns[2]}</TableHead>
              <TableHead>{columns[3]}</TableHead>
              <TableHead>{columns[4]}</TableHead>
              <TableHead className="text-right">{columns[5]}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending && rows.length === 0
              ? Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : rows.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={product.image ?? undefined} alt={product.name} className="object-cover object-top" />
                        <AvatarFallback>{product.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <div className="flex w-40 flex-col">
                        <p className="truncate font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>
                      <Badge variant={product.statusVariant ?? "secondary"} className="whitespace-nowrap capitalize">
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <p className="font-medium">{product.revenue}</p>
                        <p className="text-xs text-muted-foreground">{product.sales}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={product.onEdit}>
                        <Edit2Icon className="size-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
