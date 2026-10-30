# Admin domain Cognito groups (read vs write)

**Team-facing summary:** [admin-rbac-team-notice.md](./admin-rbac-team-notice.md)

## Model

| Actor | Admin GET / read UI | Create / Update / Delete |
| --- | --- | --- |
| `ADMIN` (no domain groups) | Yes (all domains) | No |
| `ADMIN` + domain group(s) | Yes | Yes for those domains only |
| `SUPER_ADMIN` | Yes | Yes (all domains) |

Base role stays in Postgres (`User.role`) and is mirrored to Cognito `cht-hcp` / `cht-admin` via `syncGroupsForRole`.

**Domain write membership is owned in Cognito.** On login and `GET /auth/me`, the API lists the user’s Cognito groups and writes `User.adminCapabilities`. Mutating admin APIs require the matching capability (UI disables controls; API returns 403).

## Groups

| Cognito group | Capability | Covers |
| --- | --- | --- |
| `cht-admin-payments` | `payments` | Pay now, hold/release, bulk, manual payout, payment deletes |
| `cht-admin-programs` | `programs` | Programs, webinars, registrations, invites, email overrides, Zoom recordings catalog writes |
| `cht-admin-surveys` | `surveys` | Survey create/update/delete, ensure/clone, comment tags |
| `cht-admin-reports` | `reports` | Report generate / regenerate / refresh |
| `cht-admin-content` | `content` | Content Hub campaigns, KOL admin mutations |

User role promote/delete remains **SUPER_ADMIN** only.

## Grant / revoke

### In the app (preferred)

1. Sign in as **Super Admin**.
2. Open **Admin → Users**.
3. Use the **Admin write access** panel (Super Admin only).
4. Toggle domain checkboxes for each `ADMIN` user (payments, programs, surveys, reports, content).
5. `SUPER_ADMIN` rows show all domains checked and disabled (always full write).

The API updates Cognito groups and `User.adminCapabilities`. The target should refresh the app (or `/auth/me`) to pick up new caps in their session.

### CLI (fallback)

```bash
# Example: allow finance write on payments (dev pool)
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <POOL_ID> \
  --username <cognito-username-or-email-lookup> \
  --group-name cht-admin-payments

aws cognito-idp admin-remove-user-from-group \
  --user-pool-id <POOL_ID> \
  --username <cognito-username-or-email-lookup> \
  --group-name cht-admin-payments
```

Terraform creates the empty groups under `infrastructure/terraform/modules/security/cognito`.

## Notes

- No grandfathering: existing `ADMIN`s keep **read** access after deploy but cannot mutate until added to a domain group.
- UI keeps mutate buttons **visible** but **disabled**, with a tooltip / alert naming the required Cognito group.
