'use strict';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* =========================================================
   효과음 (Web Audio로 직접 합성 — 외부 파일 없음)
   ========================================================= */
let actx = null;
let muted = false;

function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function tone({ f = 440, f2 = null, d = 0.15, type = 'sine', v = 0.3, delay = 0 }) {
  if (muted) return;
  const a = audio();
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + d + 0.02);
}

function noise({ d = 0.2, v = 0.2, freq = 1200, delay = 0 }) {
  if (muted) return;
  const a = audio();
  const t = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * d);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = v;
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t);
}

const sfx = {
  thump() { tone({ f: 170, f2: 45, d: 0.22, v: 0.6 }); noise({ d: 0.08, v: 0.3, freq: 450 }); },
  ouch() { tone({ f: 760, f2: 260, d: 0.3, type: 'square', v: 0.13 }); },
  warn() { tone({ f: 920, d: 0.07, v: 0.1, type: 'square' }); },
  pop() { tone({ f: 480, f2: 950, d: 0.09, v: 0.22, type: 'triangle' }); },
  drop() { tone({ f: 320, f2: 140, d: 0.12, v: 0.22 }); },
  squish() { tone({ f: rand(200, 420), f2: 90, d: 0.11, v: 0.2, type: 'triangle' }); },
  whoosh() { noise({ d: 0.35, v: 0.35, freq: 1800 }); },
  done() { [523, 659, 784].forEach((f, i) => tone({ f, d: 0.25, v: 0.22, type: 'triangle', delay: i * 0.09 })); },
  tada() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, d: 0.45, v: 0.22, type: 'triangle', delay: i * 0.1 })); },
};

$('#muteBtn').addEventListener('click', () => {
  muted = !muted;
  $('#muteBtn').textContent = muted ? '🔇' : '🔊';
});

/* =========================================================
   공통 화면 처리
   ========================================================= */
function fitAll() {
  document.querySelectorAll('.fit-wrap').forEach((wrap) => {
    const el = wrap.firstElementChild;
    const w = +el.dataset.w;
    const h = +el.dataset.h;
    const s = Math.min(1, wrap.clientWidth / w);
    el.style.transform = `scale(${s})`;
    wrap.style.height = `${h * s}px`;
  });
}
window.addEventListener('resize', fitAll);

