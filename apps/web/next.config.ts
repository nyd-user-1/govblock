import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@govblock/ui"],

  // Amplify hands its environment variables to the build, not to the Next.js
  // server runtime, so without this the deployed site reads `undefined` and
  // quietly falls back to the committed snapshots. These three are resource
  // identifiers, not credentials -- reaching the cluster still needs the
  // compute role -- and they are only referenced from server code, so Next
  // inlines them into the server bundle and nothing reaches the browser.
  env: {
    POLICY_CLUSTER_ARN: process.env.POLICY_CLUSTER_ARN ?? "",
    POLICY_SECRET_ARN: process.env.POLICY_SECRET_ARN ?? "",
    POLICY_DATABASE: process.env.POLICY_DATABASE ?? "policy",
  },
}

export default nextConfig
