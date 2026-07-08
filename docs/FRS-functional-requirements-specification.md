# Functional Requirements Specification (FRS)

**Product:** CHM Platform (cht-platform-tool) — public site, authenticated member app, and admin console.  
**Document type:** Draft FRS for whole-platform scope.  
**Companion design (Figma):** [CHM Platform — Screens & FRS Scope](https://www.figma.com/design/bud5cW5tvQyWNp6eZkWGMr/) — mixed content: legacy placeholder frames (pages `01`–`03`) plus **live HTML captures** pushed via Figma “HTML → Design” while `npm run dev` runs with `[frontend/index.html](../frontend/index.html)` capture script loaded. Prefer the **capture frames** (see page `05 — Captures from code (1:1)` or latest nodes appended to the file) for **pixel-faithful** screenshots of the SPA; placeholders are scaffolding only.

**Captured examples in-file (URLs when running locally):** `/app/home` ([22-2](https://www.figma.com/design/bud5cW5tvQyWNp6eZkWGMr?node-id=22-2)), `/app/catalog` ([25-2](https://www.figma.com/design/bud5cW5tvQyWNp6eZkWGMr?node-id=25-2)), `/app/surveys` ([26-2](https://www.figma.com/design/bud5cW5tvQyWNp6eZkWGMr?node-id=26-2)), `/app/podcasts` ([27-2](https://www.figma.com/design/bud5cW5tvQyWNp6eZkWGMr?node-id=27-2)), `/app/earnings` ([28-2](https://www.figma.com/design/bud5cW5tvQyWNp6eZkWGMr?node-id=28-2)). Run `VITE_DISABLE_AUTH=true npm run dev` plus Figma MCP capture hashes to append more routes the same way.  
**Revision:** Draft — verify against current implementation and compliance policies before sign-off.

---

## 1. Introduction

### 1.1 Purpose

This FRS describes **functional behavior** the platform shall provide: user-visible flows, validations, responses, errors, and edge cases. It is intended to align engineering, QA, and design (wireframes / high‑fidelity prototypes).

### 1.2 Definitions


| Term              | Meaning                                                            |
| ----------------- | ------------------------------------------------------------------ |
| **Visitor**       | Unauthenticated browser user                                       |
| **Member**        | Authenticated clinician / platform user (`/app`)                   |
| **Admin**         | User with elevated privileges (`/admin`)                           |
| **Catalog**       | Video/browse experience (playlists, disease areas, clips)          |
| **Program**       | Live session or office-hours style offering requiring registration |
| **Supabase Auth** | Primary identity provider used by the SPA                          |


### 1.3 Out of Scope (explicit)

- Exact API contracts / database schema  
- Detailed analytics taxonomy  
- Legal copy finalization (privacy/terms) unless referenced as placeholders  
- Non-functional SLAs unless noted as product expectations

### 1.4 Global prerequisites

- Responsive web application; keyboard-accessible interactive controls where applicable.  
- **Auth:** Protected areas require valid session; session expiry behaves per auth provider/session policy.  
- **Feature flags / env:** `VITE_DISABLE_AUTH` may bypass certain checks for local development only — behavior in production MUST NOT rely on bypass.

---

## 2. Cross-cutting requirements

### FRS-GLOBAL-001 — Navigation & deep links


| Field          | Specification                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Actors**     | Visitor, Member, Admin                                                                                                                    |
| **Trigger**    | User opens URL path or in-app navigation control                                                                                          |
| **Behavior**   | App renders the route mapped in the SPA; outdated paths redirect where defined (e.g. `/webinars` → `/live`).                              |
| **Errors**     | Unknown routes: Visitor → sensible home/catalog landing; Member under `/app` → fallback redirect to `/app/home` per router configuration. |
| **Edge cases** | Bookmarked stale IDs (deleted clip/program/survey): show not-found / friendly empty state; avoid infinite redirect loops.                 |


### FRS-GLOBAL-002 — Authentication state


| Field          | Specification                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Actors**     | Visitor, Member                                                                                                                                                  |
| **Trigger**    | Login, logout, token refresh failure, OAuth callback                                                                                                             |
| **Behavior**   | Session establishes member context; authenticated layout shows app chrome; protected routes inaccessible without session redirect to login (or configured path). |
| **Errors**     | Invalid credentials: inline message without revealing which field failed (security); OAuth error: actionable message + retry path.                               |
| **Edge cases** | Callback with missing/expired params; user closes OAuth window mid-flight; concurrent tabs logout.                                                               |


### FRS-GLOBAL-003 — Authorization (role-based)


| Field        | Specification                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| **Actors**   | Member, Admin                                                                                              |
| **Behavior** | Admin routes gated by admin role; unauthorized users shall not access admin layouts or privileged actions. |
| **Errors**   | 403-style experience in UI when API denies; redirect or “not authorized” screen for admin-only pages.      |


### FRS-GLOBAL-004 — Loading & empty states


| Field        | Specification                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Actors**   | All                                                                                                                     |
| **Behavior** | Long fetches show loading indicators or skeletons; lists with zero items show empty-state copy and CTAs where relevant. |
| **Errors**   | Network/server errors: surfaced with retry affordance where implemented.                                                |


### FRS-GLOBAL-005 — Forms & submissions


| Field          | Specification                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **Actors**     | All                                                                                                            |
| **Behavior**   | Required fields enforced client-side consistent with backend; destructive actions confirmed when risk is high. |
| **Errors**     | Validation summaries; preserve user input after recoverable failures.                                          |
| **Edge cases** | Double-submit protection for payments/registrations/surveys.                                                   |


---

## 3. Public marketing & informational site

Routes (representative): `/home`, `/about`, `/services`, `/portfolios`, `/contact`, `/join`, `/for-hcps`, `/what-we-do`, `/privacy`, `/terms`.

### FRS-PUB-001 — Home

**Actors:** Visitor.  
**Triggers:** Navigate to `/home`.  
**Main flow:** Display primary marketing content and entry points into catalog/search/programs.  
**Errors / edge:** Hero/media assets fail → graceful degradation (alt text / static fallback).

### FRS-PUB-002 — About / Services / Portfolios / What we do / For HCPs

**Actors:** Visitor.  
**Behavior:** Present static/edited content sections; outbound links open in sensible targets (same tab vs new) per UX policy.  
**Edge:** Broken external links minimized via CMS/process (out of runtime scope).

### FRS-PUB-003 — Contact

**Actors:** Visitor.  
**Behavior:** Capture enquiry or display contact modalities per implementation; confirm submission success.  
**Errors:** SMTP/API failure shows retry; rate limiting yields friendly messaging.

### FRS-PUB-004 — Join (interest / onboarding entry)

**Actors:** Visitor.  
**Behavior:** Multi-step or single form per implementation; success confirmation.  
**Errors:** Duplicate email/account rules from backend surfaced clearly.

---

## 4. Public catalog & media

Routes: `/catalog`, `/catalog/:diseaseSlug`, `/catalog/clip/:id`, `/catalog/playlist/:playlistId`, `/watch/:videoId` (compat redirect).

### FRS-PUB-CAT-001 — Catalog hub (videos)

**Actors:** Visitor, Member (public layout).  
**Behavior:** Lists browsable curriculum (playlists, tags, hubs) per content model; navigation to clips and playlists.  
**Errors:** Fetch failure banner; retry.  
**Edge:** Extremely long lists pagination/virtualization expectation.

### FRS-PUB-CAT-002 — Disease detail

**Actors:** Visitor.  
**Behavior:** Disease-scoped grouping of clips/resources; playable or deep-link behavior per media type.  
**Errors:** Unknown `diseaseSlug` → not found state.

### FRS-PUB-CAT-003 — Clip detail

**Actors:** Visitor.  
**Behavior:** Video or audio player shell, metadata, share controls if present, related clips.  
**Errors:** Missing clip ID or media unavailable → explanatory state.  
**Edge:** Playback errors (drm/network) surface player-level message.

### FRS-PUB-CAT-004 — Playlist detail

**Actors:** Visitor.  
**Behavior:** Ordered list of items with progress/jump semantics as implemented.  
**Errors:** Invalid playlist ID → not found.

---

## 5. Discovery & authentication (public shells)

Routes: `/search`, `/login`, `/forgot-password`, `/auth/callback`, `/complete-profile`.

### FRS-PUB-AUTH-001 — Search

**Actors:** Visitor.  
**Behavior:** Query content/sessions/surveys per backend capabilities; navigates to entities on select.  
**Errors:** Empty results copy; timeouts with retry.

### FRS-PUB-AUTH-002 — Login

**Actors:** Visitor.  
**Behavior:** Email/password or OAuth per configuration; redirects post-login via `postLoginRedirect` rules.  
**Errors:** Locked account/expired invitation if applicable; generic failure for ambiguous cases.  
**Edge:** Already logged-in user hits `/login` → redirect into app/catalog.

### FRS-PUB-AUTH-003 — Forgot password

**Actors:** Visitor.  
**Behavior:** Initiate reset workflow; acknowledge email sent without confirming address existence where security requires.  
**Errors:** Rate limit exceeded.

### FRS-PUB-AUTH-004 — Auth callback & profile completion

**Actors:** Visitor → Member.  
**Behavior:** Establish session after IdP handshake; funnel incomplete mandatory profile fields via `/complete-profile`.  
**Errors:** Invalid/expired OAuth state; retries to login.

---

## 6. Public programs

Routes: `/live`, `/live/:id`, redirects from `/webinars`*, `/chm-office-hours`, `/chm-office-hours/:id`, `/surveys` (listing).

### FRS-PUB-PROG-001 — Live / webinars listing & detail

**Actors:** Visitor.  
**Behavior:** Upcoming/live/replay states; ICS or external links where applicable; CTA toward registration or replay.  
**Errors:** Deleted program → not found.  
**Edge:** Timezone display consistency.

### FRS-PUB-PROG-002 — Office hours listing & detail

**Actors:** Visitor.  
**Behavior:** Same pattern as programs with office-hours branding; registration CTA if required.  
**Errors:** Session full / closed registration states if implemented.

### FRS-PUB-PROG-003 — Public surveys listing

**Actors:** Visitor.  
**Behavior:** Shows available surveys; deep link to survey experience (see member surveys for logged-in completion).  
**Errors:** None available → empty state.

---

## 7. Public KOL / DOL network

Routes: `/kol-network`, `/kol-network/:regionSlug`, `/kol-network/profile/:kolId`.

### FRS-PUB-KOL-001 — Network hub & region

**Actors:** Visitor.  
**Behavior:** Explore directory by region; filter/list patterns per UI.  
**Errors:** Unknown region slug.

### FRS-PUB-KOL-002 — KOL profile

**Actors:** Visitor.  
**Behavior:** Profile fields, links, associated content if any.  
**Errors:** Unknown `kolId` → not found.

---

## 8. Member app (`/app/`*)

Global: layout with app navigation; requires Member session.

### FRS-APP-001 — Dashboard (`/app/home`)

**Actors:** Member.  
**Behavior:** Summary of prioritized actions (programs, surveys, payouts, highlights).  
**Errors:** Partial widget failure does not blank entire dashboard when isolated error boundaries exist.

### FRS-APP-002 — Explore opportunities / in-app search (`/app/search`)

**Actors:** Member.  
**Behavior:** Search/register affordances tuned to authenticated user (eligibility nuances per API).  
**Errors:** Unauthorized opportunities hidden or messaged appropriately.

### FRS-APP-003 — Programs — live webinars (`/app/live`, `/app/live/:id`, register)

**Actors:** Member.  
**Behavior:** List, filters, detail, join/register flow; integrates `ProgramRegisterWizard` for qualifying paths.  
**Errors:** Registration closed; capacity exceeded; prerequisite profile incomplete redirects to Settings/Complete Profile.  
**Edge cases:** Double registration attempt; cancelling registration if supported.

### FRS-APP-004 — Office hours (`/app/chm-office-hours`…)

**Actors:** Member.  
**Behavior:** Mirrors webinars pattern within office-hours context.  
**Errors:** Same class as webinars.

### FRS-APP-005 — Surveys (`/app/surveys`, `/app/surveys/:id`)

**Actors:** Member.  
**Behavior:** Assigned/available surveys; capture responses; autosave/interstitial behavior per survey engine.  
**Errors:** Submission API failure with retry and draft retention if implemented.  
**Edge:** Survey retracted mid-session.

### FRS-APP-006 — Catalog in app (`/app/catalog`…)

**Actors:** Member.  
**Behavior:** Authenticated playback context; entitlement checks if gated content exists server-side.  
**Errors:** 403 with explanation for gated items.

### FRS-APP-007 — Watch deep link (`/app/watch/:videoId`)

**Actors:** Member.  
**Behavior:** Dedicated player shell / redirect into clip page per routing.  
**Errors:** Missing media → not found.

### FRS-APP-008 — Playlists (`/app/catalog/playlist/:playlistId`)

**Actors:** Member.  
**Behavior:** Continue watching, ordered navigation.  
**Errors:** Playlist removed.

### FRS-APP-009 — Podcasts (`/app/podcasts`, show routes if present)

**Actors:** Member.  
**Behavior:** Listing, series/detail, playback or external integrations per implementation.  
**Errors:** Feed failures.

### FRS-APP-010 — Earnings (`/app/earnings`)

**Actors:** Member.  
**Behavior:** Summaries of honoraria/earnings, statuses, explanatory copy.  
**Errors:** Payroll/payout vendor errors surfaced with reference/support path.  
**Edge:** Negative adjustments or clawbacks communicated clearly.

### FRS-APP-011 — Payments (`/app/payments`)

**Actors:** Member.  
**Behavior:** Payment profile, tax/eligibility widgets, payout method onboarding per integrations.  
**Errors:** Verification failures from vendor; remediation steps.

### FRS-APP-012 — Settings (`/app/settings`)

**Actors:** Member.  
**Behavior:** Profile, notifications, preferences, security actions allowed by backend.  
**Errors:** Conflict on save.

### FRS-APP-013 — Chatbot (`/app/chatbot`)

**Actors:** Member.  
**Behavior:** Guided assistance; disclaimers when model/advisory limits apply per policy.  
**Errors:** Service unavailable; timeout.

---

## 9. Registration wizard (member)

Routes: `/app/live/:id/register`, `/app/chm-office-hours/:id/register` (and webinar alias redirects).

### FRS-APP-REG-001 — Multi-step registration

**Actors:** Member.  
**Preconditions:** Eligible session; prerequisites satisfied.  
**Main flow:** Stepper collects required attestations/info; submits registration transaction.  
**Validations:** Per-step required fields; attestation acceptance where legally required.  
**Outputs:** Confirmation screen/state; reflects in Programs list detail.  
**Errors:** Duplicate registration; transient network; server validation messages per field/group.  
**Edge cases:** User navigates back mid-flow; refreshes browser; session expires before submit → re-auth + resume expectation defined by implementation.

---

## 10. Admin console (`/admin/`*)

**Actor:** Admin only.

### FRS-ADM-001 — Dashboard

**Behavior:** Operational snapshot; shortcuts to approvals, schedules, surveys.  
**Errors:** Aggregated widgets fail independently.

### FRS-ADM-002 — Programs administration

Routes include program list/hub contexts (`/admin/programs`, `:programId/hub`).  
**Behavior:** Manage program metadata, statuses, linkage to webinars/office hours as implemented.  
**Errors:** Conflict on edits; concurrency messaging.

### FRS-ADM-003 — Webinar approvals (`/admin/webinar-approvals`)

**Behavior:** Review queue with approve/reject/comments per workflow.  
**Errors:** Already processed items; stale state refreshes after action.

### FRS-ADM-004 — Schedulers (`/admin/webinar-scheduler`, `/admin/office-hours-scheduler`)

**Behavior:** Configure Zoom/session types defaults; scheduling UI with validations (time zone, recurrence if any).  
**Errors:** Zoom/API quota; invalid host settings.

### FRS-ADM-005 — Surveys CMS (`/admin/surveys`, create, edit)

**Behavior:** Authoring, versioning if applicable; publish/unpublish semantics.  
**Errors:** Broken question schema save blocked with detail.

### FRS-ADM-006 — Admin payments (`/admin/payments`)

**Behavior:** Operational payment views / actions scoped to admins.  
**Errors:** Sensitive actions audited; confirmations on irreversible ops.

### FRS-ADM-007 — Users (`/admin/users`)

**Behavior:** Search, suspend, invite, role tweaks per policy; PII safeguards.  
**Errors:** Duplicate invite; conflicting role transitions.

### FRS-ADM-008 — HCP explorer (`/admin/hcp-explorer`)

**Behavior:** Search/drill-down for clinicians with permission checks.  
**Errors:** Unauthorized export attempted → blocked UX.

### FRS-ADM-009 — Rx analytics (`/admin/rx-analytics`)

**Behavior:** Charts/tables respecting data governance; anonymization thresholds if required.  
**Errors:** Incomplete data periods labeled.

### FRS-ADM-010 — Settings (`/admin/settings`)

**Behavior:** Tenant-level knobs as implemented.  
**Errors:** Validation failures; revert model if supported.

---

## 11. Traceability (requirements ↔ UX surfaces)

Use this matrix when syncing Figma frames to tests.


| Requirement ID | Primary routes / surfaces                                  |
| -------------- | ---------------------------------------------------------- |
| FRS-GLOBAL-*   | App-wide patterns                                          |
| FRS-PUB-*      | `/home`, informational pages                               |
| FRS-PUB-CAT-*  | `/catalog`*                                                |
| FRS-PUB-AUTH-* | `/login`, `/auth/callback`, `/complete-profile`, `/search` |
| FRS-PUB-PROG-* | `/live`*, `/chm-office-hours*`, `/surveys` listing         |
| FRS-PUB-KOL-*  | `/kol-network`*                                            |
| FRS-APP-*      | `/app/`* feature pages                                     |
| FRS-APP-REG-*  | `*/register` wizard                                        |
| FRS-ADM-*      | `/admin/`*                                                 |


---

## 12. Acceptance checklist (QA)

Per feature ID above:

1. Happy path renders and persists correct state server-side where applicable.
2. Listed error states reproducible via fixtures or mocked API.
3. Edge cases (empty, stale ID, logout mid-flow) covered by cases in §2 and feature sections.
4. Accessibility: focus order sensible; major interactive elements reachable by keyboard where required by policy.

---

## 13. Approval


| Role        | Name | Date | Signature |
| ----------- | ---- | ---- | --------- |
| Product     |      |      |           |
| Design      |      |      |           |
| Engineering |      |      |           |
| Compliance  |      |      |           |


---

*End of draft FRS.*