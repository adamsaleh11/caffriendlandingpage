import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig = (phase: string): NextConfig => ({
  // Builds replace their output tree. Keep development manifests separate so a
  // concurrent `next build` cannot remove files that `next dev` is writing.
  //
  // Two dev servers at once hit the same problem between themselves: the Playwright
  // suite starts its own on 3100, and a second one left open for clicking through
  // would share this directory and serve half of the other's build. `NEXT_DIST_DIR`
  // gives that second server a tree of its own.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? (process.env.NEXT_DIST_DIR || ".next-dev") : ".next",
  // A stray lockfile in the home directory made Turbopack treat ~/ as the project
  // root, so dev watched every file under it. This pins the root to this project.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        // Authenticated and authorization surfaces are private and must not be shared-cached.
        source: '/:path(app|login|oauth|crm-calendar)/:rest*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, private' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/api/:rest*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, private' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
});

export default nextConfig;
