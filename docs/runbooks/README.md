# Platform migration runbooks

Operational runbooks for the [CHM Platform Roadmap](../reports/CHM-Platform-Roadmap-Plan.md). These are **step-by-step execution guides**, not strategy documents.

**Related strategy docs:**

- [CHM-Platform-Roadmap-Plan.md](../reports/CHM-Platform-Roadmap-Plan.md)
- [CHT-Auth-Decoupling-Next-Steps-Report.md](../reports/CHT-Auth-Decoupling-Next-Steps-Report.md)
- [CHT-MediaHub-Go-Forward-Options.md](../reports/CHT-MediaHub-Go-Forward-Options.md)

## Phase 0 — Required before execution

| Runbook | Phase | Status |
| ------- | ----- | ------ |
| [secrets-migration-staging-to-prod.md](./secrets-migration-staging-to-prod.md) | Before staging destroy | Approved |
| [staging-teardown.md](./staging-teardown.md) | Phase 1 | Approved |
| [mediahub-auth-decommission-checklist.md](./mediahub-auth-decommission-checklist.md) | Phase 2 (parallel) | Approved |

## Later phases (draft outlines)

| Runbook | Phase | Status |
| ------- | ----- | ------ |
| [cognito-migration-spec.md](./cognito-migration-spec.md) | Phase 2 | In progress |
| [multi-region-active-passive-us-east-2.md](./multi-region-active-passive-us-east-2.md) | Phase 2b | In progress |
| [aurora-global-platform-migration.md](./aurora-global-platform-migration.md) | Platform DB / DR | Draft |
| [stable-dev-environment.md](./stable-dev-environment.md) | Phase 3 | Outline |
| [mediahub-platform-cutover.md](./mediahub-platform-cutover.md) | Phase 4 | Approved |
| [cache-sync-contract.md](./cache-sync-contract.md) | Phase 4 | Approved |

**Related engineering notes:** [auth-session-revocation.md](../engineering/auth-session-revocation.md).

## Sign-off

| Runbook | Owner | Reviewer | Approved date |
| ------- | ----- | -------- | ------------- |
| secrets-migration-staging-to-prod | Uche Aduakaa | Adaze Oviawe | June 16, 2026 at 08:28 PM EDT |
| staging-teardown | Uche Aduakaa | Adaze Oviawe | June 16, 2026 at 08:28 PM EDT |
| mediahub-auth-decommission-checklist | Uche Aduakaa | Adaze Oviawe | June 16, 2026 at 08:28 PM EDT |
| stable-dev-environment | Uche Aduakaa | Adaze Oviawe | June 16, 2026 at 08:28 PM EDT |
| mediahub-platform-cutover | Uche Aduakaa | Adaze Oviawe | June 16, 2026 at 08:28 PM EDT |
| cache-sync-contract | Uche Aduakaa | Adaze Oviawe | June 16, 2026 at 08:28 PM EDT |

**Review cadence:** Update after each phase completes or when architecture changes.
