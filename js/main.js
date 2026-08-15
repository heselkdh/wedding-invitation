import { db, isConfigured } from './firebase.js';
import { sanitizeHtml } from './sanitize.js';
import { SITE_URL } from './site-config.js';
import QRCode from 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm';

// ▼ Kakao Developers(https://developers.kakao.com)에서 발급한 JavaScript 키로 교체
const KAKAO_JS_KEY = '9cc67862123c23921bcde33c45851b3a';
import {
  doc, collection, getDoc, addDoc, onSnapshot,
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

const SAMPLE_NOTICES = [
  { title: '화환 안내', text: '축하하는 마음만으로 감사히 받겠습니다.', imageUrl: '' },
  { title: '식사 안내', text: '예식 후 같은 건물 내 연회장에서 식사가 준비되어 있습니다.', imageUrl: '' },
  { title: '피로연 안내', text: '예식 후 2층 연회장에서 피로연이 진행됩니다.', imageUrl: '' },
  { title: '포토부스 안내', text: '로비에 마련된 포토부스에서 추억을 남겨보세요.', imageUrl: '' },
];

// ── Firestore 또는 샘플 데이터 로드 ───────────────────────────────
async function loadConfig() {
  let d = SAMPLE;

  if (isConfigured) {
    const snap = await getDoc(doc(db, 'config', 'main'));
    if (snap.exists()) d = { ...SAMPLE, ...snap.data() };
  }

  document.getElementById('hero-groom').textContent       = d.groomName;
  document.getElementById('hero-bride').textContent       = d.brideName;
  renderParentsLine('groom-parents-line', 'groom-contact-dropdown', d.groomParents, d.groomName, '아들', 'son', d.groomPhone, d.groomFatherPhone, d.groomMotherPhone, '신랑측', '신랑');
  renderParentsLine('bride-parents-line', 'bride-contact-dropdown', d.brideParents, d.brideName, '딸', 'daughter', d.bridePhone, d.brideFatherPhone, d.brideMotherPhone, '신부측', '신부');

  const dateStr = formatDate(d.weddingDate);
  setOpeningText(d, dateStr);
  const dow = ['일','월','화','수','목','금','토'][new Date(d.weddingDate).getDay()] + '요일';
  document.getElementById('dt-date').textContent    = formatDateNumeric(d.weddingDate);
  document.getElementById('dt-time').textContent    = `${dow} ${(d.weddingTime || '').replace(/^(오전|오후)/, '낮')}`;
  document.getElementById('venue-name').textContent = d.venueName;
  const addrLines = (d.venueAddress || '').split(/\n|\s{2,}/).map(s => s.trim()).filter(Boolean);
  document.getElementById('venue-address').innerHTML = addrLines.map(escapeHtml).join('<br>');
  document.getElementById('cd-couple-names').textContent = `${d.groomName}, ${d.brideName}`;

  document.title = `${d.groomName} ♥ ${d.brideName} 결혼합니다`;
  setMeta('og:title',       `${d.groomName} ♥ ${d.brideName} 결혼합니다`);
  setMeta('og:description', `${dateStr} ${d.weddingTime} · ${d.venueName}`);
  const ogImg = d.ogImageUrl || d.heroBgUrl;
  if (ogImg) setMeta('og:image', ogImg);

  const mapBtn = document.getElementById('kakao-map-btn');
  if (d.kakaoMapUrl && d.kakaoMapUrl !== '#') mapBtn.href = d.kakaoMapUrl;

  const naverMapBtn = document.getElementById('naver-map-btn');
  if (d.naverMapUrl) {
    naverMapBtn.href = d.naverMapUrl;
    naverMapBtn.style.display = 'inline-flex';
  }

  if (d.heroBgUrl) {
    document.getElementById('hero-bg').src = d.heroBgUrl;
  }

  if (d.mapImageUrl) {
    document.getElementById('map-image').src = d.mapImageUrl;
    document.getElementById('map-image-wrap').style.display = 'block';
  }

  document.getElementById('transport-info').innerHTML = sanitizeHtml(d.transport || '');

  // 인트로 섹션 (기본 인사말 제공, 미설정 시에도 항상 표시)
  const introSec = document.getElementById('intro');
  document.getElementById('intro-title').textContent = d.introTitle ||
    '초대합니다';
  document.getElementById('intro-text').textContent = d.introText ||
    '저희 두 사람이 사랑의 결실을 맺어\n새로운 가정을 이루게 되었습니다.\n귀한 걸음 하시어 축복해 주시면 감사하겠습니다.';
  introSec.style.display = 'block';

  startCountdown(d.weddingDate, d.weddingTime);
  renderMiniCalendar(d.weddingDate);

  if (d.musicFileUrl) initMusicFile(d.musicFileUrl);
  else if (d.musicUrl) initMusic(d.musicUrl);
  initShareSheet(d);
}

// ── 음악 (YouTube IFrame API) ────────────────────────────────────────
function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const MUSIC_ICON_ON  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const MUSIC_ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9l5 5M21 9l-5 5"/></svg>';

function initMusic(url) {
  const videoId = extractVideoId(url);
  if (!videoId) return;

  const btn = document.getElementById('nav-music-btn');
  btn.style.display = 'flex';
  document.getElementById('nav-music-divider').style.display = 'block';

  let player        = null;
  let muted         = true;
  let interacted    = false;
  let pendingUnmute = false;

  function updateUI() {
    btn.innerHTML = muted ? MUSIC_ICON_OFF : MUSIC_ICON_ON;
    btn.classList.toggle('muted', muted);
  }
  updateUI();

  // 플레이어가 아직 준비되지 않았어도 의사를 기억해뒀다가 onReady에서 반영
  function unmuteAndPlay() {
    muted = false;
    interacted = true;
    if (player) {
      player.unMute();
      player.playVideo();
    } else {
      pendingUnmute = true;
    }
    updateUI();
  }

  // 첫 인터랙션 시 자동 음소거 해제 (브라우저 자동재생 정책 우회)
  function onFirstInteraction() {
    if (interacted) return;
    unmuteAndPlay();
  }
  ['click','touchstart','scroll'].forEach(evt =>
    document.addEventListener(evt, onFirstInteraction, { once: true, passive: true })
  );

  function createPlayer() {
    player = new window.YT.Player('yt-player', {
      videoId,
      playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: videoId, playsinline: 1 },
      events: {
        onReady: e => {
          e.target.mute();   // autoplay 허용을 위해 일시 음소거, 인터랙션 시 해제됨
          e.target.playVideo();
          if (pendingUnmute) {
            pendingUnmute = false;
            e.target.unMute();
          }
        }
      }
    });
  }

  if (window.YT && window.YT.Player) {
    createPlayer();
  } else {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      createPlayer();
    };
  }

  btn.addEventListener('click', () => {
    interacted = true;
    if (muted) {
      unmuteAndPlay();
    } else {
      muted = true;
      if (player) player.mute();
      updateUI();
    }
  });
}

