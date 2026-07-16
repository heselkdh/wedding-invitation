# Fix & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 5 bug/security findings and 2 UI/UX findings from the code review of the wedding-invitation site, with no behavior change beyond the fixes themselves.

**Architecture:** This is a vanilla-JS static site (no bundler, no test runner, ES modules loaded directly by the browser) backed by a live Firebase project (Firestore + Auth) and Cloudinary. There is no test infrastructure to extend, so "test" steps in this plan are concrete manual browser-verification procedures against a local static server, not automated unit tests — introducing a JS test framework is out of scope for a fix-only pass. `js/firebase.js` points at the real production Firebase project (no emulator config exists), so any step that writes data (guestbook submit, photo upload) must be cleaned up afterward via the admin panel.

**Tech Stack:** Vanilla JS (ES modules), Firebase v11 modular SDK (Firestore/Auth), Cloudinary upload API, plain CSS.

---

## Local verification setup (read before Task 1)

Serve the site with any static file server from the repo root — ES modules are blocked under `file://`:

```bash
npx serve . -p 5173
```

Then open `http://localhost:5173/index.html` (guest-facing site) and `http://localhost:5173/admin.html` (admin panel — log in with an existing admin account) as needed per task.

---

### Task 1: Add the transport-info HTML sanitizer

**Files:**
- Create: `js/sanitize.js`

- [ ] **Step 1: Write `js/sanitize.js`**

```js
const ALLOWED_TAGS = new Set(['H4', 'P', 'BR', 'STRONG', 'EM', 'UL', 'LI']);

// Allowlist HTML sanitizer for admin-authored rich text (e.g. transport info).
// Uses a <template> element so parsing never executes scripts or loads
// resources — its content is an inert DocumentFragment.
export function sanitizeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  stripDisallowed(template.content);
  return template.innerHTML;
}

function stripDisallowed(node) {
  [...node.childNodes].forEach(child => {
    if (child.nodeType !== Node.ELEMENT_NODE) return;

    if (!ALLOWED_TAGS.has(child.tagName)) {
      child.replaceWith(document.createTextNode(child.textContent));
      return;
    }

    [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
    stripDisallowed(child);
  });
}
```

- [ ] **Step 2: Manually verify in the browser console**

Serve the site (see setup above), open `http://localhost:5173/index.html`, open devtools console, and run:

```js
const { sanitizeHtml } = await import('./js/sanitize.js');
sanitizeHtml('<h4>안내</h4><script>alert(1)</script><img src=x onerror="alert(1)"><p onclick="alert(1)">문의</p>');
```

Expected output: `"<h4>안내</h4>alert(1)<p>문의</p>"` — the `<script>` tag is unwrapped to its (harmless, inert) text content, `<img>` is removed entirely (no text content), `<h4>`/`<p>` survive with all attributes stripped.

- [ ] **Step 3: Commit**

```bash
git add js/sanitize.js
git commit -m "feat: add allowlist HTML sanitizer for admin rich-text fields"
```

---

### Task 2: Fix parent-names XSS (`main.js:38-39`)

**Files:**
- Modify: `js/main.js:38-39`

- [ ] **Step 1: Add a safe-DOM helper and use it for both parent-name fields**

In `js/main.js`, replace:

```js
  document.getElementById('groom-parents').innerHTML      = d.groomParents.replace(/,/g, '<br>');
  document.getElementById('bride-parents').innerHTML      = d.brideParents.replace(/,/g, '<br>');
```

with:

```js
  setCommaListWithBreaks(document.getElementById('groom-parents'), d.groomParents);
  setCommaListWithBreaks(document.getElementById('bride-parents'), d.brideParents);
```

Then add this function near `formatDate` (around line 169), so it's defined before `loadConfig` runs at the bottom of the file:

```js
function setCommaListWithBreaks(el, text) {
  el.textContent = '';
  text.split(',').forEach((part, i) => {
    if (i > 0) el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(part));
  });
}
```

- [ ] **Step 2: Manually verify**

Serve the site, open `http://localhost:5173/index.html`, open devtools console, and run:

```js
document.getElementById('groom-parents').outerHTML
```

Expected: parent names render with a `<br>` between each comma-separated part, identical to before the change (e.g. `<div id="groom-parents">아버지 박○○<br>어머니 이○○</div>`).

Then confirm the fix by temporarily setting a malicious value and confirming it renders as literal text, not HTML:

