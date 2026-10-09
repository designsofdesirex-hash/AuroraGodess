# Aurora — static creator website

Plain HTML, CSS, and JavaScript. `npm run build` creates seven prerendered route folders in `dist/`; each route loads directly from static hosting. `npm start` builds and serves the local preview at `http://127.0.0.1:3000/`.

## Routes

- `/` Home
- `/booking` browser-only Details → Review → Ready request composer
- `/gallery` curated image gallery with category filters, eight-item progressive reveal, and keyboard-accessible viewer
- `/links` the five official creator/support destinations
- `/policies` booking information
- `/privacy` privacy details, available without entering
- `/exit` ungated exit page

## Checks

Run the supplied booking rules with `npm run test:booking` (`node --test booking/booking-core.test.mjs`). This checks the USD formatter, empty quote pricing, date validation, offers, message formatting, and email URI handling.

## Content and media

- Public copy: `config/copy.json`
- Route metadata, business inputs, exact outbound links: `config/site.json`
- Photo assignments, alt text, categories and crop focal points: `config/assets.json`
- Shared colors, typography, layout and motion: `design/tokens.css`
- Responsive WebP crop generation: `scripts/prepare-assets.py`
- Booking validation and request generation: `booking/booking-core.mjs`

The static preview intentionally has no real booking recipient or final domain. Email handoff is disabled until `config/site.json → booking.contactEmail` is filled with the real address; visitors can copy the prepared request. No service, price, availability, or confirmation is invented. USD is fixed.

The final domain belongs in `config/site.json → siteUrl`. Production build validation also requires real booking contact information and required approved image assignments. Confirm the Cash App and YouPay recipient identities before public launch.