// ── 음악 (업로드한 파일) ─────────────────────────────────────────────
function initMusicFile(url) {
  const btn = document.getElementById('nav-music-btn');
  btn.style.display = 'flex';
  document.getElementById('nav-music-divider').style.display = 'block';

  const audio = document.getElementById('bgm-audio');
  audio.src = url;
  audio.muted = true;
  audio.play().catch(() => {});

  let muted = true;
  let interacted = false;

  function updateUI() {
    btn.innerHTML = muted ? MUSIC_ICON_OFF : MUSIC_ICON_ON;
    btn.classList.toggle('muted', muted);
  }
  updateUI();

  function unmuteAndPlay() {
    muted = false;
    interacted = true;
    audio.muted = false;
    audio.play().catch(() => {});
    updateUI();
  }

  function onFirstInteraction() {
    if (interacted) return;
    unmuteAndPlay();
  }
  ['click','touchstart','scroll'].forEach(evt =>
    document.addEventListener(evt, onFirstInteraction, { once: true, passive: true })
  );

  btn.addEventListener('click', () => {
    interacted = true;
    if (muted) {
      unmuteAndPlay();
    } else {
      muted = true;
      audio.muted = true;
      updateUI();
    }
  });
}

function renderParentsLine(elId, dropdownId, parentsStr, childName, relation, relationClass, phone, fatherPhone, motherPhone, side, childLabel) {
  const el = document.getElementById(elId);
  el.textContent = '';

  // 관례상 첫 항목은 아버지, 두 번째 항목은 어머니로 취급 (관리자 placeholder와 동일한 순서)
  const parts = (parentsStr || '').split(',').map(s => s.trim()).filter(Boolean);
  const parentPhones = [fatherPhone, motherPhone];
  const parentLabels = [`${side} 아버지`, `${side} 어머니`];
  const contacts = [];

  parts.forEach((part, i) => {
    const name = part.replace(/^(아버지|어머니)\s*/, '');
    if (i > 0) el.appendChild(document.createTextNode(' · '));
    el.appendChild(document.createTextNode(name));
    if (parentPhones[i]) contacts.push({ name: `${parentLabels[i]} ${name}`, phone: parentPhones[i] });
  });

  el.appendChild(document.createTextNode(' '));
  const relSpan = document.createElement('span');
  relSpan.className = `relation-word ${relationClass}`;
  relSpan.textContent = `의 ${relation}`;
  el.appendChild(relSpan);
  el.appendChild(document.createTextNode(` ${childName}`));
  if (phone) contacts.push({ name: `${childLabel} ${childName}`, phone });

  if (contacts.length) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'parents-contact';
    btn.setAttribute('aria-label', '연락처 보기');
    btn.innerHTML = '<span class="parents-contact-icon">📞</span>연락하기';
    btn.addEventListener('click', () => toggleContactDropdown(dropdownId, contacts));
    el.appendChild(btn);
  }
}

