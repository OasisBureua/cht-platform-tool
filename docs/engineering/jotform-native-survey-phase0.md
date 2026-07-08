# Phase 0: JotForm → Native Survey Field Mapping

**Source exports (repo root):**
- `Post-Event Survey.pdf` → form `260698533879881`
- `Test Intake Fofm.pdf` → form `261116295463861` (default webinar intake)

**Not visible in PDF exports (required in JotForm today):**
- Hidden `user_id` — CHT user UUID (prefilled on embed)
- Hidden `program_id` — program UUID (prefilled on embed; post-event only)

---

## Form 1 — Post-event survey (per-program / sponsor template)

**Example URL:** https://communityhealthmedia.jotform.com/260698533879881  
**Used for:** Post-webinar feedback; honorarium gate after acknowledge  
**Backend today:** `Survey` row (`type=FEEDBACK`, `jotformFormId=…`); webhook → `SurveyResponse.answers`

**Product decision:** Post-event content is **not** one global form. Each webinar gets a **sponsor- or program-specific** question set (the HER2/T-DXd PDF is one template example). When a webinar is **created in admin** or **imported via Zoom webhook**, the platform should **auto-create** native `Survey` records for that program — intake at registration time and post-event after the session (replacing today’s JotForm clone/attach flow in `SurveysService`).

### Section A — Identity (may pre-fill from CHT profile)

| # | Label | Type | Required | Native notes |
|---|-------|------|----------|--------------|
| A1 | Name (First / Last) | text (split) | yes | **Do not collect in survey UI** when authenticated — bind from session server-side |
| A2 | Email | email | yes | Same — server binds `userId`; never accept client-supplied email for identity |
| A3 | Organization | text | yes | Pre-fill from profile; editable only if missing |
| A4 | Need a W9? Download | link/info | no | Replace with in-app W9 status + link to profile/payments |

### Section B — Demographics (Q1–Q5)

| # | Label | Type | Options |
|---|-------|------|---------|
| 1 | Primary role | single_choice | Medical Oncologist; APP (NP/PA); Pharmacist; Nurse/Navigator; Other |
| 2 | Practice setting | single_choice | Academic/teaching; Community w/ research; Community w/o research; Hybrid; Other |
| 3 | Years in independent clinical practice | single_choice | 0–5; 6–10; 11–20; >20; Prefer not to answer |
| 4 | HER2+ mBC patients actively managed | single_choice | ≤5; 6–10; 11–20; 21–40; >40 |
| 5 | Patients treated with T-DXd to date | single_choice | 0; 1–5; 6–15; >15; Unsure |

### Section C — Clinical practice (Q6–Q23)

| # | Label | Type | Options / notes |
|---|-------|------|-----------------|
| 6 | Initial systemic regimen (HER2+ mBC) | single_choice + conditional text | 5 options; **if** "No single go-to" → text follow-up |
| 7 | HR+/HER2+ typical plan | single_choice + conditional text | 5 options; **if** "Varies substantially…" → text follow-up |
| 8 | DB-09 familiarity | single_choice | 5 options |
| 9 | DB-09 discussion impact | single_choice | 5 options |
| 10 | T-DXd + pertuzumab 1L impact | single_choice | 5 options |
| 11 | Proportion receiving T-DXd + pertuzumab 1L | single_choice | 6 options |
| 12 | Factors pushing T-DXd 1L | multi_choice (max 3) | 7 options |
| 13 | Factors pushing THP / non–T-DXd 1L | multi_choice (max 3) | 7 options |
| 14 | T-DXd + pertuzumab treatment plan | single_choice | 5 options |
| 15 | Future maintenance integration | single_choice | 5 options |
| 16 | When introduce endocrine therapy | single_choice | 5 options |
| 17 | Biggest barrier to T-DXd + pertuzumab adoption | single_choice | 8 options |
| 18 | ILD monitoring approach | single_choice | 6 options |
| 19 | Antiemetic approach (cycle 1) | single_choice | 6 options |
| 20 | Next step for fatigue/nausea on response | single_choice | 7 options |
| 21 | Post-progression next regimen | single_choice + conditional text | 8 options; **if** "Depends on site…" → text |
| 22 | Evidence to increase confidence (max 3) | multi_choice (max 3) | 7 options |
| 23 | Anticipated practice change / faculty questions | long_text | free text |

