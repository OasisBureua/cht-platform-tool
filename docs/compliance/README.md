# Compliance documentation

SOC 2–supporting operational runbooks. These describe **what we do** when something goes wrong or when systems must be recovered.

| Doc | Purpose |
|-----|---------|
| [incident-response.md](./incident-response.md) | Detect, escalate, contain, and recover from security or availability incidents |
| [disaster-recovery.md](./disaster-recovery.md) | RDS backup/restore, ECS redeploy, RTO/RPO targets |

**Related:** public [Privacy Policy](../../frontend/src/pages/public/Privacy.tsx) and [Terms of Service](../../frontend/src/pages/public/Terms.tsx); technical controls in [infrastructure/README.md](../../infrastructure/README.md#security--soc-2-phase-1).

**Review cadence:** At least annually, and after any SEV-1/SEV-2 incident or major architecture change.

**Owners:** Update the *Roles* sections in each doc with named contacts before your first audit.
