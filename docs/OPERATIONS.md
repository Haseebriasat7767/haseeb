# AURELIA — Operations Checklist

This file tracks known issues, risks, and required actions before publishing for a real property. It is the operator's single checklist — not scattered comments.

## Before Launch (Required)

### 1. Contact & Legal Identity (P0 — blocks launch)
- [ ] Set `NEXT_PUBLIC_ENQUIRY_EMAIL` — validated email, e.g. `enquiries@yourdomain.com`
- [ ] Set `NEXT_PUBLIC_ENQUIRY_PHONE` — E.164, e.g. `+971501234567` (7-15 digits)
- [ ] Set `NEXT_PUBLIC_ENQUIRY_WHATSAPP` — optional, separate from phone if needed, same format
- [ ] Set `NEXT_PUBLIC_CONTACT_ADDRESS` — physical address or "By private appointment"
- [ ] Set `NEXT_PUBLIC_AGENT_NAME` — real person who reads enquiries, not fictional
- [ ] Set `NEXT_PUBLIC_AGENT_TITLE` and `AGENCY` if applicable
- [ ] Set `NEXT_PUBLIC_SITE_URL` — canonical https URL, e.g. `https://www.yourdomain.com`
- [ ] Update `app/privacy/page.tsx` — name mailbox processor and country (SMTP_HOST or Web3Forms)
- [ ] Update `app/terms/page.tsx` — governing law, operator legal name
- [ ] Update `app/accessibility/page.tsx` — monitored contact route and response time (5 days target)
- [ ] Legal review: privacy, terms, accessibility by lawyer in operator jurisdiction

### 2. Enquiry Delivery (P0 — blocks launch)
- [ ] Choose one:
  - **Web3Forms (fastest):** Set `WEB3FORMS_ACCESS_KEY` (server var, 250/month free)
  - **SMTP (private):** Set `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS or 465), `SMTP_USER`, `SMTP_PASSWORD` (app password), `ENQUIRY_TO`, `ENQUIRY_FROM`
- [ ] Test delivery: submit form, check inbox + acknowledgement to sender
- [ ] Test fallback: unset credentials, verify form shows mailto fallback, not false success
- [ ] Test rate limiting: submit 5 quickly, 5th should be 429 "Already received"
- [ ] Test honeypot + timing: bot-like instant submit should be silently accepted (200 but not delivered)

### 3. Security Headers & Rate Limiting (P1)
- [x] Security headers added in `next.config.ts`: X-Frame-Options SAMEORIGIN, X-Content-Type nosniff, Referrer-Policy, Permissions-Policy, HSTS
- [x] Rate limiting: IP extraction via `getClientIP()` handles x-forwarded-for, x-real-ip, cf-connecting-ip, IPv6 normalization
- [x] Payload size limits: 10KB max for /api/enquiry and /api/client-error
- [x] Origin check: /api/enquiry checks Origin vs SITE_URL when both set
- [x] SMTP timeouts: connection 10s, greeting 10s, socket 20s
- [x] Web3Forms timeout: 15s abort controller
- [ ] Verify headers in production: `curl -I https://yourdomain.com` shows security headers
- [ ] Consider adding CSP report-only first, then enforce (careful with Tailwind inline styles)

### 4. Contact Validation (Fixed)
- [x] Phone: E.164 validation 7-15 digits, normalized digits for wa.me, tel: link keeps + prefix
- [x] Email: format validation, lowercased, treated as null if invalid
- [x] WhatsApp: separate env var `NEXT_PUBLIC_ENQUIRY_WHATSAPP`, fallback to phone, validates digits
- [x] Address: env-driven `NEXT_PUBLIC_CONTACT_ADDRESS`, fallback "By private appointment"
- [x] `hasContactChannel()` helper, DirectChannels only warns in dev, not prod logs

### 5. Brochure Resilience (Fixed)
- [x] `app/brochure/route.ts` now handles missing JPGs gracefully: try/catch per plate, logs warning, continues without image
- [x] Plates exist in `public/assets/brochure/`: arrival, living, pool, master (verified)
- [ ] Regenerate if geometry changes: `npm run build && node scripts/brochure-stills.mjs` (requires GPU, ~30s per frame)
- [ ] Verify PDF download: `/brochure` returns PDF with correct Content-Disposition

### 6. Tower Core DAT-01 (Known Limitation)
**Status:** Placeholder by design, documented.

The tower's residential core (lift lobby repeated on 15 levels) has one flat per plate with front door off lift lobby. This is assumption, not client requirement.