```js
setCommaListWithBreaks(document.getElementById('groom-parents'), '<img src=x onerror=alert(1)>,ok');
```

Expected: no alert fires; the element's text visibly shows the literal `<img src=x onerror=alert(1)>` string followed by "ok" on the next line.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "fix: render parent names via safe DOM construction instead of innerHTML"
```

---

### Task 3: Sanitize transport-info HTML (`main.js:66`)

**Files:**
- Modify: `js/main.js:1, 66`

- [ ] **Step 1: Import the sanitizer and use it**

Add to the top imports in `js/main.js`:

```js
import { sanitizeHtml } from './sanitize.js';
```

Replace:

```js
  document.getElementById('transport-info').innerHTML = d.transport || '';
```

with:

```js
  document.getElementById('transport-info').innerHTML = sanitizeHtml(d.transport || '');
```

- [ ] **Step 2: Manually verify**

Serve the site, open `http://localhost:5173/index.html`. The "오시는 길" (LOCATION) section's transport info must render identically to before (headings/paragraphs intact) — confirm by comparing against the current production site or the `SAMPLE.transport` value in `main.js:19-21`.

Then in devtools console:

```js
const { sanitizeHtml } = await import('./js/sanitize.js');
sanitizeHtml('<h4>🚇 지하철</h4><script>alert(1)</script><p>2호선 강남역</p>');
```

Expected: `"<h4>🚇 지하철</h4>alert(1)<p>2호선 강남역</p>"` — headings/paragraphs preserved, script neutralized.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "fix: sanitize transport-info HTML before rendering"
```

---

### Task 4: Clear the countdown interval once it reaches zero (`main.js:180-210`)

**Files:**
- Modify: `js/main.js:181-210`

- [ ] **Step 1: Track and clear the interval id**

Replace the `startCountdown` function:

```js
function startCountdown(dateStr, timeStr) {
  let hour = 12, min = 0;
  if (timeStr) {
    const isPm = timeStr.includes('오후');
    const h    = parseInt(timeStr.match(/(\d+)시/)?.[1] ?? '12');
    min        = parseInt(timeStr.match(/(\d+)분/)?.[1] ?? '0');
    hour       = isPm ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
  }
  const target = new Date(dateStr);
  target.setHours(hour, min, 0, 0);

  let intervalId = null;

  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      ['days','hours','mins','secs'].forEach(u =>
        (document.getElementById(`cd-${u}`).textContent = '0'));
      if (intervalId !== null) clearInterval(intervalId);
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000)  / 60000);
    const s = Math.floor((diff % 60000)    / 1000);
    document.getElementById('cd-days').textContent  = d;
    document.getElementById('cd-hours').textContent = String(h).padStart(2,'0');
    document.getElementById('cd-mins').textContent  = String(m).padStart(2,'0');
    document.getElementById('cd-secs').textContent  = String(s).padStart(2,'0');
  }
  tick();
  intervalId = setInterval(tick, 1000);
}
```

- [ ] **Step 2: Manually verify**

Temporarily edit the `startCountdown(d.weddingDate, d.weddingTime);` call (around line 76) to `startCountdown('2000-01-01', '오전 12시 00분');` — a date in the past — and add a temporary `console.log('tick', diff);` as the first line inside `tick()`.

Serve the site, open `http://localhost:5173/index.html`, and watch the devtools console:

Expected: `tick` logs exactly once with a negative `diff`, then stops permanently. The `cd-days`/`cd-hours`/`cd-mins`/`cd-secs` elements all show `0`. Before this fix, `tick` would have kept logging once per second forever.

Revert both temporary edits (the `startCountdown` call and the `console.log`) once confirmed.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "fix: clear countdown interval once the target date is reached"
```

---

### Task 5: Unsubscribe the guestbook Firestore listener on page hide (`main.js:263-292`)

**Files:**
- Modify: `js/main.js:263-292`

- [ ] **Step 1: Store and detach the unsubscribe function**

Replace `loadGuestbook`:

```js
let _unsubGuestbook = null;

