"use client"

import * as React from "react"

import { Button } from "@govblock/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@govblock/ui/components/card"
import { Checkbox } from "@govblock/ui/components/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@govblock/ui/components/field"

// The four rows Brendan mocked. The card was the finance demo's — deposits,
// logins, goal milestones, a portfolio summary — on a site about legislatures.
//
// His mock spelled it "ammendment"; this ships "amendment".
const NOTIFICATIONS = [
  {
    id: "bills",
    label: "Bill alerts",
    description: "Get amendment, status, and votes updates.",
    defaultChecked: true,
  },
  {
    id: "committees",
    label: "Committee alerts",
    description: "Get agenda, hearing, and vote updates.",
    defaultChecked: true,
  },
  {
    id: "members",
    label: "Member alerts",
    description: "Get Member-specific updates.",
    defaultChecked: true,
  },
  {
    id: "votes",
    label: "Vote alerts",
    description: "Get itemized vote results.",
    defaultChecked: false,
  },
]

export function NotificationSettings() {
  const [checked, setChecked] = React.useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATIONS.map((n) => [n.id, n.defaultChecked]))
  )

  const allChecked = NOTIFICATIONS.every((n) => checked[n.id])
  const someChecked = NOTIFICATIONS.some((n) => checked[n.id]) && !allChecked

  const handleSelectAll = (value: boolean) => {
    setChecked(Object.fromEntries(NOTIFICATIONS.map((n) => [n.id, value])))
  }

  const handleToggle = (id: string, value: boolean) => {
    setChecked((prev) => ({ ...prev, [id]: value }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Choose what you want to be notified about.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
            <Checkbox
              id="notify-all"
              checked={allChecked}
              indeterminate={someChecked}
              onCheckedChange={(v) => handleSelectAll(!!v)}
            />
            <FieldContent>
              <FieldLabel htmlFor="notify-all">Select all</FieldLabel>
            </FieldContent>
          </Field>
          {NOTIFICATIONS.map((n) => (
            <Field key={n.id} orientation="horizontal">
              <Checkbox
                id={`notify-${n.id}`}
                checked={checked[n.id]}
                onCheckedChange={(v) => handleToggle(n.id, !!v)}
              />
              <FieldContent>
                <FieldLabel htmlFor={`notify-${n.id}`}>{n.label}</FieldLabel>
                <FieldDescription>{n.description}</FieldDescription>
              </FieldContent>
            </Field>
          ))}
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Save Preferences</Button>
      </CardFooter>
    </Card>
  )
}
