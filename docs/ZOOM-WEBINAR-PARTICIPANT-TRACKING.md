# Zoom Webinar Participant Tracking

Track when participants join and leave webinars using Zoom webhooks. Events are stored in `WebinarParticipantEvent`.

## Overview

- **Events:** `meeting.participant_joined`, `meeting.participant_left`
- **Webhook URL:** `POST /api/webhooks/zoom`
- **Storage:** `WebinarParticipantEvent` linked to `Program` (via `zoomMeetingId`) and optionally `User` (by email)

## Setup Steps

### 1. Zoom App Configuration

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us) → Your app → **Event Subscriptions**
2. Click **Add Endpoint**
3. **Endpoint URL:** `https://your-domain.com/api/webhooks/zoom` (must be HTTPS, publicly reachable)
4. **Event types:** Subscribe to:
   - `meeting.participant_joined`
   - `meeting.participant_left`
5. Copy the **Secret Token** and add to `.env`:
   ```
   ZOOM_WEBHOOK_SECRET=your_secret_token
   ```

### 2. URL Validation

When you add the endpoint, Zoom sends an `endpoint.url_validation` request. The webhook responds with `plainToken` and `encryptedToken` (HMAC-SHA256 of plainToken with your secret). No extra setup needed.

### 3. Linking to Programs

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