function loadGuestbook() {
  if (!isConfigured) {
    document.getElementById('guestbook-list').innerHTML =
      '<p style="text-align:center;color:#b08898;font-size:0.85rem;">Firebase 연동 후 방명록을 사용할 수 있습니다 🌸</p>';
    document.getElementById('gb-submit').disabled = true;
    return;
  }

  const q = query(collection(db, 'guestbook'), orderBy('createdAt', 'desc'));
  _unsubGuestbook = onSnapshot(q, snap => {
    const list = document.getElementById('guestbook-list');
    list.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const ts   = data.createdAt?.toDate();
      const dateStr = ts
        ? `${ts.getFullYear()}.${String(ts.getMonth()+1).padStart(2,'0')}.${String(ts.getDate()).padStart(2,'0')}`
        : '';
      const el = document.createElement('div');
      el.className = 'guestbook-msg';
      el.innerHTML = `
        <div class="guestbook-msg-name">🌸 ${escapeHtml(data.name)}</div>
        <div class="guestbook-msg-text">${escapeHtml(data.message)}</div>
        <div class="guestbook-msg-date">${dateStr}</div>
      `;
      list.appendChild(el);
    });
  });
}

window.addEventListener('pagehide', () => {
  if (_unsubGuestbook) { _unsubGuestbook(); _unsubGuestbook = null; }
});
```

- [ ] **Step 2: Manually verify**

Serve the site, open `http://localhost:5173/index.html` with devtools open on the Network tab filtered to `firestore` (WebChannel) requests. Confirm the guestbook listener connection is active, then navigate away (e.g. type a different URL in the address bar) and confirm no new Firestore listener errors appear in the console afterward — reopen the page and confirm the guestbook list still loads correctly (i.e. the fix didn't break normal operation).

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "fix: unsubscribe guestbook Firestore listener on pagehide"
```

---

### Task 6: Throttle the parallax scroll handler (`main.js:367-373`)

**Files:**
- Modify: `js/main.js:367-373`

- [ ] **Step 1: Wrap the transform update in a requestAnimationFrame throttle**

Replace `initParallax`:

```js
function initParallax() {
  const heroBg = document.getElementById('hero-bg');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      heroBg.style.transform = `translateY(${window.scrollY * 0.4}px)`;
      ticking = false;
    });
  }, { passive: true });
}
```

- [ ] **Step 2: Manually verify**

Serve the site, open `http://localhost:5173/index.html`, scroll the page, and confirm the hero background still moves at the same parallax rate as before (visually identical). Then open the Performance panel, record a scroll gesture, and confirm `heroBg.style.transform` writes (visible as "Recalculate Style"/"Layout" entries tied to the scroll handler) are capped at roughly one per animation frame (~60/sec) rather than firing on every raw `scroll` event (which can fire hundreds of times per second on trackpad/momentum scroll).

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "perf: throttle parallax scroll handler to one update per frame"
```

---

### Task 7: Add guestbook spam protection (cooldown + honeypot)

**Files:**
- Modify: `index.html:152-156`
- Modify: `js/main.js:294-314`

- [ ] **Step 1: Add a visually-hidden honeypot field to the guestbook form**

In `index.html`, inside `.guestbook-form` (around line 152), add the honeypot input before the submit button:

```html
  <div class="guestbook-form fade-up">
    <input type="text" id="gb-name" placeholder="이름" maxlength="20">
    <textarea id="gb-message" placeholder="축하 메시지를 남겨주세요 🌸" maxlength="200"></textarea>
    <input type="text" id="gb-website" name="website" autocomplete="off" tabindex="-1"
           style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;" aria-hidden="true">
    <button class="guestbook-submit" id="gb-submit">메시지 남기기</button>
  </div>
```

- [ ] **Step 2: Add cooldown + honeypot checks to the submit handler**

In `js/main.js`, replace the `gb-submit` click handler (lines 294-314):

```js
const GB_COOLDOWN_MS = 60 * 1000;

let gbSubmitting = false;
document.getElementById('gb-submit').addEventListener('click', async () => {
  if (!isConfigured || gbSubmitting) return;

  const honeypot = document.getElementById('gb-website').value;
  const name     = document.getElementById('gb-name').value.trim();
  const message  = document.getElementById('gb-message').value.trim();
  if (!name || !message) { showToast('이름과 메시지를 입력해주세요'); return; }

  if (honeypot) {
    // Bot filled the hidden field — pretend success without writing anything.
    document.getElementById('gb-name').value    = '';
    document.getElementById('gb-message').value = '';
    showToast('메시지가 등록되었습니다 🌸');
    return;
  }

  const lastSubmit = Number(localStorage.getItem('gbLastSubmit') || 0);
  const remainingMs = GB_COOLDOWN_MS - (Date.now() - lastSubmit);
  if (remainingMs > 0) {
    showToast(`잠시 후 다시 시도해주세요 (${Math.ceil(remainingMs / 1000)}초)`);
    return;
  }

  gbSubmitting = true;
  const btn = document.getElementById('gb-submit');
  btn.disabled = true;
  try {
    await addDoc(collection(db, 'guestbook'), { name, message, createdAt: serverTimestamp() });
    localStorage.setItem('gbLastSubmit', String(Date.now()));
    document.getElementById('gb-name').value    = '';
    document.getElementById('gb-message').value = '';
    showToast('메시지가 등록되었습니다 🌸');
  } catch {
    showToast('등록에 실패했습니다. 다시 시도해주세요');
  } finally {
    gbSubmitting = false;
    btn.disabled = false;
  }
});
```

- [ ] **Step 3: Manually verify (writes real data — clean up afterward)**

Serve the site, open `http://localhost:5173/index.html`:

