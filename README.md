# Amazuga

Rwanda property portal — browse, discover, and claim land parcels and property listings.

## Repos

This project spans two repositories:

| Repo | Purpose |
|---|---|
| **amazuga** (this repo) | Next.js app, Cloudflare infrastructure, DB schema, tile build + upload scripts |
| [scrape-rwanda-parcels](https://github.com/danksky/scrape-rwanda-parcels) | Parcel data pipeline — downloads from RNRA/DLUP, builds parquet outputs consumed by this repo |

## Infrastructure docs

- **[infra/RUNBOOK.md](infra/RUNBOOK.md)** — how to rebuild the preview DB, tiles, and R2 assets
- **[infra/sql/schema.sql](infra/sql/schema.sql)** — canonical DB schema with design rationale
- **[scrape-rwanda-parcels: pipeline data flow](https://github.com/danksky/scrape-rwanda-parcels/blob/main/docs/pipeline-data-flow.md)** — full map of what each pipeline step produces and consumes, and what to re-run for common change scenarios

## Stack

- **App** — Next.js 14, TypeScript, deployed on Vercel
- **Database** — Postgres on Neon
- **Map tiles** — PMTiles on Cloudflare R2, served via Cloudflare Workers
- **Listing media** — Cloudflare R2 with a custom upload/serve Worker
- **Infrastructure** — Terraform (Cloudflare, Neon, Vercel)
