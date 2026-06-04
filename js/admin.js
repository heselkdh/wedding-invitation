import { db, auth } from './firebase.js';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
  doc, collection, getDoc, getDocs, setDoc, addDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const CLOUDINARY_CLOUD = 'drgkuhjnc';
const CLOUDINARY_PRESET = 'wedding';

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: 'POST', body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? '업로드 실패');
  return data.secure_url;
}

// ── 로그인/로그아웃 ────────────────────────────────────────────────
document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-pw').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  try {
    await signInWithEmailAndPassword(auth, email, pw);
  } catch {
    errEl.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
    errEl.style.display = 'block';
  }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, user => {
  document.getElementById('login-screen').style.display  = user ? 'none'  : 'flex';
  document.getElementById('admin-screen').style.display  = user ? 'block' : 'none';
  if (user) initAdmin();
});

// ── 어드민 초기화 ──────────────────────────────────────────────────
function initAdmin() {
  loadInfoForm();
  loadAccountsForm();
  loadPhotos();
  loadGuestbookAdmin();
}

// ── 패널 토글 (전역 함수로 노출) ─────────────────────────────────────
window.togglePanel = function(id) {
  document.getElementById(id).classList.toggle('collapsed');
};

// ── 1. 기본 정보 ────────────────────────────────────────────────────
async function loadInfoForm() {
  const snap = await getDoc(doc(db, 'config', 'main'));
  if (!snap.exists()) return;
  const d = snap.data();
  const fields = ['groomName','brideName','groomParents','brideParents',
                  'weddingDate','weddingTime','venueName','venueAddress',
                  'kakaoMapUrl','transport'];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && d[f] != null) el.value = d[f];
  });
  if (d.mapImageUrl) showMapPreview(d.mapImageUrl);
}

// 약도 이미지 미리보기
function showMapPreview(url) {
  document.getElementById('map-preview-img').src = url;
  document.getElementById('map-image-preview').style.display = 'block';
  document.getElementById('map-upload-area').style.display = 'none';
}

// 약도 업로드
document.getElementById('map-image-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const progress = document.getElementById('map-upload-progress');
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
  e.target.value = '';
});

// 약도 삭제
document.getElementById('map-image-delete-btn').addEventListener('click', async () => {
  if (!confirm('약도 이미지를 삭제할까요?')) return;
  await setDoc(doc(db, 'config', 'main'), { mapImageUrl: '' }, { merge: true });
  document.getElementById('map-image-preview').style.display = 'none';
  document.getElementById('map-upload-area').style.display = 'block';
  showToast('약도가 삭제되었습니다');
});

document.getElementById('save-info-btn').addEventListener('click', async () => {
  const btn = document.getElementById('save-info-btn');
  btn.classList.add('saving');
  btn.textContent = '저장 중...';

  const fields = ['groomName','brideName','groomParents','brideParents',
                  'weddingDate','weddingTime','venueName','venueAddress',
                  'kakaoMapUrl','transport'];
  const data = {};
  fields.forEach(f => { data[f] = document.getElementById(f).value.trim(); });

  try {
    await setDoc(doc(db, 'config', 'main'), data, { merge: true });
    showToast('기본 정보가 저장되었습니다 ✅');
  } catch (err) {
    console.error('저장 실패:', err);
    showToast(`저장 실패: ${err.message}`);
  }

  btn.classList.remove('saving');
  btn.textContent = '저장';
});

// ── 2. 사진 관리 ────────────────────────────────────────────────────
function loadPhotos() {
  const q = query(collection(db, 'photos'), orderBy('order'));
  onSnapshot(q, snap => {
    const grid = document.getElementById('photo-grid');
    grid.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb';
      thumb.innerHTML = `
        <img src="${data.url}" alt="">
        <button class="del-photo" data-id="${d.id}" data-path="${data.storagePath}" title="삭제">×</button>
      `;
      thumb.querySelector('.del-photo').addEventListener('click', e => deletePhoto(e));
      grid.appendChild(thumb);
    });
  });
}

