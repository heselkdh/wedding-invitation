# Simple Payment Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each of the 6 account entries (신랑/신랑父/신랑母/신부/신부父/신부母) optionally carry a KakaoPay and/or Toss personal link, admin-editable, shown as brand-colored buttons on the guest-facing account cards next to the existing "복사" button.

**Architecture:** Two new optional string fields per person (`{prefix}KakaoPay`, `{prefix}Toss`) on the existing `accounts/main` Firestore document, following the exact naming convention already used for `{prefix}Bank`/`{prefix}Holder`/`{prefix}Account`. Admin UI: 12 new inputs in `admin.html`'s existing 계좌번호 panel. Guest UI: `js/main.js`'s `makeAccountCard()` renders a button per non-empty link, wrapped alongside the existing copy button in a new `.account-actions` flex container.

**Tech Stack:** Vanilla JS/CSS/Firestore, same patterns as every other config field in this codebase. No test runner — verification is manual browser checks via a local static server, per prior plans in this project.

---

## Local verification setup (read before Task 1)

```bash
npx serve . -p 5173
```

Open `http://localhost:5173/index.html` and `http://localhost:5173/admin.html` as needed.

---

### Task 1: Add payment-button CSS

**Files:**
- Modify: `css/style.css:689-703` (`.copy-btn`), and a new block after it (currently ending around line 709)

- [ ] **Step 1: Remove the copy button's own left margin**

In `css/style.css`, the `.copy-btn` rule currently includes `margin-left: 12px;` (used to space it from `.account-info` when it was the only other flex child of `.account-card`). Remove that one line — spacing will move to the new wrapper in Step 2:

```css
.copy-btn {
  background: transparent;
  color: var(--gray-1);
  border: 1px solid var(--gray-3);
  border-radius: var(--radius);
  padding: 7px 14px;
  font-size: 0.73rem;
  font-family: var(--font-sans);
  font-weight: 400;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Add the actions wrapper and payment-button styles**

Right after the `.copy-btn:hover` rule (currently the last rule before the `/* ── 음악 바 ── */` comment), add:

```css
.account-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
  margin-left: 12px;
}

.pay-btn {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius);
  padding: 7px 14px;
  font-size: 0.73rem;
  font-family: var(--font-sans);
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: filter 0.2s ease;
}

.pay-btn:hover { filter: brightness(0.94); }

