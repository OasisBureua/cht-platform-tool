# Jotform Integration Setup

## Create Survey from Template (Automated)

When creating a new webinar/program, use the admin endpoint to clone the Jotform template and create a Survey automatically:

```
POST /api/admin/surveys/from-jotform-template
Authorization: Bearer <admin JWT>

{
  "programId": "<program-id>",
  "templateFormId": "260624911991966",
  "title": "Optional custom title",
  "type": "FEEDBACK"
}
```

This will:
1. Clone the template form in Jotform (new form ID)
2. Add webhook URL to the new form
3. Create a Survey record with `jotformFormId` set

The template (260624911991966) stays unchanged for future clones.

---

## Andrew's Answers (Summary)

1. **Webhooks:** Add `https://testapp.communityhealth.media/api/webhooks/jotform` in Jotform settings to create `SurveyResponse` records.
2. **API base:** Use **Standard** (`https://api.jotform.com`). Enterprise subdomain is `https://communityhealthmedia.jotform.com` — **not** HIPAA compliant.
3. **Test form:** Andrew created a test form for embed, webhook, and API verification.
4. **API seat:** Invite sent for separate API integration seat.
5. **Transaction emails:** No dedicated sending domain yet. Consider subdomain (e.g. `noreply@testapp.communityhealth.media`) or AWS SES short-term.

---

## Webhook Configuration

### URL to add in Jotform

```
https://testapp.communityhealth.media/api/webhooks/jotform
```

### How it works

- Jotform sends `POST` with `multipart/form-data` containing a `rawRequest` field (JSON string).
- The backend parses `rawRequest`, finds the Survey by `jotformFormId`, and creates a `SurveyResponse`.
- **Required:** Each Survey must have `jotformFormId` set to the Jotform form ID.
- **Required:** When embedding the form, add a hidden field `user_id` (or `cht_user_id`) with the logged-in user's ID so the webhook can associate the response.

### Environment variables

- `JOTFORM_API_KEY` — API key for Jotform (from Andrew).
- `JOTFORM_BASE_URL` — Optional; defaults to `https://communityhealthmedia.jotform.com/API` for enterprise (note uppercase `/API`).

---

## Survey–Form Mapping

Each `Survey` record must have `jotformFormId` set to the Jotform form ID. This links incoming webhook submissions to the correct survey.

---

## Embed with user_id

When embedding the Jotform form in the frontend, pass the logged-in user's ID as a hidden field so the webhook can create the `SurveyResponse`:

- Field name: `user_id` or `cht_user_id`
- Value: The user's UUID from Supabase/auth

---

## Auto-create Survey when creating Webinar (Admin)

When creating a webinar via **Admin → Webinar Scheduler**, check **"Create post-event survey from Jotform template"**. This will:

1. **Clone** the template form (ID `260624911991966`) via Jotform API
2. **Add webhook** to the cloned form
3. **Create** a Survey record linked to the new program with `jotformFormId` set

Each webinar gets its own unique Jotform form (same structure as the template). Andrew's template should have the webhook URL and hidden `user_id` field configured; clones inherit the structure (webhook is added by our API).