// ── 연락처 드롭다운 ──────────────────────────────────────────────────
function toggleContactDropdown(dropdownId, contacts) {
  const dropdown = document.getElementById(dropdownId);
  if (dropdown.classList.contains('open')) {
    dropdown.classList.remove('open');
    return;
  }

  dropdown.innerHTML = '';
  contacts.forEach(({ name, phone }) => {
    const row = document.createElement('div');
    row.className = 'contact-row';
    row.innerHTML = `
      <div class="contact-row-info">
        <span class="contact-row-name">${escapeHtml(name)}</span>
        <span class="contact-row-phone">${escapeHtml(phone)}</span>
      </div>
      <div class="contact-row-actions">
        <a class="contact-action-btn" href="tel:${escapeHtml(phone)}">📞 전화</a>
        <a class="contact-action-btn" href="sms:${escapeHtml(phone)}">💬 문자</a>
      </div>
    `;
    dropdown.appendChild(row);
  });
  dropdown.classList.add('open');
}

function formatDate(dateStr) {
  const dt   = new Date(dateStr);
  const days = ['일','월','화','수','목','금','토'];
  return `${dt.getFullYear()}년 ${dt.getMonth()+1}월 ${dt.getDate()}일 ${days[dt.getDay()]}요일`;
}

function formatDateNumeric(dateStr) {
  const dt = new Date(dateStr);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}.${mm}.${dd}`;
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

  let intervalId = null;

  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      ['days','hours','mins','secs'].forEach(u =>
        (document.getElementById(`cd-${u}`).textContent = '0'));
      document.getElementById('cd-dday').textContent = 'D-DAY';
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
    document.getElementById('cd-dday').textContent  = `${Math.ceil(diff / 86400000)}일`;
  }
  tick();
  intervalId = setInterval(tick, 1000);
}

// ── 미니 달력 ────────────────────────────────────────────────────────
// 2026년 대한민국 공휴일 + 대체공휴일 (출처: publicholidays.co.kr)
const KR_HOLIDAYS_2026 = new Set([
  '2026-01-01', // 신정
  '2026-02-16', '2026-02-17', '2026-02-18', // 설날 연휴
  '2026-03-01', '2026-03-02', // 삼일절 + 대체공휴일
  '2026-05-05', // 어린이날
  '2026-05-24', '2026-05-25', // 부처님오신날 + 대체공휴일
  '2026-06-06', // 현충일
  '2026-07-17', // 제헌절
  '2026-08-15', '2026-08-17', // 광복절 + 대체공휴일
  '2026-09-24', '2026-09-25', '2026-09-26', // 추석 연휴
  '2026-10-03', '2026-10-05', // 개천절 + 대체공휴일
  '2026-10-09', // 한글날
  '2026-12-25', // 크리스마스
]);

function renderMiniCalendar(dateStr) {
  const el = document.getElementById('mini-calendar');
  if (!el) return;

  const target     = new Date(dateStr);
  const year       = target.getFullYear();
  const month      = target.getMonth();
  const targetDate = target.getDate();

  const firstDay     = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const dayLabels    = ['일','월','화','수','목','금','토'];

  let html = `<div class="mini-cal-grid">`;
  dayLabels.forEach((d, i) => {
    html += `<div class="mini-cal-day-label${i === 0 ? ' sunday' : ''}">${d}</div>`;
  });
  for (let i = 0; i < firstDay; i++) html += `<div class="mini-cal-cell"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month, day).getDay();
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isHoliday = dow === 0 || KR_HOLIDAYS_2026.has(dateKey);
    const isTarget  = day === targetDate;
    html += `<div class="mini-cal-cell${isHoliday ? ' holiday' : ''}${isTarget ? ' target' : ''}">${day}</div>`;
  }
  html += `</div>`;

  el.innerHTML = html;
}

