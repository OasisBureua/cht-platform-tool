# Zoom Webinar Participant Tracking & Auto-Import

Track when participants join/leave webinars, and automatically create Programs when webinars are created directly in Zoom (outside the app).

## Overview

- **Events handled:** `webinar.created`, `meeting.created`, `meeting.ended`, `webinar.ended`, `meeting.participant_joined`, `meeting.participant_left`
- **Webhook URL:** `POST /api/webhooks/zoom`
- **Auto-import:** When a webinar or meeting is created in Zoom, the platform auto-creates a DRAFT `Program` with the available data (title, agenda, start time, duration, Zoom IDs/URLs). Fields requiring human input — sponsor, honorarium, host bio, Jotform forms — are left blank and flagged for admin review via the notification bell.
- **Storage:** `WebinarParticipantEvent` linked to `Program` (via `zoomMeetingId`) and optionally `User` (by email)

## Setup Steps

### 1. Zoom App Configuration

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us) → Your app → **Event Subscriptions**
2. Click **Add Endpoint**
3. **Endpoint URL:** `https://your-domain.com/api/webhooks/zoom` (must be HTTPS, publicly reachable)
4. **Event types:** Subscribe to:
   - `webinar.created` ← **new** (auto-import programs)
   - `meeting.created` ← **new** (auto-import meetings, optional)
   - `webinar.ended`
   - `meeting.ended`
   - `meeting.participant_joined`
   - `meeting.participant_left`
5. Copy the **Secret Token** and add to `.env`:
   ```
   ZOOM_WEBHOOK_SECRET=your_secret_token
   ```

### 2. URL Validation

When you add the endpoint, Zoom sends an `endpoint.url_validation` request. The webhook responds with `plainToken` and `encryptedToken` (HMAC-SHA256 of plainToken with your secret). No extra setup needed.

### 3. Auto-Import Flow (webinar.created / meeting.created)

When Zoom fires `webinar.created` or `meeting.created`, the webhook handler:
1. Checks whether a `Program` already exists for that `zoomMeetingId` (idempotent)
2. Creates a new DRAFT `Program` with `importedViaWebhook: true` and the following Zoom fields populated: title (topic), description (agenda), start date, duration, Zoom meeting ID, join URL, and start URL
3. Leaves sponsor name as `"TBD"`, honorarium, host bio, and Jotform forms blank

Admins see a **"Zoom imports need review"** section in the notification bell for all DRAFT webhook-imported programs. Each item links directly to Program Hub and lists the missing fields.

### 4. Linking to Programs

When you create a webinar via the Admin Webinar Scheduler, the backend stores `zoomMeetingId` on the `Program`. Zoom webhooks include the meeting ID in the payload - we look up the Program by `zoomMeetingId` and store the event.

### 4. Participant Email Matching

If Zoom includes participant email in the payload, we match to `User` by email and set `userId` on the event. Otherwise `userId` stays null.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ZOOM_WEBHOOK_SECRET` | Yes (for signature verification) | Secret token from Zoom Event Subscriptions |
| `ZOOM_ACCOUNT_ID` | Yes (for creating webinars) | From Zoom Server-to-Server OAuth app |
| `ZOOM_CLIENT_ID` | Yes | From Zoom app |
| `ZOOM_CLIENT_SECRET` | Yes | From Zoom app |

## Troubleshooting: URL Validation Failed

1. **Response format:** Zoom requires `{ message: { plainToken, encryptedToken } }`. The backend returns this format.

2. **ZOOM_WEBHOOK_SECRET:** Must be set in your backend `.env`. Copy the **Secret Token** from Zoom App Marketplace → Event Subscriptions → your endpoint. Without it, validation fails.

3. **URL must hit your backend:** The webhook URL must reach your NestJS backend (where `/api/webhooks/zoom` is served). If `testapp.communityhealth.media` serves only the frontend, use your actual API URL (e.g. `https://api.testapp.communityhealth.media/api/webhooks/zoom` or wherever your backend is deployed).

4. **HTTPS required:** Zoom only sends to HTTPS URLs with a valid certificate.

## Local Development

Use ngrok to expose your local server:

```bash
ngrok http 3000
```

Then use the ngrok URL in Zoom: `https://abc123.ngrok.io/api/webhooks/zoom`

## Querying Events

```typescript
// List join/leave events for a webinar
const events = await prisma.webinarParticipantEvent.findMany({
  where: { programId: 'program-xyz' },
  orderBy: { occurredAt: 'asc' },
});

// Count unique participants who joined
const joined = await prisma.webinarParticipantEvent.findMany({
  where: { programId: 'program-xyz', event: 'JOINED' },
  distinct: ['participantEmail', 'zoomParticipantId'],
});
```