function go(stage) {
  document.querySelectorAll('.screen').forEach((s, i) => s.classList.toggle('active', i === stage - 1));
  document.querySelectorAll('#steps li').forEach((li, i) => {
    li.classList.toggle('on', i === stage - 1);
    li.classList.toggle('done', i < stage - 1);
  });
  fitAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function popText(layer, text, x, y, cls = '') {
  const el = document.createElement('div');
  el.className = `pop-text ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.setProperty('--r', `${rand(-15, 15)}deg`);
  layer.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function flourBurst(layer, x, y, n = 10) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'flour';
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--dx', `${rand(-90, 90)}px`);
    p.style.setProperty('--dy', `${rand(-70, 10)}px`);
    layer.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* =========================================================
   1단계: 절구 찧기
   - 손(반죽 뒤집는 사람)이 들어와 있을 때 찧으면 "아야!"
   ========================================================= */
const mallet = $('#mallet');
const dough = $('#dough');
const grains = $('#grains');
const hand = $('#helperHand');
const warnEl = $('#warn');
const fx1 = $('#fx1');

const pound = { progress: 0, combo: 0, handIn: false, busy: false, done: false, started: false, timer: null };

function updatePoundUI() {
  const p = Math.round(pound.progress);
  $('#poundBar').style.width = `${p}%`;
  $('#poundPct').textContent = p >= 100 ? '모찌피 완성!' : `반죽 ${p}%`;
  $('#combo').textContent = pound.combo;
  grains.style.opacity = String(Math.max(0, 1 - pound.progress / 85));
  dough.style.width = `${170 + pound.progress * 0.45}px`;
}

function scheduleHand() {
  clearTimeout(pound.timer);
  if (pound.done) return;
  // 랜덤한 간격으로 경고 → 손 등장 → 반죽 뒤집기 → 손 퇴장
  pound.timer = setTimeout(() => {
    warnEl.classList.add('show');
    sfx.warn();
    pound.timer = setTimeout(() => {
      warnEl.classList.remove('show');
      pound.handIn = true;
      hand.classList.add('in');
      pound.timer = setTimeout(() => {
        pound.handIn = false;
        hand.classList.remove('in', 'hurt');
        restartAnim(dough, 'flip');
        scheduleHand();
      }, rand(650, 900));
    }, 480);
  }, rand(1100, 2600));
}

function doPound() {
  if (pound.done || pound.busy) return;
  audio();
  pound.busy = true;
  setTimeout(() => (pound.busy = false), 170);
  $('#tapHint').classList.add('hidden');
  if (!pound.started) {
    pound.started = true;
    scheduleHand();
  }

  restartAnim(mallet, 'hit');
  setTimeout(() => {
    if (pound.done) return;
    if (pound.handIn) {
      // 손을 찧어버림!
      sfx.ouch();
      pound.progress = Math.max(0, pound.progress - 12);
      pound.combo = 0;
      restartAnim(hand, 'hurt');
      restartAnim($('#poundArea'), 'shake');
      popText(fx1, pick(['아야!!', '으악!!', '손!! 손!!']), 230, 120, 'bad');
    } else {
      sfx.thump();
      pound.combo++;
      pound.progress = Math.min(100, pound.progress + (pound.combo >= 10 ? 5 : 4));
      restartAnim(dough, 'squash');
      flourBurst(fx1, 280, 180);
      if (pound.combo > 0 && pound.combo % 10 === 0) {
        popText(fx1, `${pound.combo} 콤보!`, 280, 90, 'good');
      } else {
        popText(fx1, pick(['쿵!', '철퍽!', '쫀득!', '퍽!', '쿵쿵!']), rand(200, 360), rand(110, 150));
      }
      if (pound.progress >= 100) finishPound();
    }
    updatePoundUI();
  }, 100);
}

function finishPound() {
  pound.done = true;
  clearTimeout(pound.timer);
  pound.handIn = false;
  hand.classList.remove('in');
  warnEl.classList.remove('show');
  dough.classList.add('done');
  sfx.done();
  popText(fx1, '모찌피 완성! ✨', 280, 110, 'good');
  const btn = $('#toKitchen');
  btn.classList.remove('hidden');
  btn.classList.add('pulse');
}

function resetPound() {
  clearTimeout(pound.timer);
  Object.assign(pound, { progress: 0, combo: 0, handIn: false, busy: false, done: false, started: false, timer: null });
  hand.classList.remove('in', 'hurt');
  warnEl.classList.remove('show');
  dough.classList.remove('done', 'squash', 'flip');
  $('#toKitchen').classList.add('hidden');
  $('#tapHint').classList.remove('hidden');
  updatePoundUI();
}

$('#poundArea').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  doPound();
});
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || !$('#stage1').classList.contains('active')) return;
  e.preventDefault();
  if (!e.repeat) doPound();
});
$('#toKitchen').addEventListener('click', () => go(2));

/* =========================================================
   2단계: 주방 — 토핑 끌어다 놓기
   ========================================================= */
const SVG = {
  shine: `<svg viewBox="0 0 64 64"><path d="M33 8c2-4 8-6 12-4" stroke="#7a5a2a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g fill="#c4e57a" stroke="#8fba45" stroke-width="2"><circle cx="22" cy="20" r="10"/><circle cx="42" cy="20" r="10"/>
    <circle cx="32" cy="35" r="10"/><circle cx="15" cy="38" r="8"/><circle cx="49" cy="38" r="8"/><circle cx="24" cy="51" r="8"/><circle cx="40" cy="51" r="8"/></g>
    <g fill="#fff" opacity=".65"><circle cx="18" cy="16" r="3"/><circle cx="38" cy="16" r="3"/><circle cx="28" cy="31" r="3"/><circle cx="21" cy="48" r="2"/><circle cx="37" cy="48" r="2"/></g></svg>`,
  wasabi: `<svg viewBox="0 0 64 64"><path d="M8 46C4 32 16 26 22 28 24 14 44 12 46 26 58 26 62 44 52 50 40 58 18 58 8 46Z" fill="#9fd055" stroke="#6c9b2c" stroke-width="2.5"/>
    <path d="M24 36c6-6 14-4 16 2" stroke="#7fb23a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g fill="#c8ec8c"><circle cx="20" cy="42" r="2"/><circle cx="44" cy="40" r="2"/><circle cx="34" cy="24" r="2"/><circle cx="30" cy="48" r="1.6"/></g></svg>`,
  redbean: `<svg viewBox="0 0 64 64"><path d="M6 44C4 30 18 22 32 22S60 30 58 44C56 54 40 58 32 58S8 54 6 44Z" fill="#5a1f1f" stroke="#3f1414" stroke-width="2"/>
    <g fill="#7e2b2b" stroke="#4a1717" stroke-width="1.2"><ellipse cx="20" cy="36" rx="7" ry="5"/><ellipse cx="36" cy="32" rx="7" ry="5"/><ellipse cx="46" cy="44" rx="7" ry="5"/><ellipse cx="28" cy="47" rx="7" ry="5"/></g>
    <g fill="#fff" opacity=".55"><circle cx="18" cy="34" r="1.5"/><circle cx="34" cy="30" r="1.5"/><circle cx="44" cy="42" r="1.5"/><circle cx="26" cy="45" r="1.5"/></g></svg>`,
  yogurt: `<svg viewBox="0 0 64 64"><path d="M10 50Q32 60 54 50Q58 42 47 40Q53 32 42 28Q46 17 32 8Q31 21 22 25Q11 30 18 38Q7 42 10 50Z" fill="#fffdf8" stroke="#d4cab8" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M20 46Q32 50 44 45M24 35Q32 38 40 34" stroke="#e7dfd0" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  gopchang: `<svg viewBox="0 0 64 64"><path d="M12 42C10 20 52 16 52 34 52 48 26 50 26 37 26 29 40 29 40 35" fill="none" stroke="#c9733a" stroke-width="12" stroke-linecap="round"/>
    <path d="M12 42C10 20 52 16 52 34 52 48 26 50 26 37 26 29 40 29 40 35" fill="none" stroke="#f0b27a" stroke-width="5" stroke-linecap="round"/>
    <g stroke="#7a3a16" stroke-width="2.5" stroke-linecap="round"><path d="M18 26l4 4M44 22l-2 5M50 42l-5-2M30 48l1-5"/></g></svg>`,
};

const TOPPINGS = [
  { id: 'strawberry', name: '딸기', emo: '🍓', tint: '#ff5c74', score: 2 },
  { id: 'shine', name: '샤인머스켓', svg: SVG.shine, tint: '#b5dc5a', score: 2 },
  { id: 'tangerine', name: '통귤', emo: '🍊', tint: '#ff9a2e', score: 2 },
  { id: 'choco', name: '초콜릿', emo: '🍫', tint: '#6b3b22', score: 1, core: '#5a3220' },
  { id: 'wasabi', name: '와사비', svg: SVG.wasabi, tint: '#8fcf3c', score: -2 },
  { id: 'redbean', name: '팥', svg: SVG.redbean, tint: '#6b2323', score: 2, core: '#5b2424' },
  { id: 'yogurt', name: '요거트', svg: SVG.yogurt, tint: '#f4efe6', score: 1, core: '#fffdf6' },
  { id: 'mango', name: '망고', emo: '🥭', tint: '#ffc233', score: 2 },
  { id: 'kiwi', name: '키위', emo: '🥝', tint: '#7bb83a', score: 2 },
  { id: 'poop', name: '똥', emo: '💩', tint: '#8a5a2b', score: -10 },
  { id: 'ramen', name: '라면', emo: '🍜', tint: '#f0c070', score: -1 },
  { id: 'pork', name: '삼겹살', emo: '🥓', tint: '#e88a7a', score: -1 },
  { id: 'gopchang', name: '곱창', svg: SVG.gopchang, tint: '#d98a4e', score: -1 },
];
const T = Object.fromEntries(TOPPINGS.map((t) => [t.id, t]));
const MAX_TOPPINGS = 15;

const iconHTML = (t) => `<span class="ico">${t.svg || t.emo}</span>`;

const skin = $('#skin');
let placed = []; // { t, x, y, r, el }
let drag = null;

$('#toppingMax').textContent = MAX_TOPPINGS;

// 재료 선반 만들기
TOPPINGS.forEach((t) => {
  const item = document.createElement('div');
  item.className = `topping-item${t.score < 0 ? ' weird' : ''}`;
  item.innerHTML = `${iconHTML(t)}<span>${t.name}</span>`;
  item.addEventListener('pointerdown', (e) => startDrag(e, t, null));
  $('#trayGrid').appendChild(item);
});

function startDrag(e, t, obj) {
  e.preventDefault();
  audio();
  if (!obj && placed.length >= MAX_TOPPINGS) {
    toast(`토핑은 ${MAX_TOPPINGS}개까지만 올릴 수 있어요!`);
    return;
  }
  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.innerHTML = iconHTML(t);
  document.body.appendChild(ghost);
  drag = { t, obj, ghost };
  if (obj) obj.el.classList.add('dragging-src');
  moveGhost(e);
  sfx.pop();
  window.addEventListener('pointermove', moveGhost);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}

function skinHit(x, y) {
  const r = skin.getBoundingClientRect();
  const dx = (x - (r.left + r.width / 2)) / (r.width / 2);
  const dy = (y - (r.top + r.height / 2)) / (r.height / 2);
  return {
    ok: dx * dx + dy * dy <= 0.82,
    x: ((x - r.left) / r.width) * 100,
    y: ((y - r.top) / r.height) * 100,
  };
}

function moveGhost(e) {
  if (!drag) return;
  drag.ghost.style.left = `${e.clientX}px`;
  drag.ghost.style.top = `${e.clientY}px`;
  skin.classList.toggle('hover', skinHit(e.clientX, e.clientY).ok);
}

function endDrag(e) {
  if (!drag) return;
  window.removeEventListener('pointermove', moveGhost);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
  skin.classList.remove('hover');
  drag.ghost.remove();

  const hit = skinHit(e.clientX, e.clientY);
  const { t, obj } = drag;
  drag = null;

  if (obj) {
    obj.el.classList.remove('dragging-src');
    if (hit.ok) {
      obj.x = hit.x;
      obj.y = hit.y;
      positionPlaced(obj);
      sfx.drop();
    } else {
      removePlaced(obj);
    }
  } else if (hit.ok) {
    addPlaced(t, hit.x, hit.y);
  }
}

function positionPlaced(obj) {
  obj.el.style.left = `${obj.x}%`;
  obj.el.style.top = `${obj.y}%`;
}

function addPlaced(t, x, y) {
  const el = document.createElement('div');
  el.className = 'placed';
  el.innerHTML = iconHTML(t);
  const obj = { t, x, y, r: rand(-22, 22), el };
  el.style.setProperty('--r', `${obj.r}deg`);
  positionPlaced(obj);
  el.addEventListener('pointerdown', (e) => startDrag(e, t, obj));
  skin.appendChild(el);
  placed.push(obj);
  restartAnim(skin, 'wobble');
  sfx.drop();
  updateCount();
  if (t.id === 'poop') toast('제빵사: ...진심이세요? 💩');
}

function removePlaced(obj) {
  obj.el.remove();
  placed = placed.filter((p) => p !== obj);
  sfx.pop();
  updateCount();
}

function clearPlaced() {
  placed.forEach((p) => p.el.remove());
  placed = [];
  updateCount();
}

function updateCount() {
  $('#toppingCount').textContent = placed.length;
}

$('#clearBtn').addEventListener('click', () => {
  clearPlaced();
  sfx.pop();
});
$('#makeBtn').addEventListener('click', () => {
  if (placed.length === 0) {
    toast('토핑을 하나 이상 올려주세요!');
    return;
  }
  makeMochi();
});

/* =========================================================
   3단계: 제빵사가 현란하게 굴려서 짜잔!
   ========================================================= */
const bake = $('#bake');
const fx3 = $('#fx3');
const mover = $('#mover');
let runId = 0;

function mixTint(list) {
  let r = 0, g = 0, b = 0;
  list.forEach(({ t }) => {
    const n = parseInt(t.tint.slice(1), 16);
    r += n >> 16;
    g += (n >> 8) & 255;
    b += n & 255;
  });
  const k = list.length;
  return `rgb(${Math.round(r / k)}, ${Math.round(g / k)}, ${Math.round(b / k)})`;
}

function uniqueToppings(list) {
  const seen = new Map();
  list.forEach(({ t }) => seen.set(t.id, (seen.get(t.id) || 0) + 1));
  return [...seen.keys()].map((id) => T[id]);
}

function judge(list) {
  const uniq = uniqueToppings(list);
  const ids = new Set(uniq.map((t) => t.id));
  const score = uniq.reduce((s, t) => s + t.score, 0);
  const weird = uniq.filter((t) => t.score < 0 && t.id !== 'poop');

  let name;
  if (uniq.length === 1 && ids.has('poop')) name = '황금 똥 모찌 (먹지 마세요)';
  else {
    const names = uniq.slice(0, 3).map((t) => t.name).join(' ');
    name = `${names}${uniq.length > 3 ? ` 외 ${uniq.length - 3}가지` : ''} 모찌`;
  }

  let stars;
  if (ids.has('poop')) stars = 1;
  else if (score >= 6) stars = 5;
  else if (score >= 4) stars = 4;
  else if (score >= 2) stars = 3;
  else if (score >= 0) stars = 2;
  else stars = 1;

  let comment;
  if (uniq.length === 1 && ids.has('poop')) comment = '제빵사: 이건... 그냥 똥이잖아요. 똥말고 모찌먹자!!';
  else if (ids.has('poop')) comment = '제빵사: 💩는 빼고 다시 만들어요. 제발 똥말고 모찌먹자!';
  else if (weird.length >= 2) comment = `${weird.map((t) => t.name).join(', ')}이(가) 들어간 모찌라니... 상상도 못한 맛! (의외로 맛있을지도?)`;
  else if (weird.length === 1 && weird[0].id === 'wasabi') comment = '코가 뻥 뚫리는 와사비 모찌! 눈물 주의 😭';
  else if (weird.length === 1) comment = `${weird[0].name} 모찌... 이거 신메뉴 각인가요?`;
  else if (uniq.length >= 3) comment = '알록달록 과일 폭탄! 이대로 가게 차려도 되겠어요 🍡';
  else comment = '쫀득쫀득, 반으로 가르면 탄성이 나오는 완벽한 모찌!';

  const coreT = uniq.find((t) => t.core);
  return { name, stars, comment, uniq, core: coreT ? coreT.core : '#fffaf2' };
}

function rollText() {
  const words = ['쭈물쭈물!', '슉슉!', '데굴데굴!', '휘리릭!', '팡팡!', '조물조물!', '쫀득!', '빙글빙글!', '탁탁!'];
  popText(fx3, pick(words), rand(90, 470), rand(130, 400));
}

function confetti() {
  const colors = ['#ff8fa3', '#ffd23f', '#9fd055', '#7ec8ff', '#ffffff', '#ff9a2e', '#c59bff'];
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = `${rand(0, 560)}px`;
    c.style.background = pick(colors);
    c.style.animationDuration = `${rand(1.6, 3)}s`;
    c.style.animationDelay = `${rand(0, 0.4)}s`;
    c.style.setProperty('--dx', `${rand(-120, 120)}px`);
    c.style.setProperty('--rot', `${rand(-720, 720)}deg`);
    fx3.appendChild(c);
    setTimeout(() => c.remove(), 3600);
  }
}

function sparkles() {
  [[180, 300], [380, 290], [210, 390], [360, 400], [280, 250]].forEach(([x, y], i) => {
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.textContent = '✨';
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.animationDelay = `${i * 0.2}s`;
    fx3.appendChild(s);
  });
}

function resetBake() {
  bake.className = 'bake fit';
  mover.className = 'mover hidden';
  $('#ball').classList.remove('glow');
  $('#palm').classList.remove('show');
  $('#bubble').classList.remove('show');
  $('#jjajan').classList.remove('show');
  $('#result').classList.add('hidden');
  fx3.innerHTML = '';
  const ws = $('#wrapSkin');
  ws.classList.remove('wrapping', 'hidden');
  ws.innerHTML = '';
}

async function makeMochi() {
  const id = ++runId;
  const alive = () => id === runId;
  const list = placed.slice();
  const result = judge(list);

  go(3);
  resetBake();
  $('#bakeTitle').textContent = '제빵사가 모찌피로 토핑을 감싸는 중...';

  // 모찌피 + 토핑을 그대로 옮겨오기
  const ws = $('#wrapSkin');
  list.forEach((p) => {
    const m = document.createElement('div');
    m.className = 'mini';
    m.innerHTML = iconHTML(p.t);
    m.style.left = `${p.x}%`;
    m.style.top = `${p.y}%`;
    m.style.setProperty('--r', `${p.r}deg`);
    ws.appendChild(m);
  });

  // 모찌 볼 준비 (속이 살짝 비치는 느낌)
  $('#ball').style.setProperty('--tint', mixTint(list));
  $('#ballInside').innerHTML = result.uniq.slice(0, 3).map(iconHTML).join('');

  await sleep(700); if (!alive()) return;
  bake.classList.add('cup');
  ws.classList.add('wrapping');
  for (let i = 0; i < 4; i++) setTimeout(() => alive() && sfx.squish(), i * 200);

  await sleep(1000); if (!alive()) return;
  ws.classList.add('hidden');
  mover.classList.remove('hidden');

  // 현란하고 요란하게 굴리기
  $('#bakeTitle').textContent = '현란하게 굴리기!!! 🌀';
  bake.classList.remove('cup');
  bake.classList.add('rolling');
  const loud = setInterval(() => {
    if (!alive()) return clearInterval(loud);
    rollText();
    sfx.squish();
    flourBurst(fx3, rand(220, 340), rand(200, 300), 6);
    restartAnim(bake, 'shake');
  }, 170);

  await sleep(3600);
  clearInterval(loud);
  if (!alive()) return;

  // 공중으로 던졌다가 손바닥 위로 착지
  $('#bakeTitle').textContent = '휘리리릭~!';
  bake.classList.remove('rolling', 'shake');
  bake.classList.add('hands-out');
  sfx.whoosh();
  mover.classList.add('toss');
  await sleep(450); if (!alive()) return;
  $('#palm').classList.add('show');

  await sleep(560); if (!alive()) return;
  mover.classList.remove('toss');
  mover.classList.add('on-palm');
  sfx.drop();
  sfx.tada();
  $('#ball').classList.add('glow');
  $('#jjajan').classList.add('show');
  $('#bakeTitle').textContent = '짜잔~! 모찌 완성!';
  confetti();
  sparkles();

  await sleep(900); if (!alive()) return;
  $('#bubble').classList.add('show');
  showResult(result);
}

function showResult({ name, stars, comment, uniq, core }) {
  $('#mochiName').textContent = name;
  $('#stars').innerHTML = '★'.repeat(stars) + `<span class="off">${'★'.repeat(5 - stars)}</span>`;
  $('#comment').textContent = comment;
  $('#cutCore').style.setProperty('--core', core);
  const fill = $('#cutFill');
  const shown = uniq.filter((t) => !t.core || uniq.length === 1).slice(0, 6);
  fill.innerHTML = (shown.length ? shown : uniq.slice(0, 1)).map(iconHTML).join('');
  fill.classList.toggle('many', shown.length > 3);
  $('#result').classList.remove('hidden');
}

$('#againTopping').addEventListener('click', () => {
  runId++;
  go(2);
});
$('#againAll').addEventListener('click', () => {
  runId++;
  clearPlaced();
  resetPound();
  go(1);
});

/* =========================================================
   인트로
   ========================================================= */
(function initIntro() {
  const items = ['🍓', '🍊', '🥝', '🥭', '🍡', '🍇', '✨', '💩'];
  const box = $('#introFalling');
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('span');
    s.textContent = pick(items);
    s.style.left = `${rand(0, 100)}%`;
    s.style.fontSize = `${rand(24, 44)}px`;
    s.style.animationDuration = `${rand(6, 12)}s`;
    s.style.animationDelay = `${rand(-12, 0)}s`;
    box.appendChild(s);
  }

  $('#startBtn').addEventListener('click', () => {
    audio();
    sfx.tada();
    const intro = $('#intro');
    intro.classList.add('leave');
    $('#app').classList.remove('hidden');
    go(1);
    setTimeout(() => intro.classList.add('hidden'), 600);
  });
})();

/* 시작 */
updatePoundUI();
