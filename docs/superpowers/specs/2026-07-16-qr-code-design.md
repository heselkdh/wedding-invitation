# QR Code Generation — Design

Sub-project 2 of the wedding-invitation improvement plan (RSVP was dropped from the roadmap per user decision). Scope: let the admin generate a print-ready QR code for the invitation site URL, for use on paper invitations.

## What it encodes

The QR code encodes the invitation site URL only — the same fixed constant already used for Kakao sharing (`https://heselkdh.github.io/wedding-invitation/`). No per-couple configuration, no Firestore storage: the URL is a build-time constant, so the QR code is generated fresh in the browser every time the admin clicks the button rather than being persisted anywhere.

## Shared URL constant (small refactor)

The site URL currently lives only inside `initKakaoShare()` in `js/main.js`:

```js
const siteUrl = 'https://heselkdh.github.io/wedding-invitation/';
```

`admin.js` needs the same value for QR generation. Rather than duplicating the literal (and risking the two copies drifting if the site is ever redeployed under a different URL), extract it to a new file:

**Create `js/site-config.js`:**
```js
export const SITE_URL = 'https://heselkdh.github.io/wedding-invitation/';
```

`main.js` imports `SITE_URL` and uses it in place of the local `siteUrl` constant in `initKakaoShare()`. `admin.js` imports the same constant for QR generation.

## Generation method

Client-side generation via the `qrcode` library (soldair/node-qrcode). `qrcode` doesn't ship a prebuilt UMD/global `<script>` bundle on unpkg (checked — 404; its `package.json` only maps a `browser` field to `./lib/browser.js`, an ES module, no bundled global). `admin.js` is already loaded as an ES module (`<script type="module">`, same as its Firebase imports), so the natural fit is importing the library directly by URL rather than adding a classic `<script>` tag:

```js
import QRCode from 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm';
```

jsdelivr's `+esm` endpoint bundles the package's browser entry (and its one dependency, `dijkstrajs`) into a single importable ES module on the fly — confirmed working (`QRCode.toCanvas` present) before writing this into the plan. `QRCode.toCanvas(canvasEl, text, options, callback)` is used the same way it would be off a global.

## Admin UI

Add a "🔗 QR 코드" block inside the existing "✏️ 기본 정보" panel in `admin.html` (near the other link/share-related fields), containing:
- A "QR 코드 생성" button.
- A `<canvas>` preview element, hidden until first generated.
- A "PNG 다운로드" `<a download>` link, hidden until first generated, pointing at the canvas's data URL.

## Generation flow

On button click:
1. Call `QRCode.toCanvas(canvas, SITE_URL, { width: 600, margin: 2 }, callback)` — 600×600px is large enough to print clearly on a paper invitation insert; a margin of 2 modules keeps the required quiet-zone border so scanners can find the code.
2. In the callback, reveal the canvas and set the download link's `href` to `canvas.toDataURL('image/png')` and `download` attribute to a fixed filename (`wedding-qr.png`).
3. On error (callback receives an error), show it via the existing `showToast()` helper.

Regenerating (clicking the button again) just redraws the same canvas — idempotent, no cleanup needed since the content never changes.

## Out of scope

- No admin choice of what the QR encodes (site URL only, per user decision — dropped the "site URL + map link" option).
- No QR display on the guest-facing site itself — this is an admin/print tool only.
- No storage of the generated image anywhere (Firestore/Cloudinary) — it's regenerated on demand from the constant.
