import { db, auth } from './firebase.js';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
  doc, collection, getDoc, getDocs, setDoc, addDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const CLOUDINARY_CLOUD = 'drgkuhjnc';
const CLOUDINARY_PRESET = 'wedding';

// 9MB 초과 시 캔버스로 리사이즈 압축 (Cloudinary 10MB 제한 대응)
async function compressImage(file) {
  const LIMIT = 9 * 1024 * 1024;
  if (file.size <= LIMIT) return file;
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const ratio = Math.sqrt(LIMIT / file.size) * 0.9;
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('압축 실패')); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 읽기 실패')); };
      img.src = url;
    });
  } catch {
    return file; // 압축 불가 형식(HEIC 등)이면 원본 그대로 시도
  }
}

async function uploadToCloudinary(file) {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 업로드할 수 있습니다');
  if (file.size > 50 * 1024 * 1024) throw new Error('파일 크기는 50MB 이하여야 합니다');

  const uploadFile = await compressImage(file);

  const formData = new FormData();
  formData.append('file', uploadFile);
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
                  'kakaoMapUrl','transport','musicUrl','introTitle','introText'];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && d[f] != null) el.value = d[f];
  });
  if (d.heroBgUrl)   showHeroBgPreview(d.heroBgUrl);
  if (d.mapImageUrl) showMapPreview(d.mapImageUrl);
  if (d.ogImageUrl)  showOgThumbPreview(d.ogImageUrl);
}

// OG 썸네일 미리보기
function showOgThumbPreview(url) {
  document.getElementById('og-thumb-preview-img').src = url;
  document.getElementById('og-thumb-preview').style.display = 'block';
  const urlInput = document.getElementById('og-thumb-url-display');
  urlInput.value = url;
  document.getElementById('og-thumb-url-wrap').style.display = 'block';
}

document.getElementById('og-thumb-copy-btn').addEventListener('click', () => {
  const url = document.getElementById('og-thumb-url-display').value;
  navigator.clipboard.writeText(url).then(() => showToast('URL이 복사되었습니다'));
});

// OG 썸네일 업로드
document.getElementById('og-thumb-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const progress = document.getElementById('og-thumb-progress');
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
  e.target.value = '';
});

// 첫 화면 배경 미리보기
function showHeroBgPreview(url) {
  document.getElementById('hero-bg-preview-img').src = url;
  document.getElementById('hero-bg-preview').style.display = 'block';
  document.getElementById('hero-bg-upload-area').style.display = 'none';
}

// 배경 이미지 업로드
document.getElementById('hero-bg-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const progress = document.getElementById('hero-bg-progress');
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
  e.target.value = '';
});

// 배경 이미지 삭제
document.getElementById('hero-bg-delete-btn').addEventListener('click', async () => {
  if (!confirm('첫 화면 배경 이미지를 삭제할까요?')) return;
  await setDoc(doc(db, 'config', 'main'), { heroBgUrl: '' }, { merge: true });
  document.getElementById('hero-bg-preview').style.display = 'none';
  document.getElementById('hero-bg-upload-area').style.display = 'block';
  showToast('배경 이미지가 삭제되었습니다');
});

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
                  'kakaoMapUrl','transport','musicUrl','introTitle','introText'];
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
let _unsubPhotos = null;
let _photoList   = [];   // 현재 순서 (로컬)
let _orderChanged = false;
let _dragSrcIdx  = null;

function loadPhotos() {
  if (_unsubPhotos) { _unsubPhotos(); _unsubPhotos = null; }

  const q = query(collection(db, 'photos'), orderBy('order'));
  _unsubPhotos = onSnapshot(q, snap => {
    if (_orderChanged) return; // 미저장 순서 변경 중엔 덮어쓰지 않음
    _photoList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPhotoGrid();
  }, err => {
    console.error('사진 목록 오류:', err);
    const grid = document.getElementById('photo-grid');
    grid.innerHTML = '';
    const errMsg = document.createElement('p');
    errMsg.style.cssText = 'color:#c0392b;font-size:0.85rem;grid-column:1/-1;';
    errMsg.textContent = `사진 불러오기 실패: ${err.message}`;
    grid.appendChild(errMsg);
  });
}

