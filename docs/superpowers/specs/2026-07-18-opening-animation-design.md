# Opening Animation — Design

Sub-project 4 of the wedding-invitation improvement plan. Scope: a full-screen intro animation shown before the hero section, with an admin-editable phrase.

## Style

Handwriting-calligraphy style, chosen from mockups over falling-petals, rings, envelope, and door-opening alternatives. A phrase draws in as if being handwritten, followed by the wedding date, then fades out to reveal the existing hero section.

**Font:** Google Fonts' "Nanum Pen Script" — a genuine handwriting-style font with full Hangul support (unlike `'Brush Script MT'`, which is Latin-only and platform-dependent). Loaded the same way the site already loads 'Noto Sans KR' (a `<link>` in `<head>`, no build step).

## Content

- **Main phrase:** free text, admin-editable. New Firestore field `splashText` on `config/main` (same document as `groomName`, `weddingDate`, etc.), added to the admin.html "✏️ 기본 정보" panel with its own label ("오프닝 애니메이션 문구") — kept visually and semantically separate from the existing `introTitle`/`introText` fields, which belong to the unrelated "인트로 멘트" section (`#intro`) further down the page. Default/fallback text when empty: `"Save the Date"`.
- **Sub-line (date):** reuses the existing `weddingDate` field via the site's existing `formatDate()` helper — no new field, no duplicate data entry for the admin.

## Behavior

- **Trigger:** every page load (no `sessionStorage`/one-time gating) — chosen deliberately over "once per session" so repeat visitors who forget the date still see it.
- **Skip:** tapping/clicking anywhere on the overlay dismisses it immediately.
- **Auto-advance:** ~2.5s if not skipped, then the overlay fades out, revealing the hero section beneath it (which continues to load/render normally underneath — the overlay doesn't block `loadConfig()` or anything else from running).
- **Markup:** a new full-screen fixed-position overlay `<div id="opening-overlay">` in `index.html`, sitting above `#hero`. CSS keyframes handle the handwriting reveal (text-clip wipe, matching the mockup's approach) and the fade-out; a small `main.js` addition wires up the tap-to-skip and the auto-advance timeout, and fills in the phrase/date text once `loadConfig()` has the data.

## Out of scope

- No per-visit/session memory of having seen it (explicit choice, see above).
- No alternate styles (petals/rings/envelope/doors) — picked one, not building a switcher.