- `DAT-01` = How many flats per floor and where front doors go — needs client floor plans
- Current: one apartment per plate, door at `APT_DOOR_Z`, open against wall inside flat (walkthrough stops at closed door = corridor)
- `CoreGeometry.ts` documents this: "One flat per plate with its door off the lift lobby is an assumption, and a normal one."
- **Action before real project:** Replace with actual unit mix from client. Update `TowerGeometry.ts` TOWER_CONFIG, `CoreGeometry.ts` lobby, `ApartmentGeometry.ts` plates.
- No code change needed now — but document in client brief.

### 7. Performance Baseline (Not Yet Measured on Real GPU)
- [x] Performance HUD exists: `?debug=performance` in dev only, gated by NODE_ENV, samples via useFrame refs, 4Hz publish
- [x] Budgets in `performance-types.ts`: <100 draws excellent, <50k tris
- [x] Current (SwiftShader, not real GPU): 95 draws, 17k tris high tier
- [ ] **Required:** Measure on real desktop GPU and mobile device, update README "Current baseline" with FPS/P95
- [ ] Test on low-end Android (Chrome) — quality tier should auto LOW/MEDIUM
- [ ] Verify WebGLFallback shows alternative nav (floor plan, gallery) when WebGL unavailable

### 8. Accessibility (Partially Tested)
- [x] Automated: axe-core zero violations on 9 pages (home, tower, experience, residence, floor-plan, gallery, contact, privacy, terms)
- [x] Manual checks: contrast measured (stone #82828a 5.17:1), focus-visible gold, reduced-motion disables parallax/drift/reveals, tap targets min-h-11, labels + aria-invalid + aria-describedby on form
- [x] WebGLFallback has role=status, aria-live, alternative buttons
- [ ] **Required before launch:** Manual screen reader (NVDA/JAWS/VoiceOver), keyboard-only walkthrough, speech input, user testing with disabilities, third-party audit
- [ ] Document response time for accessibility feedback (5 working days target in updated page)

### 9. Analytics & Privacy
- [x] Vercel Analytics cookieless, Speed Insights, no localStorage/cookies, fonts via next/font
- [x] Privacy page updated: DNT respected, retention 12 months, security section, operator notes only show when env missing
- [ ] Verify no cookies set: DevTools Application tab empty after browsing
- [ ] If EU traffic, consult lawyer about ePrivacy + analytics — current claim is no consent needed because nothing stored on device, but get legal sign-off

### 10. Build & Deploy
- [x] `next.config.ts` has transpilePackages three, images avif/webp, poweredByHeader false, security headers, cache for /assets
- [x] `npm run typecheck` passes, `npm run test` 110 tests pass
- [ ] `npm run build` — verify route sizes: / 3.98kB, /experience 4.8kB (three not in page bundle)
- [ ] `npm run test:a11y` — axe-core against production build
- [ ] Check sitemap includes tower (fixed — was missing for 2 phases, now from NAV_ITEMS)
- [ ] Verify OG image: `/opengraph-image` returns image, social debuggers show card
- [ ] Verify manifest, robots, icons

## Risk Register

| Risk | Severity | Status | Mitigation |
|------|----------|--------|------------|
| No mail credentials → silent loss | P0 | Fixed | 503 + mailto fallback, never false 200 |
| Broken wa.me link from bad phone format | P1 | Fixed | E.164 validation, separate whatsapp var, digits normalization |
| Rate limit bypass via cold starts | P1 | Accepted | In-memory limit is speed bump, not guarantee. Documented. For high traffic, move to Redis/Upstash. |
| Tower core door placeholder | P2 | Documented | DAT-01, needs client floor plans, one flat per plate assumption |
| Performance only measured on SwiftShader | P1 | Open | Need real GPU/mobile measurement |
| Accessibility not manually tested | P1 | Open | Automated only, need screen reader + user testing |
| No CSP | P2 | Accepted | Basic headers added, CSP would need unsafe-inline for Tailwind, risk of breaking. Consider report-only. |
| Brochure stills stale | P2 | Fixed | Graceful fallback if missing, script documented, regeneration requires GPU |

## Env Vars Reference

See `.env.example` — all optional, app degrades honestly.

Public (NEXT_PUBLIC_):
- SITE_URL, ENQUIRY_EMAIL, ENQUIRY_PHONE, ENQUIRY_WHATSAPP, CONTACT_ADDRESS, AGENT_NAME/TITLE/AGENCY, ENQUIRY_ENDPOINT

Server (never client):
- WEB3FORMS_ACCESS_KEY (preferred fast path) OR SMTP_HOST/PORT/USER/PASSWORD + ENQUIRY_TO/FROM

## Commands

```bash
npm ci
npm run typecheck
npm run test
npm run test:a11y
npm run build
npm run start
# Regenerate brochure stills (needs GPU, ~2min):
npm run build && node scripts/brochure-stills.mjs
```
