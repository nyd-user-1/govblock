"use client"

import { PageTitle } from "@/components/admin/page-title"
import { Card, CardContent } from "@govblock/ui/components/nova/card"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"

// paceui's Dashboard Skeleton: the loading state of a dashboard, four tiles,
// a wide chart beside a narrow one, and a table.

export function SkeletonPage() {
  return (
    <div>
      <PageTitle title="Dashboard Skeleton" endContent={<span />} />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="sm:p-5">
            <CardContent className="flex flex-col gap-3 p-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        <Card className="sm:p-5 lg:col-span-2 xl:col-span-3">
          <CardContent className="flex flex-col gap-4 p-0">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card className="sm:p-5 lg:col-span-1">
          <CardContent className="flex flex-col gap-4 p-0">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mx-auto size-40 rounded-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 sm:mt-5">
        <Card className="sm:p-5">
          <CardContent className="flex flex-col gap-3 p-0">
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-5 gap-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
            {Array.from({ length: 6 }, (_, r) => (
              <div key={r} className="grid grid-cols-5 gap-3">
                {Array.from({ length: 5 }, (_, c) => (
                  <Skeleton key={c} className="h-5 w-full" />
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
