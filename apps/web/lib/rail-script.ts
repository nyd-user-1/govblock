// The pre-paint script for a page's rails (Brendan, 2026-09-13): lands the
// state this browser remembers — or, on a page that opens closed, closed —
// before the rails are laid out, so nothing flashes open and then shuts. A
// plain module, since the server layouts inline it; the live store is
// components/rail-toggle.tsx, which reads and writes the same keys.
export const railScript = (defaultClosed: boolean) =>
  `(function(){try{var d=document.documentElement,c=${defaultClosed ? "true" : "false"};["left","right","right-2","right-3","right-4"].forEach(function(s){var v=localStorage.getItem("rail:"+s);if(v==="closed"||(v!=="open"&&c))d.setAttribute("data-rail-"+s,"closed")})}catch(e){}})()`