1. Submit a real guestbook entry with a test name/message. Confirm it appears in the list and a success toast shows.
2. Immediately submit again. Confirm a cooldown toast appears (e.g. "잠시 후 다시 시도해주세요 (59초)") and no second Firestore write happens (check the Network tab — no new `Write` request to `firestore`).
3. In devtools console, run `localStorage.removeItem('gbLastSubmit')`, then in the console set the honeypot and submit: `document.getElementById('gb-website').value = 'bot'; document.getElementById('gb-name').value = 'bot-test'; document.getElementById('gb-message').value = 'bot-test'; document.getElementById('gb-submit').click();`. Confirm a success toast shows but no new entry appears in the guestbook list or in the Network tab's Firestore writes (the honeypot path returns early).
4. Clean up: open `http://localhost:5173/admin.html`, log in, open "🗑️ 방명록 관리", and delete the test entry from step 1.

- [ ] **Step 4: Commit**

```bash
git add index.html js/main.js
git commit -m "feat: add cooldown + honeypot spam protection to guestbook"
```

---

### Task 8: Fix admin panel mobile layout (`css/admin.css`)

**Files:**
- Modify: `css/admin.css`

- [ ] **Step 1: Add a mobile breakpoint**

Append to the end of `css/admin.css`:

```css
/* ── 모바일 반응형 ── */
@media (max-width: 480px) {
  .photo-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Manually verify**

Serve the site, open `http://localhost:5173/admin.html`, log in, open devtools device toolbar and set the viewport to 375px wide (iPhone SE). Open "📸 사진 관리" and confirm the photo grid shows 2 columns (not 3) with the drag-handle/delete-button overlays no longer overlapping the thumbnail edges awkwardly. Open "✏️ 기본 정보" and confirm the two-column field rows (e.g. 신랑/신부 이름) now stack to a single column. Then widen the viewport back above 480px and confirm both layouts return to their original 3-column/2-column form.

- [ ] **Step 3: Commit**

```bash
git add css/admin.css
git commit -m "fix: make admin photo grid and form rows responsive below 480px"
```

---

### Task 9: Show upload-in-progress state on file upload areas

**Files:**
- Modify: `js/admin.js:125-208, 350-394`

- [ ] **Step 1: Dim and disable each upload area while its upload is in flight**

In `js/admin.js`, update the four upload handlers to toggle the existing `.saving` class (opacity 0.6 + `pointer-events: none`, already defined in `css/admin.css:309`) on the upload area label while the request is pending.

Replace the OG-thumbnail handler (lines 125-140):

```js
document.getElementById('og-thumb-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const area = document.getElementById('og-thumb-upload-area');
  const progress = document.getElementById('og-thumb-progress');
  area.classList.add('saving');
  progress.textContent = '업로드 중...';
  try {
    const url = await uploadToCloudinary(file);
    await setDoc(doc(db, 'config', 'main'), { ogImageUrl: url }, { merge: true });
    showOgThumbPreview(url);
    progress.textContent = '완료! ✅ 아래 버튼으로 카카오 캐시를 초기화하세요.';
    setTimeout(() => { progress.textContent = ''; }, 5000);
  } catch (err) {
    progress.textContent = `오류: ${err.message}`;
  }
  area.classList.remove('saving');
  e.target.value = '';
});
```

Replace the hero-background handler (lines 150-165):

