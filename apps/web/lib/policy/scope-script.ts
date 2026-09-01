import { JURISDICTION_KEY } from "@/lib/policy/jurisdiction"

// The prerendered HTML is Congress's, because it is one document served to
// everybody. A Texas visitor therefore sees Congress until React hydrates —
// measured at ~250 ms, which is long enough to read.
//
// This runs blocking in <head>, before first paint, and stamps the jurisdiction
// the page is *about* to resolve to onto <html>. The CSS below then hides the
// prerendered body for anyone who is not Congress, until the provider has
// resolved on the client and marked the document ready. Congress keeps its
// instant content; everybody else gets a neutral first paint instead of the
// wrong legislature's. Same shape as next-themes' anti-flash script.
//
// It must agree with useJurisdictionValue's own precedence — URL, then this
// browser's memory, then the default — or the two would disagree for a frame.
export const SCOPE_SCRIPT = `(function(){try{
var s=(location.search.match(/[?&]state=([A-Za-z]{2})(?:&|$)/)||[])[1];
if(!s){var raw=localStorage.getItem(${JSON.stringify(JURISDICTION_KEY)});
if(raw){var v=JSON.parse(raw);if(v&&v.state)s=v.state}}
document.documentElement.dataset.scope=(s||"US").toUpperCase()
}catch(e){document.documentElement.dataset.scope="US"}})()`

export const SCOPE_STYLE = `html[data-scope]:not([data-scope="US"]):not([data-scope-ready]) [data-scope-content]{visibility:hidden}`
