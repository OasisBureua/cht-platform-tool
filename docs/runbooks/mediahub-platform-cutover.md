# Runbook: MediaHub platform cutover (Phase 4)

Move `mediahub-api`, `mediahub-worker`, and `mediahub-reports` onto the CHT ECS cluster with separate MediaHub RDS.

**When to run:** Phase 4 — after Cognito prod stable and Phase 3 dev documented.

**Owner:** Uche Aduakaa  
**Reviewer:** Adaze Oviawe  
**Approved:** June 16, 2026 at 08:28 PM EDT  
**Status:** Draft outline — expand before execution

---

## Target state

| Service | Deploy | Database |
| ------- | ------ | -------- |
| mediahub-api | ECS Fargate ×2 | MediaHub RDS |
| mediahub-worker | ECS Fargate ×1 | MediaHub RDS |
| mediahub-reports | ECS Fargate ×1 + SQS | MediaHub RDS |

Separate repo: `mediahub-platform`. Same ECS cluster as chm-backend/chm-worker.

**MediaHub RDS:** Postgres 15.17, `db.t3.small`, Multi-AZ, 50 GB gp3.

---

## Pre-flight

- [ ] `mediahub-platform` repo with CI per service
- [ ] OpenAPI contract for `/api/public/*`
- [ ] Terraform modules for MediaHub RDS, ECS, SQS, S3, ElastiCache
- [ ] [cache-sync-contract.md](./cache-sync-contract.md) implemented
- [ ] Parallel run plan: EC2 MediaHub + new ECS until validated

---

## Data migration

1. `pg_dump` from MediaHub EC2 Postgres
2. Restore to `mediahub-db` RDS
3. Validate row counts (clips, KOLs, tags, analytics)
4. Point `mediahub-api` at new RDS in staging/dev first if AWS dev exists, else prod cutover window

---

## CHT integration cutover

1. Deploy Hub services to prod ECS (internal only)
2. Update CHT `MEDIAHUB_BASE_URL` to internal URL
3. Security group: chm-backend → mediahub-api:8000
4. Smoke: catalog, KOL network, HCP upsert
5. Decommission EC2 Compose stack

---

## Rollback

Keep EC2 MediaHub running until:

- [ ] 48h stable catalog traffic on new Hub
- [ ] Worker sync successful
- [ ] Reports pipeline tested (if in scope)

Revert `MEDIAHUB_BASE_URL` to external URL if needed.

---

## Exit criteria

- [ ] EC2 MediaHub retired
- [ ] Five ECS services deploy independently
- [ ] chm-backend never connects to MediaHub Postgres directly

See [CHM-Platform-Roadmap-Plan.md](../reports/CHM-Platform-Roadmap-Plan.md) Phase 4 for full checklist.