.pay-kakao { background: #FEE500; color: #3C1E1E; }
.pay-toss  { background: #0064FF; color: var(--white); }
```

- [ ] **Step 3: Manually verify**

Serve the site, open `http://localhost:5173/index.html`, open devtools console, and run:

```js
getComputedStyle(document.querySelector('.copy-btn')).marginLeft
```

Expected: `"0px"` (the margin moved off `.copy-btn`). This only checks the CSS itself — the new `.account-actions`/`.pay-btn` classes aren't used by any markup yet (that's Task 4), so there's nothing else to visually check until then.

- [ ] **Step 4: Commit**

```bash
git add css/style.css
git commit -m "feat: add payment-button CSS for KakaoPay/Toss links"
```

---

### Task 2: Add the 12 admin input fields

**Files:**
- Modify: `admin.html:176, 184, 192, 200, 208, 216` (right after each existing `{prefix}Account` input)

- [ ] **Step 1: Add the KakaoPay/Toss fields after each person's account number**

In `admin.html`'s "💳 계좌번호" panel, after each of the 6 existing `<input ... id="{prefix}Account" ...>` lines, add two more fields. For example, after the 신랑 block's account input (currently `<input type="text" id="groomAccount" placeholder="000-0000-0000-00">`):

```html
        <label>계좌번호</label>
        <input type="text" id="groomAccount" placeholder="000-0000-0000-00">
        <label>카카오페이 링크 (선택)</label>
        <input type="text" id="groomKakaoPay" placeholder="https://qr.kakaopay.com/...">
        <label>토스 링크 (선택)</label>
        <input type="text" id="groomToss" placeholder="https://toss.me/...">
```

Repeat the same pattern for all 6 people, swapping the id prefix each time: `groom`, `groomFather`, `groomMother`, `bride`, `brideFather`, `brideMother`. So the 12 new inputs are: `groomKakaoPay`, `groomToss`, `groomFatherKakaoPay`, `groomFatherToss`, `groomMotherKakaoPay`, `groomMotherToss`, `brideKakaoPay`, `brideToss`, `brideFatherKakaoPay`, `brideFatherToss`, `brideMotherKakaoPay`, `brideMotherToss`.

- [ ] **Step 2: Manually verify**

Serve the site, open `http://localhost:5173/admin.html`, open devtools console, and run:

```js
['groomKakaoPay','groomToss','groomFatherKakaoPay','groomFatherToss','groomMotherKakaoPay','groomMotherToss',
 'brideKakaoPay','brideToss','brideFatherKakaoPay','brideFatherToss','brideMotherKakaoPay','brideMotherToss']
  .every(id => !!document.getElementById(id))
```

Expected: `true` (all 12 inputs exist in the DOM — this works even before login, since `#admin-screen`'s children exist regardless of the visibility toggle).

- [ ] **Step 3: Commit**

```bash
git add admin.html
git commit -m "feat: add KakaoPay/Toss link fields to admin accounts panel"
```

---

### Task 3: Wire the 12 fields into admin.js's load/save handlers

**Files:**
- Modify: `js/admin.js:437-442` (`loadAccountsForm`'s `fields` array)
- Modify: `js/admin.js:454-459` (`save-accounts-btn` handler's `fields` array)

- [ ] **Step 1: Add all 12 new field names to both arrays**

In `js/admin.js`, `loadAccountsForm` (around line 437-442):

```js
  const fields = ['groomBank','groomHolder','groomAccount','groomKakaoPay','groomToss',
                  'groomFatherBank','groomFatherHolder','groomFatherAccount','groomFatherKakaoPay','groomFatherToss',
                  'groomMotherBank','groomMotherHolder','groomMotherAccount','groomMotherKakaoPay','groomMotherToss',
                  'brideBank','brideHolder','brideAccount','brideKakaoPay','brideToss',
                  'brideFatherBank','brideFatherHolder','brideFatherAccount','brideFatherKakaoPay','brideFatherToss',
                  'brideMotherBank','brideMotherHolder','brideMotherAccount','brideMotherKakaoPay','brideMotherToss'];
```

And the `save-accounts-btn` click handler (around line 454-459) — the exact same array:

```js
  const fields = ['groomBank','groomHolder','groomAccount','groomKakaoPay','groomToss',
                  'groomFatherBank','groomFatherHolder','groomFatherAccount','groomFatherKakaoPay','groomFatherToss',
                  'groomMotherBank','groomMotherHolder','groomMotherAccount','groomMotherKakaoPay','groomMotherToss',
                  'brideBank','brideHolder','brideAccount','brideKakaoPay','brideToss',
                  'brideFatherBank','brideFatherHolder','brideFatherAccount','brideFatherKakaoPay','brideFatherToss',
                  'brideMotherBank','brideMotherHolder','brideMotherAccount','brideMotherKakaoPay','brideMotherToss'];
```

- [ ] **Step 2: Manually verify (writes real data — clean up afterward)**

Serve the site, open `http://localhost:5173/admin.html`, log in, open "💳 계좌번호". Fill in `groomKakaoPay` with a test value (e.g. `https://qr.kakaopay.com/test123`) and `groomToss` with another (e.g. `https://toss.me/test123`), click "저장", confirm the "계좌번호가 저장되었습니다 ✅" toast. Reload the admin page and confirm both fields still show the test values (proves the round trip through Firestore for the new fields).

Clean up: either replace the test values with real links if you have them, or clear both fields and save again to remove the test data (an empty string is a valid, harmless value — matches how every other optional account field behaves when left blank).

- [ ] **Step 3: Commit**

```bash
git add js/admin.js
git commit -m "feat: wire KakaoPay/Toss fields into accounts load/save"
```

---

### Task 4: Render the payment buttons on the guest-facing account cards

**Files:**
- Modify: `js/main.js:357-410` (`loadAccounts` and `makeAccountCard`)

- [ ] **Step 1: Extend the defaults, the two person-lists, and the card renderer**

In `js/main.js`, replace the `loadAccounts` function's default-data object and its two lists:

```js
async function loadAccounts() {
  let data = {
    groomHolder:'', groomBank:'', groomAccount:'', groomKakaoPay:'', groomToss:'',
    groomFatherHolder:'', groomFatherBank:'', groomFatherAccount:'', groomFatherKakaoPay:'', groomFatherToss:'',
    groomMotherHolder:'', groomMotherBank:'', groomMotherAccount:'', groomMotherKakaoPay:'', groomMotherToss:'',
    brideHolder:'', brideBank:'', brideAccount:'', brideKakaoPay:'', brideToss:'',
    brideFatherHolder:'', brideFatherBank:'', brideFatherAccount:'', brideFatherKakaoPay:'', brideFatherToss:'',
    brideMotherHolder:'', brideMotherBank:'', brideMotherAccount:'', brideMotherKakaoPay:'', brideMotherToss:''
  };

  if (isConfigured) {
    const snap = await getDoc(doc(db, 'accounts', 'main'));
    if (snap.exists()) data = { ...data, ...snap.data() };
  }

  const groomPanel = document.getElementById('account-panel-groom');
  const bridePanel = document.getElementById('account-panel-bride');

  const groomList = [
    { side:'신랑',      holder:data.groomHolder,       bank:data.groomBank,       number:data.groomAccount,       kakaoPay:data.groomKakaoPay,       toss:data.groomToss },
    { side:'아버지',    holder:data.groomFatherHolder, bank:data.groomFatherBank, number:data.groomFatherAccount, kakaoPay:data.groomFatherKakaoPay, toss:data.groomFatherToss },
    { side:'어머니',    holder:data.groomMotherHolder, bank:data.groomMotherBank, number:data.groomMotherAccount, kakaoPay:data.groomMotherKakaoPay, toss:data.groomMotherToss },
  ];
  const brideList = [
    { side:'신부',      holder:data.brideHolder,       bank:data.brideBank,       number:data.brideAccount,       kakaoPay:data.brideKakaoPay,       toss:data.brideToss },
    { side:'아버지',    holder:data.brideFatherHolder, bank:data.brideFatherBank, number:data.brideFatherAccount, kakaoPay:data.brideFatherKakaoPay, toss:data.brideFatherToss },
    { side:'어머니',    holder:data.brideMotherHolder, bank:data.brideMotherBank, number:data.brideMotherAccount, kakaoPay:data.brideMotherKakaoPay, toss:data.brideMotherToss },
  ];

  groomList.filter(a => a.number?.trim()).forEach(a => groomPanel.appendChild(makeAccountCard(a)));
  brideList.filter(a => a.number?.trim()).forEach(a => bridePanel.appendChild(makeAccountCard(a)));
}
```

Then replace `makeAccountCard`:

```js
function makeAccountCard({ side, holder, bank, number, kakaoPay, toss }) {
  const el = document.createElement('div');
  el.className = 'account-card';
  el.innerHTML = `
    <div class="account-info">
      <div class="account-side">${escapeHtml(side)}</div>
      <div class="account-holder">${escapeHtml(holder)}</div>
      <div class="account-number">${escapeHtml(bank)} ${escapeHtml(number)}</div>
    </div>
    <div class="account-actions">
      <button class="copy-btn">복사</button>
      ${kakaoPay?.trim() ? `<a class="pay-btn pay-kakao" href="${escapeHtml(kakaoPay)}" target="_blank" rel="noopener">카카오페이</a>` : ''}
      ${toss?.trim() ? `<a class="pay-btn pay-toss" href="${escapeHtml(toss)}" target="_blank" rel="noopener">토스</a>` : ''}
    </div>
  `;
  el.querySelector('.copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(number).then(() => showToast('복사되었습니다'));
  });
  return el;
}
```

(Only the wrapping `<div class="account-actions">` around the existing `<button class="copy-btn">` and the two new conditional `<a>` tags are new — the copy button's own markup and click handler are unchanged.)

- [ ] **Step 2: Manually verify**

Using the test values you saved in Task 3 (`groomKakaoPay = https://qr.kakaopay.com/test123`, `groomToss = https://toss.me/test123`), serve the site, open `http://localhost:5173/index.html`, scroll to "ACCOUNT", and confirm:
- The 신랑 card shows THREE buttons: 복사 (existing), 카카오페이 (yellow), 토스 (blue).
- Every other card (아버지/어머니/신부 side) shows only 복사, since they have no test links set.

Then in devtools console:

```js
[...document.querySelectorAll('.pay-kakao')].map(a => a.href)
```

Expected: `["https://qr.kakaopay.com/test123"]` — confirms the link is correctly wired through, not just visually present.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: render KakaoPay/Toss buttons on guest-facing account cards"
```

---

## Plan self-review notes

- **Spec coverage:** data model (Task 3's field names), admin UI (Task 2), guest UI + brand colors (Tasks 1 and 4) all map directly to the design spec's sections. All 6 people covered, both services covered, per user decisions.
- **No test framework added:** consistent with every prior plan in this project.
- **Data hygiene:** Task 3's verification writes real test values to the production `accounts/main` document; the step includes a cleanup note. Task 4 reuses those same test values rather than writing new ones.
