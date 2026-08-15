const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const fields = config.fields || {};
const pick = (k) => fields[k]?.stringValue ?? '';

const groomName    = pick('groomName');
const brideName    = pick('brideName');
const weddingDate  = pick('weddingDate');
const weddingTime  = pick('weddingTime');
const venueName    = pick('venueName');
const ogImageUrl   = pick('ogImageUrl') || pick('heroBgUrl');

if (!groomName || !brideName) {
  console.log('config/main에 groomName/brideName이 없어 동기화를 건너뜁니다.');
  process.exit(0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const dt = new Date(dateStr);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일 ${days[dt.getDay()]}요일`;
}

const title = `${groomName} ♥ ${brideName} 결혼합니다`;
const dateTime = [formatDate(weddingDate), weddingTime].filter(Boolean).join(' ');
const description = venueName
  ? [dateTime, venueName].filter(Boolean).join(' · ')
  : (dateTime || '저희 두 사람의 결혼을 축하해 주세요.');

let html = fs.readFileSync('index.html', 'utf8');
let changed = false;

function replaceOnce(regex, value) {
  const before = html;
  html = html.replace(regex, (_, p1, p2) => p1 + value + p2);
  if (html !== before) changed = true;
}

replaceOnce(/(<title>)[^<]*(<\/title>)/, title);
replaceOnce(/(<meta property="og:title" content=")[^"]*(")/, title);
replaceOnce(/(<meta property="og:description" content=")[^"]*(")/, description);
if (ogImageUrl) {
  replaceOnce(/(<meta property="og:image" content=")[^"]*(")/, ogImageUrl);
}

fs.writeFileSync('index.html', html);
console.log(changed ? '변경사항 반영됨:' : '변경사항 없음:', { title, description, ogImageUrl });
