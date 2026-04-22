# CHT Platform — Sebastien's AI-Assisted Development Notes

This directory contains Sebastien's personal workflow scaffold for AI-assisted
development on CHT Platform. Other contributors can ignore it — nothing in this
directory is enforced on anyone else's workflow.

## What's in here

- `CLAUDE.md` — this file, plus shared rules/context loaded when Claude works in this repo
- `daily/` — timestamped notes on what was done / what's next. Pushed to remote so sessions are continuous across machines.
- `plans/` — detailed implementation plans drafted before executing features
- `research/` — investigation docs that informed decisions

## Repo facts worth loading automatically

- Stack: React 18 + Vite 7 (frontend), NestJS + Prisma (backend), Python workers, AWS ECS Fargate + S3 + CloudFront
- Frontend: `frontend/` — Vite dev server on `:5173` by default, `npm run build` compiles to `dist/`
- Backend: `backend/` — NestJS on `:3000` (overridable via `PORT`), Prisma schema at `backend/prisma/schema.prisma`
- Auth: Supabase GoTrue (shared with MediaHub via `GOTRUE_JWT_SECRET`)
- Deploy: GitHub Actions → S3 + CloudFront. `main` auto-deploys to `testapp.communityhealth.media` (dev). Tags `v*` deploy to prod.
- Repo owners: Uche Aduaka + Adaze (backend + infra). Sebastien takes frontend + integration (MediaHub sync, Mailchimp, HubSpot, SEO).

## Sebastien's personal working habits (not prescribing these to the team)

- **One commit per logical unit of work.** No micro-fix chains.
- **`./verify.sh` before pushing.** Mirrors `pr-validation.yml`, catches failures locally.
- **`./smoke.sh <url>` after deploy.** Confirms health + page render + auth endpoint.
- **Feature branches only.** Never push directly to `main`.
- **Staging-first.** Every PR auto-deploys to `testapp.` on merge-to-main; confirm there before tagging prod.
- **`.env` never committed.** `.env.example` tracks schema.

## What NOT to touch without coordination

- **Backend module surfaces owned by Uche/Adaze**: `backend/src/auth/`, `backend/src/modules/**` NestJS controllers, Prisma migrations, `infrastructure/`, `.github/workflows/deploy-*.yml`.
- **Production deploys** — these go through the tagged-release gate, not direct pushes.
- **Auth-related schema changes** — always PR + review, never land unilaterally.

## Reference docs worth linking

- Strategic landscape for overhaul: `../ops-console/.claude/research/cht-strategic-landscape-2026-04-21.md`
- Platform audit: `../ops-console/.claude/research/cht-codebase-audit-2026-04-22.md`
- SEO publishing requirements (Google News): same strategic doc, "Gap 1" section
- CME accreditation path: same strategic doc, "Gap 3" section

(These live in Sebastien's ops-console working copy, not in this repo. They inform what gets built here.)
