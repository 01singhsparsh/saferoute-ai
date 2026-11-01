# SafeRoute AI source export

This archive contains application source, dependency lockfile, tests, public assets, and database migration files. It does not contain private API keys, environment values, repository metadata, installed dependencies, or generated build output.

## Run locally
1. Install Bun.
2. Run `bun install`.
3. Copy `.env.example` to `.env` and supply your own backend configuration.
4. Run `bun run dev`.
5. Run `bun run test` for automated tests.

The risk map uses CARTO basemap tiles and OpenStreetMap (Nominatim) place search. CARTO now requires a free API key (https://carto.com/basemaps/apikey/) or tiles render with an "API KEY REQUIRED" watermark — set `VITE_CARTO_API_KEY` in `.env` (see `.env.example`). Nominatim search still needs no key.

This export is not a database backup. Existing cloud data, user accounts, hosted settings, and service credentials are not included. Configure these separately when moving the app. The source targets Cloudflare Workers; a Vercel deployment is not verified.