// ── 갤러리 ─────────────────────────────────────────────────────────
const CAT_PHOTOS = [
  'assets/photos/cat1.jpg','assets/photos/cat2.jpg','assets/photos/cat3.jpg',
  'assets/photos/cat4.jpg','assets/photos/cat5.jpg','assets/photos/cat6.jpg',
];

let _galleryPhotos = [];
let _galleryIndex = 0;
let _lightboxIndex = 0;

function loadGallery() {
  const thumbs = document.getElementById('gallery-thumbs');

  if (!isConfigured) {
    _galleryPhotos = CAT_PHOTOS.slice();
    renderGalleryThumbs();
    showGalleryPhoto(0, false);
    return;
  }

  onSnapshot(query(collection(db, 'photos'), orderBy('order')), snap => {
    _galleryPhotos = snap.empty ? CAT_PHOTOS.slice() : snap.docs.map(d => d.data().url);
    renderGalleryThumbs();
    showGalleryPhoto(0, false);
  });
}

function renderGalleryThumbs() {
  const thumbs = document.getElementById('gallery-thumbs');
  thumbs.innerHTML = '';
  _galleryPhotos.forEach((src, idx) => {
    const thumb = document.createElement('div');
    thumb.className = 'gallery-thumb';
    const img = document.createElement('img');
    img.src = src; img.alt = '웨딩 사진'; img.loading = 'lazy';
    thumb.appendChild(img);
    thumb.addEventListener('click', () => showGalleryPhoto(idx));
    thumbs.appendChild(thumb);
  });
}

