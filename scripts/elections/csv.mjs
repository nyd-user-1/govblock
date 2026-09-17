// A streaming CSV reader for the election files: RFC 4180 quoting, commas and
// line breaks inside quotes, CRLF or LF. Yields one array of strings a row.
// The ballot files run to 400 MB, so nothing is read whole.

export async function* rows(stream) {
  const decoder = new TextDecoder("utf-8")
  let field = ""
  let row = []
  let quoted = false
  let pendingQuote = false // saw a quote inside a quoted field; next char decides
  for await (const chunk of stream) {
    const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true })
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (pendingQuote) {
        pendingQuote = false
        if (c === '"') {
          field += '"'
          continue
        }
        quoted = false
      }
      if (quoted) {
        if (c === '"') pendingQuote = true
        else field += c
        continue
      }
      if (c === '"') quoted = true
      else if (c === ",") {
        row.push(field)
        field = ""
      } else if (c === "\n") {
        row.push(field.endsWith("\r") ? field.slice(0, -1) : field)
        yield row
        row = []
        field = ""
      } else field += c
    }
  }
  if (field !== "" || row.length) {
    row.push(field.endsWith("\r") ? field.slice(0, -1) : field)
    yield row
  }
}
