# Use a same-origin server boundary for browser sessions and callbacks

The web app will reuse the existing backend login JWT through a Next.js server boundary, storing it in an authenticated-encrypted HttpOnly cookie with a bounded lifetime. This adds server-side credential handling and deployment-managed encryption instead of exposing a long-lived bearer token to browser JavaScript; it does not create a second identity system or global logout capability.

Register provider callbacks on the frontend server origin and relay successful callback parameters to the existing backend callback, which retains state validation and token exchange. This adapts the backend's JSON callback response into a clean Settings return flow, at the cost of coordinated provider/backend redirect configuration. The backend separately needs safe client-identity and granted-scope response additions for complete consent and connection displays.