function showGalleryPhoto(idx, scrollThumb = true) {
  if (!_galleryPhotos.length) return;
  _galleryIndex = (idx + _galleryPhotos.length) % _galleryPhotos.length;
  document.getElementById('gallery-main-img').src = _galleryPhotos[_galleryIndex];

  document.querySelectorAll('.gallery-thumb').forEach((el, i) => {
    el.classList.toggle('active', i === _galleryIndex);
  });
  if (scrollThumb) {
    const activeThumb = document.querySelectorAll('.gallery-thumb')[_galleryIndex];
    if (activeThumb) activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

document.getElementById('gallery-prev').addEventListener('click', () => showGalleryPhoto(_galleryIndex - 1));
document.getElementById('gallery-next').addEventListener('click', () => showGalleryPhoto(_galleryIndex + 1));
document.getElementById('gallery-main-img').addEventListener('click', () => openLightbox(_galleryIndex));

// ── 스와이프 제스처 ────────────────────────────────────────────────
function addSwipeHandler(el, onSwipeLeft, onSwipeRight) {
  let startX = 0, startY = 0, tracking = false;
  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) onSwipeLeft(); else onSwipeRight();
    }
  }, { passive: true });
}

addSwipeHandler(
  document.querySelector('.gallery-main'),
  () => showGalleryPhoto(_galleryIndex + 1),
  () => showGalleryPhoto(_galleryIndex - 1)
);

// ── Lightbox ────────────────────────────────────────────────────────
function openLightbox(idx) {
  _lightboxIndex = idx;
  document.getElementById('lightbox-img').src = _galleryPhotos[idx];
  document.getElementById('lightbox-prev').style.display = '';
  document.getElementById('lightbox-next').style.display = '';
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

// 갤러리 배열과 무관한 단일 이미지(예: 안내사항 카드 사진)를 전체화면으로 보여줄 때 사용
function openLightboxSingle(url) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox-prev').style.display = 'none';
  document.getElementById('lightbox-next').style.display = 'none';
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function showLightboxPhoto(idx) {
  _lightboxIndex = (idx + _galleryPhotos.length) % _galleryPhotos.length;
  document.getElementById('lightbox-img').src = _galleryPhotos[_lightboxIndex];
}

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox-prev').addEventListener('click', () => showLightboxPhoto(_lightboxIndex - 1));
document.getElementById('lightbox-next').addEventListener('click', () => showLightboxPhoto(_lightboxIndex + 1));
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeLightbox();
});

addSwipeHandler(
  document.getElementById('lightbox-img'),
  () => { if (document.getElementById('lightbox-next').style.display !== 'none') showLightboxPhoto(_lightboxIndex + 1); },
  () => { if (document.getElementById('lightbox-prev').style.display !== 'none') showLightboxPhoto(_lightboxIndex - 1); }
);

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

// ── 만남 스토리 ────────────────────────────────────────────────────
function loadTimeline() {
  const section = document.getElementById('timeline');
  const list    = document.getElementById('timeline-list');
  if (!isConfigured) return;

  onSnapshot(query(collection(db, 'timeline'), orderBy('order')), snap => {
    list.innerHTML = '';
    if (snap.empty) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    snap.forEach(d => list.appendChild(makeTimelineItem(d.data())));
  });
}

function makeTimelineItem({ date, title, text, imageUrl }) {
  const el = document.createElement('div');
  el.className = 'timeline-item';
  el.innerHTML = `
    <div class="timeline-date">${escapeHtml(date || '')}</div>
    <div class="timeline-title">${escapeHtml(title || '')}</div>
    <div class="timeline-text">${escapeHtml(text || '')}</div>
    ${imageUrl ? `<img class="timeline-photo" src="${escapeHtml(imageUrl)}" alt="">` : ''}
  `;
  return el;
}

// ── 예식정보 및 안내사항 ───────────────────────────────────────────
function loadNotices() {
  const cards = document.getElementById('notice-cards');

  if (!isConfigured) {
    SAMPLE_NOTICES.forEach(n => cards.appendChild(makeNoticeCard(n)));
    return;
  }

  onSnapshot(query(collection(db, 'notices'), orderBy('order')), snap => {
    cards.innerHTML = '';
    if (snap.empty) {
      SAMPLE_NOTICES.forEach(n => cards.appendChild(makeNoticeCard(n)));
    } else {
      snap.forEach(d => cards.appendChild(makeNoticeCard(d.data())));
    }
  }, err => console.error('안내사항 로드 오류:', err));
}

