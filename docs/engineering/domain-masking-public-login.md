# Domain masking for public login (communityhealth.media → app)

**Date:** August 27, 2026  
**Owner:** Engineering / Platform  
**Status:** Recommendation for decision  
**Related hosts:** `communityhealth.media` (marketing), `testapp.communityhealth.media` (application), `devapp.communityhealth.media` (dev)

## 1. Problem

We want a **Login** CTA on the public site (`communityhealth.media`) that takes users into the CHT Platform app currently served at `testapp.communityhealth.media`.

If the button simply redirects to `https://testapp.communityhealth.media/...`, the browser address bar shows **testapp**, which:

- Looks like an internal / staging environment to end users
- Undermines brand polish for HCPs and partners
- Confuses people who expect a production-looking URL

## 2. Constraint (important)

**A redirect cannot hide the destination hostname.**

| Approach | What user sees after click |
| --- | --- |
| Link/redirect to `testapp.communityhealth.media` | `testapp.communityhealth.media` |
| Serve the app under a friendly hostname that points at the same infrastructure | Friendly name (e.g. `app.communityhealth.media`) |

To “mask” `testapp`, users must land on a **different hostname** that we control, while traffic still hits the same app stack.

## 3. Recommendation

**Add a public-facing alias hostname** and point Login there.

**Proposed public URL:** `https://app.communityhealth.media`  
*(Alternatives: `portal.communityhealth.media`, `login.communityhealth.media`)*

**Keep** `testapp.communityhealth.media` as an internal/ops alias if useful.

**Login button on communityhealth.media:**

```text
https://app.communityhealth.media/login
```

(or the exact auth path we use today on testapp)

## 4. How it works

```text
User clicks Login on communityhealth.media
        │
        ▼
https://app.communityhealth.media/...
        │  (DNS + TLS + CloudFront/ALB alternate domain)
        ▼
Same origin / stack as testapp.communityhealth.media
(SPA + API; no change to product behavior)
```

Users never see `testapp` in the address bar. Ops can still use `testapp` directly.

## 5. Implementation outline

1. **Choose hostname** — recommend `app.communityhealth.media`
2. **TLS** — ACM certificate covering the new name (or existing `*.communityhealth.media`)
3. **CDN / load balancer** — add the hostname as an alternate domain on the existing testapp CloudFront (or ALB HTTPS listener)
4. **DNS** — CNAME `app` → same target as `testapp`
5. **App allowlists** — add the new origin to:
   - Backend CORS
   - Cookie / auth redirect allowlists
   - Any hard-coded frontend env URLs used for links/emails if needed
6. **Marketing site** — Login CTA → `https://app.communityhealth.media/...`
7. **Smoke test** — login, session cookie, API calls, Stripe/webhooks only if they embed absolute app URLs

## 6. Options considered

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **A. Friendly alias (`app.`)** | Clean brand URL; low risk; keeps `testapp` for ops | Small DNS/TLS/CORS work | **Recommended** |
| **B. Rename env; drop `testapp` publicly** | One canonical name | Breaks bookmarks/docs that use `testapp` | Optional later |
| **C. Path proxy on apex (`communityhealth.media/app`)** | Single domain | Cookie/path/SPA complexity; higher ops cost | Not recommended |
| **D. Redirect only to `testapp`** | Zero infra | Users see `testapp` | Does not meet goal |
| **E. iframe “mask”** | Looks embedded | Auth/cookie/security issues | Reject |

## 7. Risks & notes

- **Cookies / auth:** Sessions must be valid for the hostname users actually use (`app.`). Confirm SameSite / domain settings if cookies are host-scoped.
- **CORS:** Backend already allows `testapp` and `communityhealth.media`; `app.` must be added explicitly.
- **Emails / deep links:** Prefer the public hostname (`app.`) in user-facing links going forward.
- **Environments:** Keep `devapp.` as engineering-only; do not put Login on the marketing site to `devapp`.
- **“Masking” vs security:** This is brand/DNS aliasing, not hiding that an app exists. Access control remains auth + network policy as today.

## 8. Effort (rough)

| Work | Estimate |
| --- | --- |
| DNS + ACM + CloudFront/ALB alt domain | Small (hours) |
| CORS / auth allowlist updates + deploy | Small |
| Marketing Login CTA update | Small |
| QA (login, logout, deep links) | Small |

Total: roughly **0.5–1 day** if wildcard cert and CloudFront patterns already exist.

## 9. Decision needed

1. Confirm public hostname: **`app.communityhealth.media`** (or alternate)
2. Confirm Login target path (e.g. `/login` vs `/app/login`)
3. Approve keeping `testapp.` as a secondary alias vs eventual redirect to `app.`

## 10. Next steps (after approval)

1. Engineering: wire DNS / TLS / alternate domain + CORS
2. Update marketing Login button
3. Smoke-test login end-to-end
4. Document canonical public URL in runbooks / Confluence

---

**Ask:** Approve hostname `app.communityhealth.media` and proceed with DNS + allowlist changes?
