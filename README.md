# bloomreach-embedded-app

Gupshup WhatsApp Message Composer — the iframe content embedded into Bloomreach Engagement as a **Widget Webhook** for the Bloomreach × Gupshup WhatsApp integration (Phase 1).

This is the "your application URL" a third party supplies to Bloomreach; it is loaded inside Bloomreach's own campaign-node modal (no title bar / Save-Cancel-Test buttons here — those belong to Bloomreach's chrome around this iframe).

## What it does

- Lets a marketer pick a WhatsApp template, configure its variables/media/CTA buttons, and set consent — all against real WhatsApp template shapes (URL/phone/quick-reply buttons, header media).
- Implements Bloomreach's real **Widget Webhook postMessage protocol** end-to-end (`widget_hello` → `app_hello` → `widget_initialized` → `app_request_state` → `widget_state`), per [Bloomreach's docs](https://documentation.bloomreach.com/engagement/docs/configure-and-implement-widget-webhooks).
- Produces Bloomreach's actual `webhook` object shape (`url`, `method`, `auth`, `headers`, `body` as a Jinja2 template, `consent_category`, `general_consent`) — not a made-up payload shape.
- Template variables and dynamic CTA URL params are free-text Jinja2 expressions, meant to be copied from Bloomreach's own **Personalization** panel (there's no API to enumerate a project's real customer/event properties, so this widget doesn't try to fake one).

## Files

Plain HTML/CSS/JS, no build step:

- `index.html` — structure (login gate, loading skeleton, composer UI)
- `styles.css` — Gupshup brand palette (`#5e34f1` primary, pulled from gupshup.io's production CSS)
- `app.js` — template data, form logic, validation, and the Bloomreach postMessage handshake
- `gupshup-logo.png` — cropped from the real Gupshup icon mark

## Running locally

Any static file server works, e.g.:

```
python3 -m http.server 2000
```

Then open `http://localhost:2000/`. Outside an iframe it runs in a "standalone preview" mode (no postMessage handshake attempted).

## Deploying

Currently also mirrored to GitHub Pages for use as the actual Widget URL in Bloomreach (GitLab Pages / another static host would work identically — it's just static files). Whichever URL is live gets set as the **Widget URL** in Bloomreach's "Gupshup Webhook preset" (Data & Assets → Integrations, Preset type = Widget Webhook).

**Note:** `?v=N` query params on `styles.css`/`app.js` in `index.html` are manual cache-busting — bump them whenever those files change, since most static hosts don't allow custom cache headers.

## Related

- `backend/` (sibling directory, not in this repo) — a small Spring Boot service: a mock WhatsApp send receiver (`POST /webhooks/whatsapp/send`, what `GUPSHUP_SEND_URL` in `app.js` points at) plus Bloomreach Track/Data API clients for Phase 2 (pushing `gupshup_journey_result` events back, reading customer context).