function makeNoticeCard({ title, text, imageUrl }) {
  const el = document.createElement('div');
  el.className = 'notice-card';
  el.innerHTML = `
    ${imageUrl ? `<img class="notice-card-img" src="${escapeHtml(imageUrl)}" alt="">` : ''}
    <div class="notice-card-title">${escapeHtml(title || '')} 〉</div>
    <div class="notice-card-text">${escapeHtml(text || '')}</div>
  `;
  if (imageUrl) {
    el.querySelector('.notice-card-img').addEventListener('click', () => openLightboxSingle(imageUrl));
  }
  return el;
}

function scrollNoticeBy(direction) {
  const container = document.getElementById('notice-cards');
  const cards = [...container.children];
  if (!cards.length) return;
  const currentIndex = cards.findIndex(c => c.offsetLeft - 32 >= container.scrollLeft - 20);
  const fromIndex = currentIndex === -1 ? cards.length - 1 : currentIndex;
  const targetIndex = Math.min(Math.max(fromIndex + direction, 0), cards.length - 1);
  container.scrollTo({ left: cards[targetIndex].offsetLeft - 32, behavior: 'smooth' });
}
document.getElementById('notice-prev').addEventListener('click', () => scrollNoticeBy(-1));
document.getElementById('notice-next').addEventListener('click', () => scrollNoticeBy(1));

// ── 방명록 ─────────────────────────────────────────────────────────
let _unsubGuestbook = null;
let _guestbookMessages = [];
let _guestbookPage = 0;
const GUESTBOOK_PAGE_SIZE = 3;

function loadGuestbook() {
  if (!isConfigured) {
    document.getElementById('guestbook-list').innerHTML =
      '<p class="gb-empty-note">Firebase 연동 후 방명록을 사용할 수 있습니다</p>';
    document.getElementById('gb-submit').disabled = true;
    return;
  }

  const q = query(collection(db, 'guestbook'), orderBy('createdAt', 'desc'));
  _unsubGuestbook = onSnapshot(q, snap => {
    _guestbookMessages = snap.docs.map(d => d.data());
    if (_guestbookPage > 0 && _guestbookPage * GUESTBOOK_PAGE_SIZE >= _guestbookMessages.length) {
      _guestbookPage = 0;
    }
    renderGuestbookPage();
  });
}

function renderGuestbookPage() {
  const list = document.getElementById('guestbook-list');
  const pagination = document.getElementById('guestbook-pagination');
  const start = _guestbookPage * GUESTBOOK_PAGE_SIZE;
  const pageItems = _guestbookMessages.slice(start, start + GUESTBOOK_PAGE_SIZE);

  list.innerHTML = '';
  pageItems.forEach(data => {
    const ts = data.createdAt?.toDate();
    const dateStr = ts
      ? `${ts.getFullYear()}.${String(ts.getMonth()+1).padStart(2,'0')}.${String(ts.getDate()).padStart(2,'0')}`
      : '';
    const el = document.createElement('div');
    el.className = 'guestbook-msg';
    el.innerHTML = `
      <div class="guestbook-msg-name">${escapeHtml(data.name)}</div>
      <div class="guestbook-msg-text">${escapeHtml(data.message)}</div>
      <div class="guestbook-msg-date">${dateStr}</div>
    `;
    list.appendChild(el);
  });

  const totalPages = Math.ceil(_guestbookMessages.length / GUESTBOOK_PAGE_SIZE);
  if (totalPages > 1) {
    pagination.style.display = 'flex';
    document.getElementById('gb-page-info').textContent = `${_guestbookPage + 1} / ${totalPages}`;
    document.getElementById('gb-prev-page').disabled = _guestbookPage === 0;
    document.getElementById('gb-next-page').disabled = _guestbookPage >= totalPages - 1;
  } else {
    pagination.style.display = 'none';
  }
}