document.getElementById('photo-input').addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const progressEl = document.getElementById('upload-progress');
  progressEl.textContent = `0 / ${files.length} 업로드 중...`;

  const snap = await getDocs(query(collection(db, 'photos'), orderBy('order', 'desc')));
  let maxOrder = snap.empty ? 0 : (snap.docs[0].data().order ?? 0);

  let done = 0;
  for (const file of files) {
    try {
      const url = await uploadToCloudinary(file);
      await addDoc(collection(db, 'photos'), {
        url, order: ++maxOrder, createdAt: serverTimestamp()
      });
      done++;
      progressEl.textContent = `${done} / ${files.length} 업로드 완료`;
    } catch (err) {
      progressEl.textContent = `오류: ${err.message}`;
    }
  }
  progressEl.textContent = '업로드 완료! ✅';
  setTimeout(() => { progressEl.textContent = ''; }, 3000);
  e.target.value = '';
});

async function deletePhoto(e) {
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  if (!confirm('이 사진을 삭제할까요?')) return;
  await deleteDoc(doc(db, 'photos', id));
  showToast('사진이 삭제되었습니다');
}

// ── 3. 계좌번호 ────────────────────────────────────────────────────
async function loadAccountsForm() {
  const snap = await getDoc(doc(db, 'accounts', 'main'));
  if (!snap.exists()) return;
  const d = snap.data();
  const fields = ['groomBank','groomHolder','groomAccount',
                  'groomFatherBank','groomFatherHolder','groomFatherAccount',
                  'groomMotherBank','groomMotherHolder','groomMotherAccount',
                  'brideBank','brideHolder','brideAccount',
                  'brideFatherBank','brideFatherHolder','brideFatherAccount',
                  'brideMotherBank','brideMotherHolder','brideMotherAccount'];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && d[f] != null) el.value = d[f];
  });
}

document.getElementById('save-accounts-btn').addEventListener('click', async () => {
  const btn = document.getElementById('save-accounts-btn');
  btn.classList.add('saving');
  btn.textContent = '저장 중...';

  const fields = ['groomBank','groomHolder','groomAccount',
                  'groomFatherBank','groomFatherHolder','groomFatherAccount',
                  'groomMotherBank','groomMotherHolder','groomMotherAccount',
                  'brideBank','brideHolder','brideAccount',
                  'brideFatherBank','brideFatherHolder','brideFatherAccount',
                  'brideMotherBank','brideMotherHolder','brideMotherAccount'];
  const data = {};
  fields.forEach(f => { data[f] = document.getElementById(f).value.trim(); });

  try {
    await setDoc(doc(db, 'accounts', 'main'), data, { merge: true });
    showToast('계좌번호가 저장되었습니다 ✅');
  } catch (err) {
    console.error('저장 실패:', err);
    showToast(`저장 실패: ${err.message}`);
  }

  btn.classList.remove('saving');
  btn.textContent = '저장';
});

// ── 4. 방명록 관리 ─────────────────────────────────────────────────
function loadGuestbookAdmin() {
  const q = query(collection(db, 'guestbook'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    const list = document.getElementById('guestbook-admin-list');
    if (snap.empty) {
      list.innerHTML = '<p style="color:#8a6a76;font-size:0.85rem;">등록된 방명록이 없습니다.</p>';
      return;
    }
    list.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const ts = data.createdAt?.toDate();
      const dateStr = ts
        ? `${ts.getFullYear()}.${String(ts.getMonth()+1).padStart(2,'0')}.${String(ts.getDate()).padStart(2,'0')}`
        : '';
      const row = document.createElement('div');
      row.className = 'gb-row';
      row.innerHTML = `
        <div class="gb-row-content">
          <div class="gb-row-name">🌸 ${escapeHtml(data.name)}</div>
          <div class="gb-row-text">${escapeHtml(data.message)}</div>
          <div class="gb-row-date">${dateStr}</div>
        </div>
        <button class="btn btn-danger del-gb-btn" data-id="${d.id}">삭제</button>
      `;
      row.querySelector('.del-gb-btn').addEventListener('click', async e => {
        if (!confirm('이 메시지를 삭제할까요?')) return;
        await deleteDoc(doc(db, 'guestbook', e.currentTarget.dataset.id));
        showToast('메시지가 삭제되었습니다');
      });
      list.appendChild(row);
    });
  });
}

// ── 토스트 ──────────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