function renderPhotoGrid() {
  const grid    = document.getElementById('photo-grid');
  const saveBtn = document.getElementById('save-photo-order-btn');
  grid.innerHTML = '';
  saveBtn.style.display = (_orderChanged && _photoList.length > 1) ? 'flex' : 'none';

  if (_photoList.length === 0) {
    const msg = document.createElement('p');
    msg.style.cssText = 'color:#8a6a76;font-size:0.85rem;grid-column:1/-1;';
    msg.textContent = '등록된 사진이 없습니다';
    grid.appendChild(msg);
    return;
  }

  _photoList.forEach((photo, idx) => {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.draggable = true;

    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.title = '드래그하여 순서 변경';

    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = '';
    img.draggable = false;

    const delBtn = document.createElement('button');
    delBtn.className = 'del-photo';
    delBtn.dataset.id = photo.id;
    delBtn.title = '삭제';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', deletePhoto);

    thumb.addEventListener('dragstart', e => {
      _dragSrcIdx = idx;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => thumb.classList.add('dragging'), 0);
    });
    thumb.addEventListener('dragover', e => {
      e.preventDefault();
      if (_dragSrcIdx !== null && _dragSrcIdx !== idx)
        thumb.classList.add('drag-over');
    });
    thumb.addEventListener('dragleave', () => thumb.classList.remove('drag-over'));
    thumb.addEventListener('drop', e => {
      e.preventDefault();
      thumb.classList.remove('drag-over');
      if (_dragSrcIdx === null || _dragSrcIdx === idx) return;
      const [moved] = _photoList.splice(_dragSrcIdx, 1);
      _photoList.splice(idx, 0, moved);
      _orderChanged = true;
      _dragSrcIdx = null;
      renderPhotoGrid();
    });
    thumb.addEventListener('dragend', () => {
      _dragSrcIdx = null;
      document.querySelectorAll('.photo-thumb').forEach(t =>
        t.classList.remove('dragging', 'drag-over'));
    });

    thumb.appendChild(handle);
    thumb.appendChild(img);
    thumb.appendChild(delBtn);
    grid.appendChild(thumb);
  });
}

document.getElementById('save-photo-order-btn').addEventListener('click', async () => {
  if (!_orderChanged || !_photoList.length) return;
  const btn = document.getElementById('save-photo-order-btn');
  btn.textContent = '저장 중...';
  btn.disabled = true;
  try {
    const batch = writeBatch(db);
    _photoList.forEach((photo, i) => {
      batch.update(doc(db, 'photos', photo.id), { order: i + 1 });
    });
    await batch.commit();
    _orderChanged = false;
    btn.style.display = 'none';
    showToast('사진 순서가 저장되었습니다 ✅');
  } catch (err) {
    console.error('순서 저장 실패:', err);
    showToast(`순서 저장 실패: ${err.message}`);
  }
  btn.textContent = '💾 순서 저장';
  btn.disabled = false;
});

document.getElementById('photo-input').addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const progressEl = document.getElementById('upload-progress');
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
      await new Promise(r => setTimeout(r, 3000)); // 오류 메시지 3초 표시
    }
  }

  if (failed === 0) {
    progressEl.style.color = '#8a6a76';
    progressEl.textContent = `${done}장 업로드 완료! ✅`;
  } else {
    progressEl.style.color = '#c0392b';
    progressEl.textContent = `${done}장 성공 / ${failed}장 실패 — 브라우저 콘솔(F12)에서 오류 확인`;
  }
  setTimeout(() => { progressEl.textContent = ''; progressEl.style.color = '#8a6a76'; }, 5000);
  e.target.value = '';
});

async function deletePhoto(e) {
  const id = e.currentTarget.dataset.id;
  if (!confirm('이 사진을 삭제할까요?')) return;
  _orderChanged = false; // 미저장 순서 초기화 후 Firestore에서 새로 로드
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