document.getElementById('gb-prev-page').addEventListener('click', () => {
  if (_guestbookPage > 0) { _guestbookPage--; renderGuestbookPage(); }
});
document.getElementById('gb-next-page').addEventListener('click', () => {
  const totalPages = Math.ceil(_guestbookMessages.length / GUESTBOOK_PAGE_SIZE);
  if (_guestbookPage < totalPages - 1) { _guestbookPage++; renderGuestbookPage(); }
});

window.addEventListener('pagehide', () => {
  if (_unsubGuestbook) { _unsubGuestbook(); _unsubGuestbook = null; }
});

const GB_COOLDOWN_MS = 60 * 1000;

let gbSubmitting = false;
document.getElementById('gb-submit').addEventListener('click', async () => {
  if (!isConfigured || gbSubmitting) return;

  const honeypot = document.getElementById('gb-website').value;
  const name     = document.getElementById('gb-name').value.trim();
  const message  = document.getElementById('gb-message').value.trim();
  if (!name || !message) { showToast('이름과 메시지를 입력해주세요'); return; }

  if (honeypot) {
    // 봇이 숨겨진 필드를 채운 경우 — Firestore에 쓰지 않고 성공한 것처럼 보이게 함
    document.getElementById('gb-name').value    = '';
    document.getElementById('gb-message').value = '';
    showToast('메시지가 등록되었습니다');
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
    showToast('메시지가 등록되었습니다');
  } catch {
    showToast('등록에 실패했습니다. 다시 시도해주세요');
  } finally {
    gbSubmitting = false;
    btn.disabled = false;
  }
});

// ── 계좌번호 ────────────────────────────────────────────────────────
document.querySelectorAll('.account-group-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    target.classList.toggle('collapsed', expanded);
  });
});

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
    { side:'신랑',        holder:data.groomHolder,       bank:data.groomBank,       number:data.groomAccount,       kakaoPay:data.groomKakaoPay,       toss:data.groomToss },
    { side:'신랑측 아버지', holder:data.groomFatherHolder, bank:data.groomFatherBank, number:data.groomFatherAccount, kakaoPay:data.groomFatherKakaoPay, toss:data.groomFatherToss },
    { side:'신랑측 어머니', holder:data.groomMotherHolder, bank:data.groomMotherBank, number:data.groomMotherAccount, kakaoPay:data.groomMotherKakaoPay, toss:data.groomMotherToss },
  ];
  const brideList = [
    { side:'신부',        holder:data.brideHolder,       bank:data.brideBank,       number:data.brideAccount,       kakaoPay:data.brideKakaoPay,       toss:data.brideToss },
    { side:'신부측 아버지', holder:data.brideFatherHolder, bank:data.brideFatherBank, number:data.brideFatherAccount, kakaoPay:data.brideFatherKakaoPay, toss:data.brideFatherToss },
    { side:'신부측 어머니', holder:data.brideMotherHolder, bank:data.brideMotherBank, number:data.brideMotherAccount, kakaoPay:data.brideMotherKakaoPay, toss:data.brideMotherToss },
  ];

  groomList.filter(a => a.number?.trim()).forEach(a => groomPanel.appendChild(makeAccountCard(a)));
  brideList.filter(a => a.number?.trim()).forEach(a => bridePanel.appendChild(makeAccountCard(a)));
}

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

// ── 오프닝 애니메이션 ──────────────────────────────────────────────────
function initOpeningAnimation() {
  const overlay = document.getElementById('opening-overlay');
  if (!overlay) return;

  const dismiss = () => {
    overlay.classList.add('hide');
    overlay.setAttribute('tabindex', '-1');
  };
  overlay.addEventListener('click', dismiss, { once: true });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
      e.preventDefault();
      dismiss();
    }
  }, { once: true });
  setTimeout(dismiss, 2500);
  overlay.focus({ preventScroll: true });
}

function setOpeningText(cfg, dateStr) {
  const textEl = document.getElementById('opening-text');
  const dateEl = document.getElementById('opening-date');
  if (textEl) textEl.textContent = cfg.splashText || '';
  if (dateEl) dateEl.textContent = dateStr;
}