### Native schema summary (post-event)

- **27 answer fields** (3 identity + 23 numbered + 3 conditional text branches)
- Question types needed: `single_choice`, `multi_choice` (with max), `long_text`, `info/link`
- Conditional logic: 3 show-if rules (Q6, Q7, Q21)
- **Program-specific content:** Store full `Survey.questions` JSON on each program’s FEEDBACK survey; seed from sponsor/topic **templates** at create/import time (admin can edit before publish)

---

## Form 2 — Webinar intake (per-program; default template)

**Example URL:** https://communityhealthmedia.jotform.com/261116295463861  
**Used for:** Webinar registration before session  
**Backend today:** Webhook only sets `ProgramRegistration.intakeJotformSubmissionId` — **does not parse field values into User**

**Product decision:** Same as post-event — **one intake survey auto-created per webinar** at create/import, cloned from a default template (fields below). Admin may customize before publish.

### Confirmed field list (production JotForm)

| # | Label | Type | Required | Native notes |
|---|-------|------|----------|--------------|
| 1 | Name | text | yes | Hidden when logged in — use `User.firstName` |
| 2 | Last Name | text | yes | Hidden when logged in — use `User.lastName` |
| 3 | Email | email | yes | Hidden when logged in — server binds from session; show helper text only if guest flow ever added |
| — | *(helper)* | info | — | “We will send your confirmation and join link to this email.” — in-app copy on register page |
| 4 | Phone Number | phone (area + number) | no | Collect if missing on profile |
| 5 | Organization | text | yes | Pre-fill `User.institution`; required if empty |
| 6 | Company Address — street | text | no | Map to profile address fields |
| 7 | Street Address Line 2 | text | no | |
| 8 | City | text | yes | |
| 9 | State / Province | text | yes | |
| 10 | Postal / Zip Code | text | no | |
| 11 | Company Website | url | no | Optional |
| 12 | LinkedIn Account Handle | text | no | Optional profile |
| 13 | X Account Handle | text | no | Optional profile |
| 14 | How would you like to receive your honorarium? | single_choice | yes | Check; PayPal/Zelle; ACH/Wire |
| 15 | Please provide payment instructions | long_text | yes* | Show when honorarium method selected; sync to payments profile |

### Native intake — what to build

Today intake webhook **only** records submission ID + creates pending registration. Native intake should:

1. `POST /api/programs/:programId/register` with structured body
2. Optionally sync payment preference → user profile / Bill.com onboarding path
3. Still require user logged in (`user_id` from session, not hidden field)
4. Reuse existing approval flow (`registrationRequiresApproval`)

### Gap vs CHT Join flow

Platform **Join** already collects: name, email, password, profession, NPI, institution, city, state, zip.  
Intake form duplicates org/address/payment — native design should **merge** with profile (collect missing fields only).

---

## Recommended native question JSON shape

```json
{
  "version": 1,
  "sections": [
    {
      "id": "demographics",
      "title": "About you",
      "questions": [
        {
          "id": "q1_role",
          "type": "single_choice",
          "prompt": "Which best describes your primary role?",
          "required": true,
          "options": ["Medical Oncologist", "Advanced Practice Provider (NP/PA)", "..."]
        },
        {
          "id": "q6_initial_regimen",
          "type": "single_choice",
          "prompt": "For de novo or relapsed HER2-positive...",
          "required": true,
          "options": ["...", "No single go-to; case-by-case"],
          "followUp": {
            "whenOption": "No single go-to; case-by-case",
            "question": {
              "id": "q6_other",
              "type": "long_text",
              "prompt": "Briefly describe:",
              "required": false
            }
          }
        },
        {
          "id": "q12_tdxd_factors",
          "type": "multi_choice",
          "prompt": "Factors pushing T-DXd 1L (select up to 3)",
          "required": true,
          "maxSelections": 3,
          "options": ["..."]
        }
      ]
    }
  ]
}
```

