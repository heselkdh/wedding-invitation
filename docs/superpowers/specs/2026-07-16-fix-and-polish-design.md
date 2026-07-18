# Fix & Polish — Design

Sub-project 1 of 7 in the wedding-invitation improvement plan. Scope: 5 bugs/security issues + 2 UI/UX issues found in a code review of `js/main.js` and the admin panel. No new features — pure fixes.

## 1. Parent names rendered via unsanitized `innerHTML` (`main.js:38-39`)

`groomParents`/`brideParents` are plain-text fields (admin.html labels them "쉼표로 구분", no HTML claim), but are rendered with:

```js
document.getElementById('groom-parents').innerHTML = d.groomParents.replace(/,/g, '<br>');
```

Any other character the field happens to contain is rendered as HTML.

**Fix:** replace with safe DOM construction — split on `,`, `escapeHtml()` each part, join by creating actual `<br>` elements (or `textContent` + manual `<br>` node inserts). No functional change for legitimate input.

## 2. Transport info rendered via unsanitized `innerHTML` (`main.js:66`)

`transport` is *intentionally* rich HTML — admin.html's label says "교통편 안내 (HTML 가능)" and the placeholder shows `<h4>`/`<p>` tags. Firestore rules (`firestore.rules:5-8`) already gate all writes to `config` behind `request.auth != null`, so this isn't reachable by an untrusted third party today.

**Fix (defense in depth, keeps the feature):** write a small allowlist-based sanitizer and run the value through it before assigning to `innerHTML`:
- Keep only `<h4>`, `<p>`, `<br>`, `<strong>`, `<em>`, `<ul>`, `<li>` tags.
- Strip all attributes on every tag — none of the allowed tags need any, so this removes event handlers (`onclick`, etc.) along with everything else.
- Strip anything else (scripts, arbitrary tags) by unwrapping to plain text instead of dropping the content.

## 3. Countdown `setInterval` never cleared (`main.js:209`)

`tick()` returns early once `diff <= 0` but the `setInterval(tick, 1000)` keeps firing forever afterward.

**Fix:** capture the interval id and call `clearInterval` the first time `diff <= 0` is observed.

## 4. Guestbook `onSnapshot` subscription never unsubscribed (`main.js:273`)

`loadGuestbook()`'s `onSnapshot` return value (the unsubscribe function) is discarded. `admin.js`'s `loadPhotos()` already models the right pattern (store the unsubscribe, call it before resubscribing).

**Fix:** store the unsubscribe function from `onSnapshot` and call it on the `pagehide` window event, mirroring the existing admin.js convention.

## 5. Parallax scroll handler unthrottled (`main.js:370`)

The `scroll` listener writes to `style.transform` on every native scroll event, which can fire far more often than the display refresh rate.

**Fix:** wrap the handler in a `requestAnimationFrame` ticking-flag throttle so the style write happens at most once per animation frame.

## 6. Guestbook has no spam protection

Anyone can call the existing "메시지 남기기" flow in a loop and flood Firestore. This is a static site (Firestore + Cloudinary only, no Cloud Functions/App Check), so server-side verification is out of scope — decided with the user to use a lightweight client-side defense appropriate for a wedding-guest-scale audience, not an adversarial one:

- **Cooldown:** on successful submit, write a timestamp to `localStorage`. Block resubmission for 60 seconds with a toast ("잠시 후 다시 시도해주세요"), independent of the existing `gbSubmitting` in-flight guard.
- **Honeypot:** add a visually-hidden input field (off-screen, not `display:none` so basic bots that skip hidden-by-CSS checks still fill it) to the guestbook form. If it has any value on submit, silently drop the submission (act as if it succeeded — don't tip off the bot).

This deters casual/scripted spam; it does not stop a targeted human attacker, which is consistent with the site's actual threat model (small, invite-only audience).

## 7. Admin photo grid breaks on mobile

`css/admin.css` has zero `@media` queries. `.photo-grid` is a fixed `repeat(3, 1fr)` and `.form-row` is a fixed `1fr 1fr` — on narrow phone screens the 3-across photo thumbs (with their absolutely-positioned drag-handle/delete-button overlays) and the 2-across form fields both get too cramped to use comfortably.

**Fix:** add a `@media (max-width: 480px)` block that drops `.photo-grid` to `repeat(2, 1fr)` and `.form-row` to a single column (`grid-template-columns: 1fr`).

## 8. Insufficient loading feedback during upload/save

`.saving` (opacity 0.6 + `pointer-events: none`) is already applied to the two text-field save buttons (`save-info-btn`, `save-accounts-btn`) with a "저장 중..." label swap. The image upload flows (hero background, map image, OG thumbnail, gallery photos) only update a text node (`progress.textContent`) — the file input and surrounding drop area stay fully interactive, so a user can pick another file mid-upload.

**Fix:** while an upload is in flight, apply the same `.saving`-style treatment (reuse the existing class) to the relevant upload area container so it visually dims and stops accepting clicks until the upload settles (success or error).

## Out of scope

New features (RSVP, QR code, opening animation, payment links, timeline, weather widget) are separate sub-projects, specced individually.
