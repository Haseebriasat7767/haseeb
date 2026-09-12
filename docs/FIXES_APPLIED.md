# Fixes Applied — Inspection Follow-up

Date: 2026-09-12
Branch: arena/01a091e2-haseeb
Base: 89044c9

## Summary

All issues and risks identified in the initial inspection have been fixed or documented as accepted with mitigation.

### P0 — Critical (would block launch or lose enquiries)

| Issue                                                                         | Fix                                                                                                                                                |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| No mail credentials → silent loss (form showed success but delivered nothing) | Already fixed in base, but hardened: 503 + mailto fallback, never false 200, rate limit after unconfigured check, origin check, payload size limit |
| Broken wa.me link from invalid phone format                                   | Fixed: E.164 validation (7-15 digits), separate `NEXT_PUBLIC_ENQUIRY_WHATSAPP` env, digits normalization, invalid = null (hide channel)            |

### P1 — High (security, validation, resilience)

| Issue                                                             | Fix                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No security headers                                               | Added in `next.config.ts`: X-Frame-Options SAMEORIGIN, X-Content-Type nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (no camera/mic/geo), X-XSS-Protection, HSTS, Cache-Control immutable for /assets |
| Rate limiting bypass via cold starts, IPv6, x-forwarded-for chain | Fixed: `getClientIP()` handles x-forwarded-for first entry, x-real-ip, cf-connecting-ip, strips ports, IPv6 brackets, periodic cleanup, MAX_KEYS 500, key now `IP:email` for enquiry                                                |
| Enquiry payload abuse                                             | Fixed: MAX_BODY_SIZE 10KB, field slicing (name 200, email 320, phone 60, message 4000), MAX_MESSAGE_LENGTH 2000, MAX_NAME_LENGTH 120, fetch timeout 15s, SMTP timeouts 10s/10s/20s                                                  |
| Origin / CSRF                                                     | Added Origin check vs SITE_URL when both set, allows localhost, 403 on mismatch                                                                                                                                                     |
| Client error log PII / payload                                    | Fixed: clip 4000 chars, IP redacted in log, body size limit, rate limit per IP                                                                                                                                                      |
| Brochure missing JPGs → build crash                               | Fixed: `plate()` returns null on missing file, try/catch per embed, logs warning, continues without image                                                                                                                           |
| Contact validation                                                | Added phone validation in `validateEnquiry`, email lowercased + format check, address env-driven                                                                                                                                    |

### P2 — Medium (UX, a11y, docs)

| Issue                                                               | Fix                                                                                                                                                                           |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SITE.contact.address static "By private appointment" not env-driven | Fixed: `NEXT_PUBLIC_CONTACT_ADDRESS` env, `addressDisplay` fallback, CLIENT.contact.address + addressDisplay, SITE reads from CLIENT                                          |
| CLIENT.agent.whatsapp reused phone, no separate var                 | Fixed: `NEXT_PUBLIC_ENQUIRY_WHATSAPP` separate, fallback to phone, validates digits                                                                                           |
| DirectChannels console.warn in prod                                 | Fixed: only warns in dev (NODE_ENV !== production)                                                                                                                            |
| AgentCard phone display                                             | Fixed: uses phoneDisplay original format for UI, phone normalized for tel: link, aria-labels added                                                                            |
| Footer phone not link                                               | Fixed: now `<a href=tel:>` with display format, added conceptual disclosure                                                                                                   |
| MobileMenu address                                                  | Fixed: uses addressDisplay, email optional                                                                                                                                    |
| EnquiryForm error handling                                          | Improved: timeout via AbortController, failed message includes error text, hint for char count, aria-live, required asterisk, aria-required, hint linked via aria-describedby |
| Field component                                                     | Improved: aria-required, hint prop, error + hint both in aria-describedby, required * visual                                                                                  |
| WebGLFallback                                                       | Improved: role=status aria-live, body copy mentions floor plans/gallery/enquiry still available, adds buttons to floor plan and gallery                                       |
| Privacy page incomplete                                             | Fixed: conditional sections for SMTP_HOST / Web3Forms, operator note as bordered note not bold error, added DNT, retention 12 months, security section, phone/address display |
| Terms page thin                                                     | Expanded: performance note, liability clause, third-party links include WhatsApp/email, areas computed note                                                                   |
| Accessibility page thin                                             | Expanded: manual checks listed, compatibility, future improvements, response time 5 days, feedback includes OS/browser/AT                                                     |
| Performance baseline not measured                                   | Documented in OPERATIONS.md, HUD exists but needs real GPU measurement — listed as open required task                                                                         |
| Tower core DAT-01 placeholder                                       | Documented in OPERATIONS.md and CoreGeometry.ts comment — one flat per plate assumption, needs client floor plans, no code change needed now                                  |
| .env.example incomplete                                             | Updated: documents whatsapp separate, contact address, validation notes, examples, trimmed handling                                                                           |

### Tests & Tooling

- `tests/rate-limit.test.ts`: added 5 tests for getClientIP (x-forwarded-for, x-real-ip, cf-connecting-ip, unknown, port stripping)
- `tests/enquiry-validation.test.ts`: added 3 tests for name too long, message too long, phone validation
- Total: 110 → 118 tests, all passing
- `typecheck` passes, `lint` passes
- `build` fails in sandbox only due to Google Fonts fetch blocked by egress proxy (expected, works on Vercel)

### New Docs

- `docs/OPERATIONS.md`: full launch checklist, risk register, env reference, commands
- `docs/SECURITY.md`: threat model, headers, validation, anti-spam, rate limit limitations, secrets, checklist
- `docs/FIXES_APPLIED.md`: this file

### Files Changed

- next.config.ts — security headers + cache
- lib/constants/client.ts — validation, whatsapp separate, address env, phoneDisplay, hasContactChannel
- lib/constants/site.ts — addressDisplay, phoneDisplay
- lib/server/rate-limit.ts — getClientIP, normalizeIP, cleanup
- lib/contact/enquiry.ts — max lengths, phone validation, timeout, abort controller
- app/api/enquiry/route.ts — getClientIP, IP:email key, origin check, body size, timeouts, trimmed env
- app/api/client-error/route.ts — getClientIP, body size, redacted IP
- app/brochure/route.ts — graceful missing plates
- components/contact/* — validation, aria, display formats
- components/navigation/Footer.tsx, MobileMenu.tsx — addressDisplay, phone link
- components/three/WebGLFallback.tsx — a11y + alt nav
- app/privacy, terms, accessibility — expanded
- .env.example — docs
- tests/* — new cases

### Remaining Open (requires real hardware / client / legal)

- Real GPU/mobile performance measurement (FPS, P95)
- Manual screen reader + keyboard walkthrough + user testing + third-party audit
- Legal review of privacy/terms/accessibility
- DAT-01: client floor plans for tower unit mix
- CSP enforcement (report-only first)
- Shared rate limit (Redis) if high traffic

All open items tracked in OPERATIONS.md with P1/P2 and owner = operator.
