import { handlers } from "@/lib/auth/config"

// Auth.js's own endpoints: /api/auth/signin, /callback/google, /signout,
// /session, /csrf. The Google client's authorised redirect URI is
// `https://policy.nysgpt.com/api/auth/callback/google` — on our own domain,
// which is one of the reasons this path beat Cognito's, whose equivalent is
// hostage to a Cognito resource name.
export const { GET, POST } = handlers