---

## Phase 1+ priorities (from this mapping)

1. **Program lifecycle:** On webinar create (admin) or Zoom import, create **two** native surveys per program — **intake** (registration) + **post-event** (`FEEDBACK`) — from sponsor/topic templates; replace `attachJotformFormsFromConfig` / clone paths when cut over
2. **Post-event:** Template library keyed by sponsor; default seeds Section B+C from oncology example PDF
3. **Intake:** Default template = confirmed field list above; show only **missing** profile fields + honorarium block for logged-in users
4. **Honorarium gate:** Use native `SurveyResponse` + acknowledge, not `jotformSurveyUrl`
5. **Security:** Never trust hidden `user_id` / form-posted email — `userId` from auth session only; identity fields omitted from POST body

---

## Decisions (stakeholder answers)

| # | Question | Decision |
|---|----------|----------|
| 1 | Post-event content scope | **Per-program / sponsor template.** Auto-create surveys when a webinar is created or imported. |
| 2 | Intake field inventory | **Confirmed** — first + last name, email (+ helper), phone, org, full address block, social handles, honorarium method + instructions (see table above). |
| 3 | Hide identity when logged in? | **Yes.** Omit name/email from UI; server binds user from session. Reduces spoofing and duplicate data entry. Organization/address still shown when profile incomplete. |
| 4 | Export JotForm conditional rules? | **Keep as PDF.** Post-event conditionals (Q6, Q7, Q21) are sourced from `Post-Event Survey.pdf` only — no JotForm builder/API export. |

### Post-event conditional rules (from PDF — source of truth)

| Question | Show follow-up when parent answer is |
|----------|-------------------------------------|
| Q6 | “No single go-to; case-by-case” → long text “Briefly describe:” |
| Q7 | “Varies substantially by patient factors” → long text “Briefly describe:” |
| Q21 | “Depends on site pathways and prior exposure” → long text “Briefly describe:” |

Implement these in native `Survey.questions` as `followUp` rules matching the PDF wording exactly.

### Authenticated survey security (recommended)

- **Server:** Resolve `userId` from JWT/session on submit; reject body fields that attempt to override identity
- **Client:** Hide name, last name, email on intake and post-event when `useAuth()` has a user; show read-only summary optional
- **W9 / honorarium:** Link to existing profile flows instead of free-form identity in surveys
- **Hidden JotForm fields:** Retire entirely — they were a JotForm embed workaround, not a security control

---

## Native parity — same logic as today’s JotForm structure

Native intake + post-event forms replace **UI and submission transport** only. All **gates, statuses, admin flows, and payout rules** stay as they are in code today. Phase 1+ refactors should swap JotForm-specific checks for survey-record checks without changing learner or admin behavior.

### Program setup (create / import)

| Today (JotForm) | Native (target) |
|-----------------|-----------------|
| Admin create or Zoom webhook → `SurveysService.attachJotformFormsFromConfig` / clone pair | Auto-create **intake** + **FEEDBACK** `Survey` rows per program from sponsor templates |
| `Program.jotformIntakeFormUrl` + `Program.jotformSurveyUrl` | Keep URLs optional during migration; **presence of configured surveys** drives the same flags |
| Imported DRAFT webinars missing forms → admin checklist | Same checklist — “Intake form” / “Post-event survey” until native surveys seeded |

### Intake — registration (before session)

