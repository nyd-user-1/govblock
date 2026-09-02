"use client"

import * as React from "react"

import { Button } from "@govblock/ui/components/ny4/button"

// The PDF itself, from S3.
//
// The signed URL is fetched here rather than rendered into the page for one
// reason: it expires in fifteen minutes. A page that carried the signature in
// its HTML would be uncacheable, and any copy of it that outlived the quarter
// hour would show a reader an XML access-denied document where the form should
// be. Asking for the URL on mount means the page can be cached and the link is
// always minted for the person looking at it.
//
// The bytes never touch this app or the Data API: the browser fetches them from
// S3 with the signature, which is the whole point of signing one.

type Answer = { pdf: string | null; pdfError: string | null }

export function FormsDoc({ id, title }: { id: number; title: string }) {
  const [answer, setAnswer] = React.useState<Answer | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(`/api/policy/forms/${id}`)
        if (!response.ok) throw new Error(String(response.status))
        const data = (await response.json()) as Answer
        if (!cancelled) setAnswer(data)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (failed || answer?.pdfError) {
    return (
      <p className="not-typeset my-6 text-sm text-muted-foreground">
        {answer?.pdfError ?? "The PDF could not be signed for just now."} The original is linked in the facts above.
      </p>
    )
  }

  if (!answer?.pdf) {
    return (
      <div className="not-typeset my-6 flex h-[900px] w-full items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
        Fetching the PDF from S3…
      </div>
    )
  }

  return (
    <div className="not-typeset my-6 flex flex-col gap-3">
      <iframe
        src={answer.pdf}
        title={title}
        className="h-[900px] w-full rounded-lg border bg-muted/30"
        // The browser's own PDF viewer. It is the one every reader already
        // knows how to use, and it does not cost the page a viewer bundle.
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" className="shadow-none" asChild>
          <a href={answer.pdf} target="_blank" rel="noopener noreferrer">
            Open the PDF
          </a>
        </Button>
        <Button variant="secondary" size="sm" className="shadow-none" asChild>
          {/* `download` on a cross-origin href is advisory — S3 serves the file
              and the browser decides — so this is honestly labelled "Save". */}
          <a href={answer.pdf} download>
            Save a copy
          </a>
        </Button>
      </div>
    </div>
  )
}