```js
document.getElementById('hero-bg-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const area = document.getElementById('hero-bg-upload-area');
  const progress = document.getElementById('hero-bg-progress');
  area.classList.add('saving');
  progress.textContent = '업로드 중...';
  try {
    const url = await uploadToCloudinary(file);
    await setDoc(doc(db, 'config', 'main'), { heroBgUrl: url }, { merge: true });
    showHeroBgPreview(url);
    progress.textContent = '배경 이미지 업로드 완료! ✅';
    setTimeout(() => { progress.textContent = ''; }, 3000);
  } catch (err) {
    progress.textContent = `오류: ${err.message}`;
  }
  area.classList.remove('saving');
  e.target.value = '';
});
```

Replace the map-image handler (lines 184-199):

```js
document.getElementById('map-image-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const area = document.getElementById('map-upload-area');
  const progress = document.getElementById('map-upload-progress');
  area.classList.add('saving');
  progress.textContent = '업로드 중...';
  try {
    const url = await uploadToCloudinary(file);
    await setDoc(doc(db, 'config', 'main'), { mapImageUrl: url }, { merge: true });
    showMapPreview(url);
    progress.textContent = '약도 업로드 완료! ✅';
    setTimeout(() => { progress.textContent = ''; }, 3000);
  } catch (err) {
    progress.textContent = `오류: ${err.message}`;
  }
  area.classList.remove('saving');
  e.target.value = '';
});
```

Replace the multi-photo handler (lines 350-394):

```js
document.getElementById('photo-input').addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const area = document.getElementById('upload-area');
  const progressEl = document.getElementById('upload-progress');
  area.classList.add('saving');
  progressEl.style.color = '#8a6a76';
  progressEl.textContent = `0 / ${files.length} 업로드 중...`;

  let maxOrder = 0;
  try {
    const snap = await getDocs(query(collection(db, 'photos'), orderBy('order', 'desc')));
    maxOrder = snap.empty ? 0 : (snap.docs[0].data().order ?? 0);
  } catch (err) {
    console.error('사진 목록 조회 실패:', err);
  }

  let done = 0, failed = 0;
  for (const file of files) {
    try {
      progressEl.textContent = `${done + 1} / ${files.length} ${file.size > 9*1024*1024 ? '압축 및 ' : ''}업로드 중...`;
      const url = await uploadToCloudinary(file);
      await addDoc(collection(db, 'photos'), {
        url, order: ++maxOrder, createdAt: serverTimestamp()
      });
      done++;
      progressEl.textContent = `${done} / ${files.length} 완료...`;
    } catch (err) {
      failed++;
      console.error('사진 업로드 실패:', err.message, err);
      progressEl.style.color = '#c0392b';
      progressEl.textContent = `오류: ${err.message}`;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (failed === 0) {
    progressEl.style.color = '#8a6a76';
    progressEl.textContent = `${done}장 업로드 완료! ✅`;
  } else {
    progressEl.style.color = '#c0392b';
    progressEl.textContent = `${done}장 성공 / ${failed}장 실패 — 브라우저 콘솔(F12)에서 오류 확인`;
  }
  area.classList.remove('saving');
  setTimeout(() => { progressEl.textContent = ''; progressEl.style.color = '#8a6a76'; }, 5000);
  e.target.value = '';
});
```

- [ ] **Step 2: Manually verify (writes real data — clean up afterward)**

Serve the site, open `http://localhost:5173/admin.html`, log in, open "📸 사진 관리", and upload one test image via "클릭하여 사진 추가". While the upload is in flight, confirm the upload area visibly dims and clicking it again has no effect (no second file picker opens). After it completes, confirm the area returns to full opacity and is clickable again. Repeat briefly for the OG-thumbnail, hero-background, and map-image upload areas in "✏️ 기본 정보" (a single quick image is enough for each — no need for large files).

Clean up: delete the test photo via its "×" button in the photo grid, and use "🗑️ 배경 삭제"/"🗑️ 약도 삭제" to remove the test hero/map images if you don't want to keep them (the OG thumbnail can be left as-is or overwritten with a real one later, since there's no delete button for it).

- [ ] **Step 3: Commit**

```bash
git add js/admin.js
git commit -m "fix: dim upload areas while an upload is in flight"
```

---

## Plan self-review notes

- **Spec coverage:** all 8 spec items map 1:1 to Tasks 2–9 (Task 1 is the shared sanitizer dependency for Task 3). No gaps.
- **No test framework added:** intentional per the Architecture note above — the codebase has none, and adding one is out of scope for a fix-only pass.
- **Data hygiene:** Tasks 7 and 9 write real data to the production Firebase project during manual verification; both include explicit cleanup steps.
