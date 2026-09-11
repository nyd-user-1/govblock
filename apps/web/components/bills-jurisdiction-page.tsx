import { stateName } from "@/lib/filters"
import { BillsGate, BillsScope } from "@/components/bills-scope"
import { BillsList } from "@/components/bills-list"
import { DocsPage } from "@/components/docs-page"

// /bills/us, /bills/ny (Brendan, 2026-09-11): one jurisdiction's bills, the
// list /bills used to draw for whichever jurisdiction the header held, with
// the jurisdiction in the path instead. The gate greets a reader who may not
// open it with the list blurred and inert under a card that offers the two
// ways on; the list itself is the same for everyone.

export const jurisdictionTitle = (state: string) => (state === "US" ? "U.S. Congress" : stateName(state))

export function BillsJurisdictionPage({ state }: { state: string }) {
  const name = jurisdictionTitle(state)
  return (
    <DocsPage title={`${name} Bills`} description={`The bills most recently acted on in ${state === "US" ? "Congress" : name}, each with its full text.`} slug={`/bills/${state.toLowerCase()}`} previous={{ name: "Bills", url: "/bills" }} next={{ name: "Amendments", url: "/amendments" }}>
      <BillsGate state={state}>
        <BillsScope state={state}>
          <BillsList />
        </BillsScope>
      </BillsGate>
    </DocsPage>
  )
}
