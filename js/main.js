import { db, isConfigured } from './firebase.js';
import { sanitizeHtml } from './sanitize.js';

// ▼ Kakao Developers(https://developers.kakao.com)에서 발급한 JavaScript 키로 교체
const KAKAO_JS_KEY = '5469ca423793e964c6bdce93d58c29b2';
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
  setCommaListWithBreaks(document.getElementById('groom-parents'), d.groomParents);
  setCommaListWithBreaks(document.getElementById('bride-parents'), d.brideParents);

  const dateStr = formatDate(d.weddingDate);
  document.getElementById('hero-date').textContent  = dateStr;
  document.getElementById('dt-date').textContent    = dateStr;
  document.getElementById('dt-time').textContent    = d.weddingTime;
  document.getElementById('venue-name').textContent = d.venueName;
  document.getElementById('venue-address').textContent = d.venueAddress;

  document.title = `${d.groomName} ♥ ${d.brideName} 결혼합니다`;
  setMeta('og:title',       `${d.groomName} ♥ ${d.brideName} 결혼합니다`);
  setMeta('og:description', `${dateStr} ${d.weddingTime} · ${d.venueName}`);
  const ogImg = d.ogImageUrl || d.heroBgUrl;
  if (ogImg) setMeta('og:image', ogImg);

  const mapBtn = document.getElementById('kakao-map-btn');
  if (d.kakaoMapUrl && d.kakaoMapUrl !== '#') mapBtn.href = d.kakaoMapUrl;

  if (d.heroBgUrl) {
    document.getElementById('hero-bg').style.backgroundImage = `url('${d.heroBgUrl}')`;
  }

  if (d.mapImageUrl) {
    document.getElementById('map-image').src = d.mapImageUrl;
    document.getElementById('map-image-wrap').style.display = 'block';
  }

  document.getElementById('transport-info').innerHTML = sanitizeHtml(d.transport || '');

  // 인트로 섹션
  const introSec = document.getElementById('intro');
  if (d.introTitle || d.introText) {
    document.getElementById('intro-title').textContent = d.introTitle || '';
    document.getElementById('intro-text').textContent  = d.introText  || '';
    introSec.style.display = 'block';
  }

  startCountdown(d.weddingDate, d.weddingTime);

  if (d.musicUrl) initMusic(d.musicUrl);
  initKakaoShare(d);
}

// ── 음악 (YouTube IFrame API) ────────────────────────────────────────
function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function initMusic(url) {
  const videoId = extractVideoId(url);
  if (!videoId) return;

  const bar      = document.getElementById('music-bar');
  const playBtn  = document.getElementById('music-play-btn');
  const muteBtn  = document.getElementById('music-mute-btn');

  bar.classList.add('visible');

  let player  = null;
  let muted   = false;
  let playing = false;
  let interacted = false;

  function updateUI() {
    playBtn.textContent = playing ? '⏸' : '▶';
    muteBtn.textContent = muted   ? '🔇' : '🔊';
    bar.classList.toggle('playing', playing);
  }

  // 첫 인터랙션 시 자동 음소거 해제 (브라우저 자동재생 정책 우회)
  function onFirstInteraction() {
    if (interacted || !player || muted) return;
    interacted = true;
    player.unMute();
    updateUI();
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
        },
        onStateChange: e => {
          playing = e.data === window.YT.PlayerState.PLAYING;
          updateUI();
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

  playBtn.addEventListener('click', () => {
    if (!player) return;
    if (playing) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  });

  muteBtn.addEventListener('click', () => {
    if (!player) return;
    muted = !muted;
    if (muted) {
      player.mute();
    } else {
      player.unMute();
      if (!playing) player.playVideo();
    }
    updateUI();
  });
}

function setCommaListWithBreaks(el, text) {
  el.textContent = '';
  text.split(',').forEach((part, i) => {
    if (i > 0) el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(part));
  });
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

// ── 갤러리 ─────────────────────────────────────────────────────────
const CAT_PHOTOS = [
  'assets/photos/cat1.jpg','assets/photos/cat2.jpg','assets/photos/cat3.jpg',
  'assets/photos/cat4.jpg','assets/photos/cat5.jpg','assets/photos/cat6.jpg',
];

function loadGallery() {
  const grid = document.getElementById('gallery-grid');

  if (!isConfigured) {
    CAT_PHOTOS.forEach(src => appendPhoto(grid, src));
    return;
  }

  onSnapshot(query(collection(db, 'photos'), orderBy('order')), snap => {
    grid.innerHTML = '';
    if (snap.empty) {
      CAT_PHOTOS.forEach(src => appendPhoto(grid, src));
    } else {
      snap.forEach(d => appendPhoto(grid, d.data().url));
    }
  });
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
      <div class="account-side">${escapeHtml(side)}</div>
      <div class="account-holder">${escapeHtml(holder)}</div>
      <div class="account-number">${escapeHtml(bank)} ${escapeHtml(number)}</div>
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

// ── 공유 ────────────────────────────────────────────────────────────
function initKakaoShare(cfg) {
  const btn = document.getElementById('kakao-share-btn');
  if (!btn) return;

  const siteUrl = 'https://heselkdh.github.io/wedding-invitation/';
  const title   = `${cfg.groomName} ♥ ${cfg.brideName} 결혼합니다`;
  const text    = `${formatDate(cfg.weddingDate)} ${cfg.weddingTime} · ${cfg.venueName}`;

  // Kakao SDK 초기화 (실패해도 무관)
  if (window.Kakao && !Kakao.isInitialized() && KAKAO_JS_KEY !== 'YOUR_KAKAO_JS_KEY') {
    try { Kakao.init(KAKAO_JS_KEY); } catch (_) {}
  }

  btn.addEventListener('click', () => {
    // Kakao SDK 우선 시도 (모바일/데스크탑 공통)
    if (window.Kakao && Kakao.isInitialized()) {
      const imageUrl = cfg.ogImageUrl || cfg.heroBgUrl;
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title,
          description: text,
          link: { mobileWebUrl: siteUrl, webUrl: siteUrl },
          ...(imageUrl && { imageUrl }),
        },
        buttons: [
          { title: '청첩장 보기', link: { mobileWebUrl: siteUrl, webUrl: siteUrl } },
          { title: '위치 보기',   link: { mobileWebUrl: cfg.kakaoMapUrl || siteUrl, webUrl: cfg.kakaoMapUrl || siteUrl } },
        ],
      });
      return;
    }

    // 폴백: 기기 기본 공유 시트
    if (navigator.share) {
      navigator.share({ title, text, url: siteUrl }).catch(() => {});
      return;
    }

    // 최후 폴백: URL 복사
    navigator.clipboard.writeText(siteUrl).then(() => showToast('링크가 복사되었습니다'));
  });
}

// ── 초기화 ──────────────────────────────────────────────────────────
initParallax();
initFadeIn();
loadConfig();
loadGallery();
loadGuestbook();
loadAccounts();
