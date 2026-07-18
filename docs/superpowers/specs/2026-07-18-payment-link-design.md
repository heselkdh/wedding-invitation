# Simple Payment Link — Design

Sub-project 5 of the wedding-invitation improvement plan. Scope: let guests send money via KakaoPay/Toss directly instead of manually copying an account number, for any of the 6 existing account entries.

## Why a personal link, not auto-generation

Neither KakaoPay nor Toss offers a way to construct a working "send money to this bank account" deep link from just a bank name + account number — both services' money-request/profile links (`qr.kakaopay.com/...`, `toss.me/...`) are personal links each individual generates themselves inside their own app. The admin has to go get that link from whoever owns each account and paste it in — there's no way around that, and no auto-generation is attempted.

## Data model

Extend the existing `accounts/main` Firestore document with 12 new optional string fields, following the exact naming convention already used for `{prefix}Bank`/`{prefix}Holder`/`{prefix}Account` (`prefix` ∈ `groom`, `groomFather`, `groomMother`, `bride`, `brideFather`, `brideMother`):

- `{prefix}KakaoPay` — a KakaoPay personal link (e.g. `https://qr.kakaopay.com/...`)
- `{prefix}Toss` — a Toss personal link (e.g. `https://toss.me/...`)

Both are optional per person — an empty/missing value means no button shows for that service on that person's card (see below). This covers all 6 people, not just 신랑/신부, per user decision (some parents may also want digital transfer options).

## Admin UI

In `admin.html`'s "💳 계좌번호" panel, under each existing person's `{prefix}Account` input, add two more optional fields:

```html
<label>카카오페이 링크 (선택)</label>
<input type="text" id="{prefix}KakaoPay" placeholder="https://qr.kakaopay.com/...">
<label>토스 링크 (선택)</label>
<input type="text" id="{prefix}Toss" placeholder="https://toss.me/...">
```

Repeated 6 times (once per person block already in the panel). `js/admin.js`'s two `fields` arrays for the accounts panel (load + save) each get all 12 new field names appended.

## Guest-facing display

`js/main.js`'s `makeAccountCard()` currently renders a `.account-info` block (side/holder/bank+number) plus a single `복사` button. It gains two conditional buttons, rendered only when the corresponding link is non-empty:

- **카카오페이** button — official KakaoPay/Kakao brand yellow (`#FEE500`, dark text), matching the color already used for `#kakao-share-btn` elsewhere on this same page (existing precedent in this codebase for real brand colors on payment/share actions, not the site's neutral/bronze palette).
- **토스** button — Toss's brand blue (`#0064FF`, white text).

Both are plain `<a href="..." target="_blank" rel="noopener">` links (not JS-driven `window.open`), consistent with how every other external link in this codebase works (`#kakao-map-btn`, admin.html's Kakao-cache-clear link, etc.). The link URL is passed through the existing `escapeHtml()` helper before being placed in the `href` attribute, same as every other admin-entered string this file already interpolates into `innerHTML`.

A person who hasn't set up either link still just sees the existing 복사 button, unchanged from today.

## Out of scope

- No other payment services (only KakaoPay + Toss, per user decision).
- No validation that a pasted link is actually a real KakaoPay/Toss URL — same trust level as every other admin-entered URL field in this codebase (e.g. `kakaoMapUrl`), no more, no less.
