# CHT Platform SDK — Zoom Marketplace technical questionnaire

**Company:** Community Health Media  
**App:** CHT Platform SDK  
**Privacy Policy URL:** https://testapp.communityhealth.media/privacy  
**(Also)** https://devapp.communityhealth.media/privacy · public site path `/privacy`

---

## Privacy statement (for Zoom form)

Users authorize and use this app under Community Health Media’s Privacy Policy:

**https://testapp.communityhealth.media/privacy**

### How this app handles Zoom-related data

| Data | Purpose | Storage |
|------|---------|---------|
| Authenticated user’s name and email | Meeting SDK join display identity (attendee) | Already on CHT user profile (Aurora); passed to Zoom SDK join only for the session |
| Program / Zoom meeting or webinar ID, passcode, optional registrant token (`tk`) | Allow in-browser join for approved learners | Program records in Aurora; JWT issued ephemerally by NestJS API |
| Meeting SDK join/leave events | Attendance supplement to Zoom webhooks | `WebinarParticipantEvent` in Aurora |
| Zoom webhook payloads (participant join/leave, session ended) | Attendance and program lifecycle | Processed by API; relevant fields persisted; secrets in AWS Secrets Manager |

**We do not** use this Meeting SDK app to request Zoom user OAuth authorization for end learners. Join credentials are minted by CHT’s backend after CHT enrollment/approval checks. Camera/microphone media for the live session is handled by Zoom’s client; CHT does not record Zoom AV streams in this flow.

Sensitive credentials (`ZOOM_SDK_KEY`, `ZOOM_SDK_SECRET`, Server-to-Server OAuth secrets, webhook secret) are stored in **AWS Secrets Manager**, not in the browser.

---

## Technology stack (paste into form)

```text
Client
- React 19 SPA (Vite/TypeScript) hosted on Amazon S3 + CloudFront
- Zoom Meeting SDK Embedded Web Client 4.1.0 loaded from Zoom CDN inside a same-origin blob iframe (isolated React 18 runtime for Zoom)

API / application
- NestJS (Node.js/TypeScript) on Amazon ECS Fargate behind an Application Load Balancer
- Endpoints: POST /api/webinars/:id/meeting-sdk-auth, POST /api/office-hours/:id/meeting-sdk-auth, POST .../sdk-attendance, POST /api/webhooks/zoom
- Meeting SDK JWT signed server-side (jsonwebtoken) with ZOOM_SDK_KEY / ZOOM_SDK_SECRET
- Separate Zoom Server-to-Server OAuth client for webinar/meeting REST administration (not end-user OAuth)

Data & identity
- Amazon Aurora PostgreSQL (Global Database) for users, programs, enrollments, attendance events
- Amazon Cognito for authentication (email/password, Google IdP, optional TOTP MFA)
- AWS Secrets Manager for Zoom and other integration secrets
- Amazon SES for transactional email; SQS for async workers (payments/email)

Infrastructure & delivery
- Terraform-managed AWS (us-east-1 primary; us-east-2 DR standby)
- GitHub Actions CI/CD (tests, image build, Terraform plan/apply, frontend deploy)
- Monthly dependency/filesystem scans (npm audit, Trivy) via GitHub Actions

Other platform integrations (not required for Meeting SDK join, but part of CHT)
- JotForm (surveys), Bill.com (honoraria), HubSpot (CRM), MediaHub/Content Hub catalog APIs
```

---

## Application development answers (honest, based on current repo practices)

| Question | Answer | Upload this file |
|----------|--------|------------------|
| Secure software development process (SSDLC)? | **Yes** | `evidence-ssdlc.pdf` |
| SAST and/or DAST? | **Yes** (SAST / SCA via npm audit + Trivy) | `evidence-sast-dependency-scanning.pdf` |
| Periodic 3rd-party application penetration testing? | **No** | *(no upload — do not invent a pen-test report)* |

### Additional documents (Recommended)

| Category | Upload |
|----------|--------|
| Privacy policy | `evidence-privacy-policy-summary.pdf` + URL `https://testapp.communityhealth.media/privacy` |
| Incident management and response policy | `evidence-incident-response.pdf` |
| Infrastructure / DR | `evidence-disaster-recovery.pdf` |
| Architecture diagram | `cht-zoom-sdk-architecture.png` |
| SOC2 / ISO27001 / Pen test | **Do not upload** (not certified / no report) |

---

## Architecture diagram

Upload: `cht-zoom-sdk-architecture.png` (same folder)  
Shows learner → CloudFront/SPA → NestJS API → Secrets/Aurora/Cognito, and Zoom Meeting SDK CDN + realtime session + S2S API + webhooks.