// ── 공유 시트 ────────────────────────────────────────────────────────
function initShareSheet(cfg) {
  const overlay  = document.getElementById('share-sheet-overlay');
  const openBtn  = document.getElementById('nav-share-btn');
  const closeBtn = document.getElementById('share-sheet-close');
  const kakaoBtn = document.getElementById('share-kakao-btn');
  const copyBtn  = document.getElementById('share-copy-btn');
  const qrBtn    = document.getElementById('share-qr-btn');
  const qrWrap   = document.getElementById('share-qr-wrap');
  const qrCanvas = document.getElementById('share-qr-canvas');

  const title = `${cfg.groomName} ♥ ${cfg.brideName} 결혼합니다`;
  const text  = `${formatDate(cfg.weddingDate)} ${cfg.weddingTime} · ${cfg.venueName}`;

  // Kakao SDK 초기화 (실패해도 무관)
  if (window.Kakao && !Kakao.isInitialized() && KAKAO_JS_KEY !== 'YOUR_KAKAO_JS_KEY') {
    try { Kakao.init(KAKAO_JS_KEY); } catch (_) {}
  }

  function openSheet() { overlay.classList.add('open'); }
  function closeSheet() {
    if (!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.classList.remove('closing');
      qrWrap.classList.remove('open');
    }, 220);
  }

  openBtn.addEventListener('click', openSheet);
  closeBtn.addEventListener('click', closeSheet);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });

  kakaoBtn.addEventListener('click', () => {
    // Kakao SDK 우선 시도 (모바일/데스크탑 공통)
    if (window.Kakao && Kakao.isInitialized()) {
      const imageUrl = cfg.ogImageUrl || cfg.heroBgUrl;
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title,
          description: text,
          link: { mobileWebUrl: SITE_URL, webUrl: SITE_URL },
          ...(imageUrl && { imageUrl }),
        },
        buttons: [
          { title: '청첩장 보기', link: { mobileWebUrl: SITE_URL, webUrl: SITE_URL } },
          { title: '위치 보기',   link: { mobileWebUrl: `${SITE_URL}#map`, webUrl: `${SITE_URL}#map` } },
        ],
      });
      return;
    }

    // 폴백: 기기 기본 공유 시트
    if (navigator.share) {
      navigator.share({ title, text, url: SITE_URL }).catch(() => {});
      return;
    }

    // 최후 폴백: URL 복사
    navigator.clipboard.writeText(SITE_URL).then(() => showToast('링크가 복사되었습니다'));
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(SITE_URL).then(() => showToast('URL이 복사되었습니다'));
  });

  qrBtn.addEventListener('click', () => {
    if (qrWrap.classList.contains('open')) {
      qrWrap.classList.remove('open');
      return;
    }
    QRCode.toCanvas(qrCanvas, SITE_URL, { width: 180, margin: 1 }, err => {
      if (err) { showToast(`QR 코드 생성 실패: ${err.message}`); return; }
      qrWrap.classList.add('open');
    });
  });
}

// ── 글씨 크기 ────────────────────────────────────────────────────────
function initFontSizeToggle() {
  const btn = document.getElementById('nav-fontsize-btn');
  const KEY = 'fontSizePref';

  function apply(large) {
    document.documentElement.classList.toggle('font-large', large);
    btn.setAttribute('aria-pressed', String(large));
  }

  apply(localStorage.getItem(KEY) === 'large');

  btn.addEventListener('click', () => {
    const large = !document.documentElement.classList.contains('font-large');
    apply(large);
    localStorage.setItem(KEY, large ? 'large' : 'normal');
  });
}

// ── 초기화 ──────────────────────────────────────────────────────────
initOpeningAnimation();
initFadeIn();
initFontSizeToggle();
loadConfig();
loadGallery();
loadTimeline();
loadNotices();
loadGuestbook();
loadAccounts();
