# Checklist: MediaHub auth decommission (coordination)

MediaHub team actions required for Cognito cutover. CHT cannot complete Phase 2 alone.

**Owner:** Uche Aduakaa  
**Reviewer:** Adaze Oviawe  
**Approved:** June 16, 2026 at 08:28 PM EDT  
**Cutover date:** _TBD_

---

## Scope

| Actor | After cutover |
| ----- | ------------- |
| HCP / KOL / Industry end users | **No** MediaHub UI, GoTrue, or auth URLs |
| CHT backend | **Yes** — `/api/public/*` via `MEDIAHUB_API_KEY` only |
| CHM admin / content ops | **Yes** — MediaHub admin UI via Cognito `mediahub-admin` client |

---

## Pre-cutover confirmations

- [ ] **API key continuity** — `MEDIAHUB_API_KEY` in CHT prod Secrets Manager remains valid through cutover week
- [ ] **No auth coupling in public API** — `/api/public/hcp/upsert` and catalog routes accept API key only (no user JWT required)
- [ ] **OAuth redirect block list** — MediaHub/nginx stops accepting CHT end-user OAuth callbacks at `mediahub.communityhealth.media`
- [ ] **Admin access plan** — how CHM staff authenticate to MediaHub UI post-cutover (Cognito admin client)

---

## Cutover day (coordinate with [cognito-prod-cutover.md](./cognito-prod-cutover.md))

| Time (UTC) | MediaHub action | CHT action | Done |
| ---------- | --------------- | ---------- | ---- |
| T+0 | Confirm API key active | Begin user import | |
| T+0 | Block end-user GoTrue login paths | Deploy Cognito backend | |
| T+1h | Deactivate/archive non-admin GoTrue user records | Verify catalog API | |
| T+2h | Confirm admin login works | Smoke tests | |
| T+48h | Written confirmation: GoTrue off for end users | Remove GoTrue secrets | |

---

## GoTrue user records (end users)

MediaHub actions:

- [ ] Export GoTrue user list for CHT migration ([cognito-user-migration.md](./cognito-user-migration.md))
- [ ] Deactivate (not delete) learner/HCP/KOL GoTrue accounts — **preserve content/HCP data in MediaHub DB**
- [ ] Remove CHT register-profile / end-user invitation flows

**Do not** revoke API keys or delete clip/KOL/HCP content data.

---

## Admin users

- [ ] Create Cognito users for MediaHub admins/editors in `mediahub-admin` client
- [ ] Map to groups: `mediahub-admins`, `mediahub-editors`
- [ ] Retire GoTrue admin login after Cognito admin login verified

---

## Rollback coordination

If CHT rolls back to GoTrue within 48h:

- [ ] MediaHub re-enables end-user GoTrue OAuth redirects (pre-agreed rollback window only)
- [ ] MediaHub restores deactivated GoTrue accounts from archive if needed

---

## Written sign-off (MediaHub liaison)

> MediaHub has decommissioned GoTrue for all non-admin CHT end users as of __________. API key integration for CHT backend remains active. Admin access is via Cognito mediahub-admin client.

Name: Uche Aduakaa  
Reviewer: Adaze Oviawe  
Date: June 16, 2026 at 08:28 PM EDT

---

## Exit criteria

- [ ] Sign-off received
- [ ] CHT catalog and HCP upsert verified post-cutover
- [ ] No end-user URLs point to MediaHub for authentication
