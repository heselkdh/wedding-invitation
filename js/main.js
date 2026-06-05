import { db, isConfigured } from './firebase.js';
import {
  doc, collection, getDoc, getDocs, addDoc, onSnapshot,
  serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// ── 기본 샘플 데이터 (Firebase 미연동 시 표시) ──────────────────────
const SAMPLE = {
  groomName: '박준혁', brideName: '김지수',
  groomParents: '아버지 박○○,어머니 이○○',
  brideParents:  '아버지 김○○,어머니 최○○',
  weddingDate: '2025-06-28', weddingTime: '오후 2시 30분',
  venueName: '그랜드 웨딩홀 3층 로즈홀',
  venueAddress: '서울시 강남구 테헤란로 123',
  kakaoMapUrl: '#',
  transport: `<h4>🚇 지하철</h4><p>2호선 강남역 3번 출구 도보 5분</p>
<h4>🚌 버스</h4><p>146, 360, 740번 강남역 하차</p>
<h4>🚗 자가용</h4><p>건물 지하 주차장 2시간 무료</p>`
};

// ── Firestore 또는 샘플 데이터 로드 ───────────────────────────────
async function loadConfig() {
  let d = SAMPLE;

  if (isConfigured) {
    const snap = await getDoc(doc(db, 'config', 'main'));
    if (snap.exists()) d = { ...SAMPLE, ...snap.data() };
  }

  document.getElementById('hero-groom').textContent       = d.groomName;
  document.getElementById('hero-bride').textContent       = d.brideName;
  document.getElementById('hero-venue-short').textContent = d.venueName;
  document.getElementById('groom-name').textContent       = d.groomName;
  document.getElementById('bride-name').textContent       = d.brideName;
  document.getElementById('groom-parents').innerHTML      = d.groomParents.replace(/,/g, '<br>');
  document.getElementById('bride-parents').innerHTML      = d.brideParents.replace(/,/g, '<br>');

  const dateStr = formatDate(d.weddingDate);
  document.getElementById('hero-date').textContent  = dateStr;
  document.getElementById('dt-date').textContent    = dateStr;
  document.getElementById('dt-time').textContent    = d.weddingTime;
  document.getElementById('venue-name').textContent = d.venueName;
  document.getElementById('venue-address').textContent = d.venueAddress;

  document.title = `${d.groomName} ♥ ${d.brideName} 결혼합니다`;
  setMeta('og:title',       `${d.groomName} ♥ ${d.brideName} 결혼합니다`);
  setMeta('og:description', `${dateStr} ${d.venueName}`);

  const mapBtn = document.getElementById('kakao-map-btn');
  if (d.kakaoMapUrl && d.kakaoMapUrl !== '#') mapBtn.href = d.kakaoMapUrl;

  if (d.mapImageUrl) {
    document.getElementById('map-image').src = d.mapImageUrl;
    document.getElementById('map-image-wrap').style.display = 'block';
  }

  document.getElementById('transport-info').innerHTML = d.transport || '';

  startCountdown(d.weddingDate, d.weddingTime);
}

function formatDate(dateStr) {
  const dt   = new Date(dateStr);
  const days = ['일','월','화','수','목','금','토'];
  return `${dt.getFullYear()}년 ${dt.getMonth()+1}월 ${dt.getDate()}일 ${days[dt.getDay()]}요일`;
}

function setMeta(property, content) {
  const el = document.querySelector(`meta[property="${property}"]`);
  if (el) el.setAttribute('content', content);
}

// ── 카운트다운 ──────────────────────────────────────────────────────
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

  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      ['days','hours','mins','secs'].forEach(u =>
        (document.getElementById(`cd-${u}`).textContent = '0'));
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
  setInterval(tick, 1000);
}

// ── 갤러리 ─────────────────────────────────────────────────────────
const CAT_PHOTOS = [
  'assets/photos/cat1.jpg','assets/photos/cat2.jpg','assets/photos/cat3.jpg',
  'assets/photos/cat4.jpg','assets/photos/cat5.jpg','assets/photos/cat6.jpg',
];

async function loadGallery() {
  const grid = document.getElementById('gallery-grid');

  if (!isConfigured) {
    CAT_PHOTOS.forEach(src => appendPhoto(grid, src));
    return;
  }

  const snap = await getDocs(query(collection(db, 'photos'), orderBy('order')));
  if (snap.empty) {
    CAT_PHOTOS.forEach(src => appendPhoto(grid, src));
    return;
  }
  snap.forEach(d => appendPhoto(grid, d.data().url));
}