| Step | Current behavior | Native must preserve |
|------|------------------|----------------------|
| When required | WEBINAR with `jotformIntakeFormUrl` (or env default) → registration wizard, not quick enroll | Intake survey required when program has intake survey |
| Submit | JotForm iframe + hidden `user_id` / `program_id`; webhook → `intakeJotformSubmissionId` + `intakeJotformSubmittedAt` | `POST` native answers → create/update `SurveyResponse`; set same registration fields (or equivalent `intakeSurveyResponseId`) |
| Approval | `registrationRequiresApproval` → PENDING until admin approves; else APPROVED + enroll | Unchanged |
| Attendance flag on approve | Honorarium **or** post-event survey **or** FEEDBACK survey → `postEventAttendanceStatus = PENDING_VERIFICATION` | Same trigger when program has honorarium or post-event survey |
| Admin view | `intakeRequired` / `intakeJotformSubmissionId` on registration hub | Same columns — “Recorded” / “Missing” from native response |
| Batch register | Optional `intakeByProgramId` map | Same batch API with per-program intake completion |

### Post-event — after session

| Step | Current behavior | Native must preserve |
|------|------------------|----------------------|
| Time gate | Unlocks after `zoomSessionEndedAt` **or** `startDate + duration` (MEETING: no start-date gate in `assertProgramPostEventWindowOpen`) | Same `isPostEventSurveyUnlocked` / `assertProgramPostEventWindowOpen` rules |
| Who can access | PUBLISHED, enrolled, registration APPROVED, attendance VERIFIED or NOT_REQUIRED | Same `canUserAccessPostEventFeedbackSurvey` checks |
| Attendance pending/denied | Blocks survey + honorarium UI with same copy | Unchanged |
| Fill survey | JotForm iframe embed; webhook → `SurveyResponse` + `postEventJotformSubmissionId` on registration | Native renderer; `SurveyResponse` create; sync submission id field on registration |
| FEEDBACK duplicate | Second JotForm submit ignored (first submission kept) | One response per user per survey (`@@unique([userId, surveyId])`) |
| Acknowledge | User clicks “Complete survey” → `postEventSurveyAcknowledgedAt` (requires submission on file first in UI) | Same two-step: **submit** then **acknowledge**; button enabled when `SurveyResponse` exists |
| Wizard phases | `PostEventParticipantFlow`: intro → survey → payout → done; localStorage + server resume | Same phase machine; swap iframe for native form component |
| Honorarium request | After ack (+ attendance); requires W9 / Bill.com profile | Same `requestPostEventHonorariumPayout` gates |
| Admin pay | `PaymentsService.payNow` blocks if survey URL set and not acknowledged | Block if post-event survey configured and not acknowledged (check survey/response, not URL) |
| Survey bonus | Optional `SURVEY_BONUS` queue on JotForm FEEDBACK webhook | Queue on native FEEDBACK submit if env bonus still enabled |

### Conditional question logic (post-event)

| Source | Rule |
|--------|------|
| **PDF only** | Q6, Q7, Q21 follow-ups as in table above — no JotForm export |
| Native renderer | Show/hide follow-up fields client-side; persist full answer object in `SurveyResponse.answers` |
| Validation | Required parent answer required; follow-up required when visible (match JotForm required behavior) |

### Fields to decouple in Phase 1 (implementation note)

Replace JotForm-specific **detection** with survey-based detection; keep registration column names until a later migration if needed:

| JotForm-specific today | Native equivalent |
|------------------------|-------------------|
| `program.jotformSurveyUrl` | Program has `Survey` with `type = FEEDBACK` |
| `program.jotformIntakeFormUrl` | Program has intake survey (new type or `ProgramFormLink` INTAKE) |
| `postEventJotformSubmissionId` | `SurveyResponse.id` or keep column as generic submission marker |
| `intakeJotformSubmissionId` | Intake `SurveyResponse.id` |
| `acknowledgePostEventSurvey` checks `jotformSurveyUrl` | Check FEEDBACK survey exists for program |

**Do not change:** approval workflow, attendance verification, honorarium amount, enrollment rules, HubSpot side effects, email notifications, or post-event nav lock behavior.
