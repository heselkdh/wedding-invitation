# Opening Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a full-screen handwriting-style opening animation (admin-editable phrase + wedding date) before the hero section on every page load, skippable by tap and auto-advancing after ~2.5s.

**Architecture:** A `position: fixed` overlay `<div>` sits above `#hero` in `index.html`. CSS keyframes handle the handwriting reveal (a text-clip wipe, the same technique validated in the brainstorming mockup) and the fade-out. `main.js` fills in the phrase/date text once Firestore config is loaded, then wires up click-to-skip and a timeout-based auto-advance. The phrase is a new `splashText` field on the existing `config/main` Firestore document, editable from `admin.html`'s "✏️ 기본 정보" panel — no new collection, no new admin panel section.

**Tech Stack:** Vanilla JS/CSS, Google Fonts ('Nanum Pen Script' added to the existing `@import` in `css/style.css`). No test runner in this codebase — verification is manual browser checks via a local static server, matching prior plans in this project.

---

## Local verification setup (read before Task 1)

```bash
npx serve . -p 5173
```

Open `http://localhost:5173/index.html` and `http://localhost:5173/admin.html` as needed.

---

### Task 1: Add the 'Nanum Pen Script' font and opening-overlay CSS

**Files:**
- Modify: `css/style.css:1-21` (font import + design tokens), and a new block before the "1. Hero" section comment (currently around line 69)

- [ ] **Step 1: Add the font to the existing Google Fonts import**

In `css/style.css`, change:

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Noto+Serif+KR:wght@300;400&family=Noto+Sans+KR:wght@200;300;400;500&display=swap');
```

to:

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Noto+Serif+KR:wght@300;400&family=Noto+Sans+KR:wght@200;300;400;500&family=Nanum+Pen+Script&display=swap');
```

- [ ] **Step 2: Add a `--font-script` design token**

In the `:root` block, right after `--font-sans`:

```css
  --font-sans:    'Noto Sans KR', -apple-system, sans-serif;
  --font-script:  'Nanum Pen Script', cursive;
```

- [ ] **Step 3: Add the overlay CSS**

Insert this new block right before the `/* ════════════════════════════ 1. Hero ════════════════════════════ */` comment:

```css
/* ════════════════════════════
   0. 오프닝 애니메이션
════════════════════════════ */
#opening-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: var(--white);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.5s ease;
}
#opening-overlay.hide {
  opacity: 0;
  pointer-events: none;
}

.opening-text {
  font-family: var(--font-script);
  font-size: 2.4rem;
  color: var(--accent);
  background: linear-gradient(90deg, var(--accent) 0%, var(--accent) 50%, transparent 50%, transparent 100%);
  background-size: 200% 100%;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: openingDraw 1.8s ease-in-out forwards;
}
@keyframes openingDraw {
  0%   { background-position: 100% 0; }
  100% { background-position: 0% 0; }
}

.opening-date {
  margin-top: 14px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  color: var(--gray-2);
  opacity: 0;
  animation: openingDateIn 0.6s ease forwards;
  animation-delay: 1.6s;
}
@keyframes openingDateIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 4: Manually verify**

Serve the site, open `http://localhost:5173/index.html`, open devtools console, and run:

```js
getComputedStyle(document.documentElement).getPropertyValue('--font-script').trim()
```