function appendPhoto(grid, src) {
  const item = document.createElement('div');
  item.className = 'gallery-item';
  const img = document.createElement('img');
  img.src = src; img.alt = '웨딩 사진'; img.loading = 'lazy';
  item.appendChild(img);
  item.addEventListener('click', () => openLightbox(src));
  grid.appendChild(item);
}

// ── Lightbox ────────────────────────────────────────────────────────
function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeLightbox();
});

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

// ── 방명록 ─────────────────────────────────────────────────────────
function loadGuestbook() {
  if (!isConfigured) {
    document.getElementById('guestbook-list').innerHTML =
      '<p style="text-align:center;color:#b08898;font-size:0.85rem;">Firebase 연동 후 방명록을 사용할 수 있습니다 🌸</p>';
    document.getElementById('gb-submit').disabled = true;
    return;
  }

  const q = query(collection(db, 'guestbook'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
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

document.getElementById('gb-submit').addEventListener('click', async () => {
  if (!isConfigured) return;
  const name    = document.getElementById('gb-name').value.trim();
  const message = document.getElementById('gb-message').value.trim();
  if (!name || !message) { showToast('이름과 메시지를 입력해주세요'); return; }
  await addDoc(collection(db, 'guestbook'), { name, message, createdAt: serverTimestamp() });
  document.getElementById('gb-name').value    = '';
  document.getElementById('gb-message').value = '';
  showToast('메시지가 등록되었습니다 🌸');
});

// ── 계좌번호 ────────────────────────────────────────────────────────
async function loadAccounts() {
  let data = {
    groomHolder:'', groomBank:'', groomAccount:'',
    groomFatherHolder:'', groomFatherBank:'', groomFatherAccount:'',
    groomMotherHolder:'', groomMotherBank:'', groomMotherAccount:'',
    brideHolder:'', brideBank:'', brideAccount:'',
    brideFatherHolder:'', brideFatherBank:'', brideFatherAccount:'',
    brideMotherHolder:'', brideMotherBank:'', brideMotherAccount:''
  };

  if (isConfigured) {
    const snap = await getDoc(doc(db, 'accounts', 'main'));
    if (snap.exists()) data = { ...data, ...snap.data() };
  }

  const groomPanel = document.getElementById('account-panel-groom');
  const bridePanel = document.getElementById('account-panel-bride');

  const groomList = [
    { side:'신랑',      holder:data.groomHolder,       bank:data.groomBank,       number:data.groomAccount },
    { side:'아버지',    holder:data.groomFatherHolder, bank:data.groomFatherBank, number:data.groomFatherAccount },
    { side:'어머니',    holder:data.groomMotherHolder, bank:data.groomMotherBank, number:data.groomMotherAccount },
  ];
  const brideList = [
    { side:'신부',      holder:data.brideHolder,       bank:data.brideBank,       number:data.brideAccount },
    { side:'아버지',    holder:data.brideFatherHolder, bank:data.brideFatherBank, number:data.brideFatherAccount },
    { side:'어머니',    holder:data.brideMotherHolder, bank:data.brideMotherBank, number:data.brideMotherAccount },
  ];

  groomList.filter(a => a.number?.trim()).forEach(a => groomPanel.appendChild(makeAccountCard(a)));
  brideList.filter(a => a.number?.trim()).forEach(a => bridePanel.appendChild(makeAccountCard(a)));
}

function makeAccountCard({ side, holder, bank, number }) {
  const el = document.createElement('div');
  el.className = 'account-card';
  el.innerHTML = `
    <div class="account-info">
      <div class="account-side">${side}</div>
      <div class="account-holder">${holder}</div>
      <div class="account-number">${bank} ${number}</div>
    </div>
    <button class="copy-btn">복사</button>
  `;
  el.querySelector('.copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(number).then(() => showToast('복사되었습니다'));
  });
  return el;
}

// ── 패럴랙스 ────────────────────────────────────────────────────────
function initParallax() {
  const heroBg = document.getElementById('hero-bg');
  window.addEventListener('scroll', () => {
    heroBg.style.transform = `translateY(${window.scrollY * 0.4}px)`;
  }, { passive: true });
}

// ── 스크롤 페이드인 ─────────────────────────────────────────────────
function initFadeIn() {
  const observer = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    }),
    { threshold: 0.15 }
  );
  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
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

// ── 초기화 ──────────────────────────────────────────────────────────
initParallax();
initFadeIn();
loadConfig();
loadGallery();
loadGuestbook();
loadAccounts();
