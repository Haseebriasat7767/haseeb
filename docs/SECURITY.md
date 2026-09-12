# Security Notes — AURELIA

## Threat Model

Luxury real-estate site, low traffic, high value per lead. Main risks:

- Enquiry interception / loss
- Spam / abuse of contact form
- XSS via user input reflected in emails
- Information disclosure via error logs

## What Is Implemented

### Transport

- HSTS: `max-age=63072000; includeSubDomains; preload` (Vercel HTTPS)
- SMTP: `secure` on 465, `requireTLS` on 587 — never plaintext, fails rather than downgrade
- Fetch timeouts: Web3Forms 15s, SMTP connection 10s, socket 20s
- No mixed content — all assets from same origin

### Headers (next.config.ts)

- `X-Frame-Options: SAMEORIGIN` — no clickjacking
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `X-XSS-Protection: 1; mode=block` (legacy, defense in depth)
- `X-DNS-Prefetch-Control: on`
- Cache-Control immutable for /assets, no cache for HTML/API

### Input Validation

- Enquiry: name 2-120 chars, email format + 254 max, message 10-2000 chars, phone optional 7-15 digits
- Server slices all fields: name 200, email 320, phone 60, date 60, message 4000
- Body size limit 10KB for /api/enquiry and /api/client-error
- Email normalization: trim + lowercased, validated
- Phone: E.164 digits 7-15, `wa.me` digits only, `tel:` keeps + prefix, invalid = null (hide channel)

### XSS Prevention

- `escape()` for HTML email bodies: &, <, >, " escaped
- No `dangerouslySetInnerHTML` in app (except legal pages which are static)
- No user input reflected in DOM without escaping — React escapes by default
- Brochure PDF uses pdf-lib, no HTML injection

### Anti-Spam

- Honeypot: hidden field `company`, off-screen not display:none, tabIndex -1, bots fill it → silent 200 (no retry signal)
- Timing: `elapsed` < 3000ms → silent 200 (bot instant post)
- Rate limit: 4 per email per 10min, keyed by `IP:email` (IP via getClientIP handles x-forwarded-for chain)
- Client error: 20 per IP per 5min
- In-memory buckets with periodic cleanup, MAX_KEYS 500, IPv6 normalization

### Rate Limit Limitations

- In-memory per instance — serverless cold starts get separate buckets, flood spread across instances gets more through
- This is speed bump for stuck loops / button mashing, not DDoS protection
- For high traffic: move to Redis / Upstash with shared storage
- `getClientIP()` handles Vercel (x-forwarded-for first entry), x-real-ip, cf-connecting-ip, strips ports

### Origin Check

- `/api/enquiry` checks `Origin` header vs `NEXT_PUBLIC_SITE_URL` when both set
- Allows localhost for dev
- Blocks mismatched origin with 403 + warning log
- Not a CSRF token, but prevents simple cross-origin POST

### Error Handling

- Client errors: message, stack, page, digest, kind, userAgent logged, IP redacted, fields clipped to 4000 chars
- No PII in logs except what error contains — message trimmed, stack clipped
- Enquiry failures: logged server-side, never expose SMTP details to client (502 generic)
- Unconfigured: 503 with status `unconfigured`, not 200

### Secrets

- No secrets in client bundle — `process.env` checks are server-only for SMTP/WEB3FORMS
- `NEXT_PUBLIC_` vars are public by design (form action URL, contact details)
- `.env.example` documents all, never commit real values
- `CLIENT` validation treats invalid formats as null rather than broken link

### What Is NOT Implemented (and why)

- **CSP:** Would need `unsafe-inline` for Tailwind styles, risk of breaking. Headers added instead. Consider CSP report-only first.
- **CSRF token:** JSON API, same-origin check via Origin header, no cookies to steal. Token would add complexity for little gain.
- **Captcha:** Honeypot + timing + rate limit sufficient for low traffic. Captcha hurts conversion at luxury price point. Add if spam becomes issue.
- **Shared rate limit:** Needs Redis dependency, not justified yet. Documented as limitation.

### Checklist for Production

- [ ] Set strong SMTP app password, not account password
- [ ] Verify HSTS header in production `curl -I`
- [ ] Test Origin check blocks cross-origin POST
- [ ] Test payload size limit returns 413
- [ ] Verify no secrets in client bundle: `npm run build && grep -r SMTP .next/static` should be empty
- [ ] Review Vercel logs for `[enquiry]` and `[client-error]` — ensure no PII leakage
- [ ] Enable Vercel Web Application Firewall if available
