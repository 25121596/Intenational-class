// ---- 音乐管理系统 ----
const TRACKS = {
  menu:    '/music/José Antonini - iPhone Trailer.mp3',
  europe:  '/music/José Antonini - Under Attack.mp3',
  soviet:  '/music/José Antonini - Icewind Pass.flac',
  germany: '/music/José Antonini - Under Attack.mp3',
  boss:    '/music/José Antonini - Battle with Vez\'nan.mp3',
};

let currentTrack = null;
let currentKey = null;
let muted = false;
let volume = 0.35;
let bossActive = false;

// 两个 audio 元素用于交叉淡入淡出
let audioA = null;
let audioB = null;
let activeAudio = null; // 'a' or 'b'
let fadeTarget = null;
let fadeTimer = 0;
const FADE_DURATION = 50; // frames

function createAudio(src) {
  const a = new Audio(src);
  a.loop = true;
  a.volume = 0;
  a.preload = 'auto';
  return a;
}

function otherAudio() {
  return activeAudio === 'a' ? audioB : audioA;
}

function getOtherKey() {
  return activeAudio === 'a' ? 'b' : 'a';
}

export function initMusic() {
  // 预加载所有音轨（延迟到首次用户交互）
}

export function ensureMusicLoaded() {
  if (audioA) return;
  audioA = createAudio(TRACKS.menu);
  audioB = createAudio(TRACKS.menu);
  activeAudio = 'a';
  currentTrack = TRACKS.menu;
  currentKey = 'menu';
  audioA.volume = muted ? 0 : volume;
  audioA.play().catch(() => {});
}

export function switchTrack(key) {
  if (!audioA) { ensureMusicLoaded(); return; }
  if (key === currentKey && !bossActive) return;
  const src = TRACKS[key];
  if (!src) return;

  currentKey = key;
  currentTrack = src;

  const other = otherAudio();
  const otherKey = getOtherKey();

  // 在新 audio 上设置音轨
  other.src = src;
  other.load();
  other.volume = 0;
  other.currentTime = 0;
  other.play().catch(() => {});

  // 启动淡入淡出
  fadeTimer = FADE_DURATION;
  fadeTarget = otherKey;
}

export function playBossMusic() {
  if (bossActive) return;
  bossActive = true;
  switchTrack('boss');
}

export function stopBossMusic() {
  if (!bossActive) return;
  bossActive = false;
  // 回到正确的战役音乐
  switchTrack(currentKey === 'boss' ? 'menu' : currentKey);
}

export function updateMusic() {
  if (!audioA || fadeTimer <= 0) return;

  fadeTimer--;
  const t = 1 - fadeTimer / FADE_DURATION; // 0 → 1

  const other = otherAudio();
  const targetVol = muted ? 0 : volume;

  if (fadeTarget === 'b') {
    audioA.volume = Math.max(0, targetVol * (1 - t));
    audioB.volume = Math.min(targetVol, targetVol * t);
  } else {
    audioB.volume = Math.max(0, targetVol * (1 - t));
    audioA.volume = Math.min(targetVol, targetVol * t);
  }

  if (fadeTimer <= 0) {
    // 淡出完成，停止旧音轨
    const old = fadeTarget === 'b' ? audioA : audioB;
    old.pause();
    old.currentTime = 0;
    activeAudio = fadeTarget;
  }
}

export function toggleMute() {
  muted = !muted;
  const vol = muted ? 0 : volume;
  if (audioA) audioA.volume = activeAudio === 'a' || fadeTimer > 0 ? vol : 0;
  if (audioB) audioB.volume = activeAudio === 'b' || fadeTimer > 0 ? vol : 0;
  return muted;
}

export function isMuted() { return muted; }

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (!muted && activeAudio === 'a' && audioA) audioA.volume = volume;
  if (!muted && activeAudio === 'b' && audioB) audioB.volume = volume;
}
