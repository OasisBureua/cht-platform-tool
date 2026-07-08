# Specification: Deployed dev environment (Phase 3)

Deploy the **full hosted dev stack on AWS** (ECS, RDS, ALB, CI/CD) after Cognito **production** is stable.

**Cognito dev pool is not Phase 3 work** — provision `cht-platform-dev` in **Phase 2** together with prod (see [cognito-migration-spec.md](./cognito-migration-spec.md)). Phase 3 connects that existing pool to the hosted dev app.

**When to run:** Phase 3 kickoff — **not before** [cognito-prod-cutover.md](./cognito-prod-cutover.md) exit criteria (≥ 1–2 weeks stable prod auth).

**Scope:** ECS/RDS/domain/CI **deferred** until Phase 3 planning. Does not block Phase 2.

**Owner:** Uche Aduakaa  
**Reviewer:** Adaze Oviawe  
**Approved:** June 16, 2026 at 08:28 PM EDT  
**Status:** Outline — full stack spec TBD at Phase 3 kickoff

---

## Two-part model

| Work | Phase | What |
| ---- | ----- | ---- |
| **Cognito prod + dev pools** | **Phase 2** | Terraform: pools, app clients, groups, secrets — prod and dev **at the same time** |
| **Full AWS dev deploy** | **Phase 3** | ECS, RDS, ALB, S3, GitHub deploy workflow, dev domain |

---

## Goal

| Environment | Purpose | When |
| ----------- | ------- | ---- |
| **Local + dev Cognito pool** | Auth development, pre-cutover testing | Phase 2+ |
| **Hosted dev (AWS)** | Branch deploys, integration testing | **Phase 3** — after prod Cognito stable |
| **Prod** | Customer-facing | Phase 2 cutover |

---

## Prerequisites (Phase 3 kickoff)

- [ ] Cognito **prod** cutover complete and stable
- [ ] Cognito **dev** pool already provisioned (Phase 2b)
- [ ] Phase 1 follow-up complete

---

## Decisions to make at Phase 3 kickoff (TBD)

| Topic | Status |
| ----- | ------ |
| Cognito dev pool | ✅ Phase 2 — wire ECS to existing `cht-platform-dev` |
| Domain | _TBD_ |
| Terraform (`us-east-1-dev`) | _TBD_ |
| GitHub `dev` + deploy workflow | _TBD_ |
| ECS/RDS sizing | _TBD_ |
| MediaHub | External API until Phase 4 |

---

## Local dev (Phase 2+, ongoing)

See [local-cognito-setup.md](./local-cognito-setup.md):

- docker-compose Postgres
- Backend/frontend `.env` → **dev Cognito pool** (provisioned in Phase 2)
- Hosted dev in Phase 3 **adds** a deploy target; does not replace local work

---

## Exit criteria (define when Phase 3 is scoped)

- [ ] Dev URL live; auth via existing dev Cognito pool
- [ ] Branch deploy to dev without touching prod
- [ ] Prod remains the only customer-facing environment

**Next:** [mediahub-platform-cutover.md](./mediahub-platform-cutover.md) (Phase 4)