Expected: `"'Nanum Pen Script', cursive"`. This confirms the token exists even before the overlay markup is added in Task 2 (CSS alone doesn't render anything without the HTML).

- [ ] **Step 5: Commit**

```bash
git add css/style.css
git commit -m "feat: add opening-animation font token and CSS"
```

---

### Task 2: Add the opening-overlay markup to index.html

**Files:**
- Modify: `index.html:19-21` (right after `<body>`, before `#hero`)

- [ ] **Step 1: Add the overlay markup**

In `index.html`, right after `<body>` and before the `<!-- 1. 인트로 (Hero) -->` comment:

```html
<!-- 0. 오프닝 애니메이션 -->
<div id="opening-overlay">
  <div class="opening-text" id="opening-text">Save the Date</div>
  <div class="opening-date" id="opening-date"></div>
</div>
```

- [ ] **Step 2: Manually verify**

Serve the site, open `http://localhost:5173/index.html`. Expected: a full-screen white overlay covers everything, with "Save the Date" drawing itself in (handwriting wipe) over ~1.8s, matching the approved mockup's motion. It won't disappear yet (no JS wired up until Task 3) — reload the page to see the animation again, or move on to Task 3.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add opening-animation overlay markup"
```

---

### Task 3: Wire up the opening animation in main.js

**Files:**
- Modify: `js/main.js` (new function + one call site inside `loadConfig`)

- [ ] **Step 1: Add `initOpeningAnimation`**

Add this function near `initKakaoShare` in `js/main.js` (e.g. right before it):

```js
function initOpeningAnimation(cfg, dateStr) {
  const overlay = document.getElementById('opening-overlay');
  if (!overlay) return;

  document.getElementById('opening-text').textContent = cfg.splashText || 'Save the Date';
  document.getElementById('opening-date').textContent = dateStr;

  const dismiss = () => overlay.classList.add('hide');
  overlay.addEventListener('click', dismiss, { once: true });
  setTimeout(dismiss, 2500);
}
```

- [ ] **Step 2: Call it from `loadConfig`**

In `loadConfig`, right after the line `const dateStr = formatDate(d.weddingDate);`, add:

```js
  initOpeningAnimation(d, dateStr);
```

- [ ] **Step 3: Manually verify — text fills in correctly**

Serve the site, open `http://localhost:5173/index.html`, open devtools console, and run:

```js
({
  text: document.getElementById('opening-text').textContent,
  date: document.getElementById('opening-date').textContent
})
```

Expected: `text` matches the live `splashText` config value (or `"Save the Date"` if unset), and `date` matches the real wedding date formatted the same way as `#hero-date`/`#dt-date` elsewhere on the page (e.g. `"2026년 10월 3일 토요일"`).

- [ ] **Step 4: Manually verify — click-to-skip**

Reload the page, then in devtools console immediately run:

```js
document.getElementById('opening-overlay').click();
document.getElementById('opening-overlay').classList.contains('hide');
```

Expected: `true`.

- [ ] **Step 5: Manually verify — auto-advance**

Reload the page, then run in the console:

```js
await new Promise(r => setTimeout(r, 2700));
document.getElementById('opening-overlay').classList.contains('hide');
```

Expected: `true` (the overlay dismissed itself after ~2.5s without any click).

- [ ] **Step 6: Commit**

```bash
git add js/main.js
git commit -m "feat: wire up opening-animation text, skip, and auto-advance"
```

---

### Task 4: Make the opening-animation phrase admin-editable

**Files:**
- Modify: `admin.html` (new field near the wedding date/time fields)
- Modify: `js/admin.js:100-102, 226-228` (both `fields` arrays in the info-panel load/save handlers)

- [ ] **Step 1: Add the field to admin.html**

In `admin.html`, right after the `weddingDate`/`weddingTime` `.form-row` block (before `예식장 이름`), add:

```html
        <label>오프닝 애니메이션 문구 (손글씨 스타일로 표시)</label>
        <input type="text" id="splashText" placeholder="Save the Date">
```

- [ ] **Step 2: Add `splashText` to both `fields` arrays in admin.js**

In `js/admin.js`, `loadInfoForm` (around line 100-102):

```js
  const fields = ['groomName','brideName','groomParents','brideParents',
                  'weddingDate','weddingTime','venueName','venueAddress',
                  'kakaoMapUrl','transport','musicUrl','introTitle','introText','splashText'];
```

And the `save-info-btn` click handler (around line 226-228) — same change:

```js
  const fields = ['groomName','brideName','groomParents','brideParents',
                  'weddingDate','weddingTime','venueName','venueAddress',
                  'kakaoMapUrl','transport','musicUrl','introTitle','introText','splashText'];
```

- [ ] **Step 3: Manually verify (writes real data)**

Serve the site, open `http://localhost:5173/admin.html`, log in, open "✏️ 기본 정보", type a distinctive test phrase (e.g. `테스트 문구`) into the new "오프닝 애니메이션 문구" field, click "저장", confirm the "기본 정보가 저장되었습니다 ✅" toast. Reload the admin page and confirm the field still shows `테스트 문구` (proves it round-trips through Firestore). Then open `http://localhost:5173/index.html` and confirm the opening overlay now shows `테스트 문구` instead of the default.

Clean up: go back to admin and set the field to whatever the couple actually wants (or leave the test value if it's a reasonable placeholder — check with whoever owns the content before leaving test text live).

- [ ] **Step 4: Commit**

```bash
git add admin.html js/admin.js
git commit -m "feat: make opening-animation phrase admin-editable"
```

---

## Plan self-review notes

- **Spec coverage:** style (Task 1), markup (Task 2), behavior — text fill/skip/auto-advance (Task 3), admin editability (Task 4) all map to the design spec's sections. "Every visit, no session gating" is satisfied by construction (no `sessionStorage`/`localStorage` check anywhere in Task 3). No out-of-scope items were added.
- **No test framework added:** consistent with prior plans in this repo.
- **Data hygiene:** Task 4's verification writes a real test value to the production `config/main` document; the step includes a note to set it to real content afterward.
