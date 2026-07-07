// ---- 简易音效系统 (Web Audio API, 无需音频文件) ----
let audioCtx = null;
let enabled = true;

function ctx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { enabled = false; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function play(fn) {
  if (!enabled) return;
  const c = ctx();
  if (!c) return;
  try { fn(c); } catch { /* ignore audio errors */ }
}

// 短促射击音
export function playShoot() { play(c => {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.06);
  gain.gain.setValueAtTime(0.07, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(gain); gain.connect(c.destination);
  osc.start(t); osc.stop(t + 0.08);
});}

// 爆炸音
export function playExplosion() { play(c => {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc.connect(gain); gain.connect(c.destination);
  osc.start(t); osc.stop(t + 0.28);
});}

// 敌人死亡
export function playDeath() { play(c => {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  osc.connect(gain); gain.connect(c.destination);
  osc.start(t); osc.stop(t + 0.14);
});}

// 波次开始
export function playWaveStart() { play(c => {
  const t = c.currentTime;
  [0, 0.08, 0.16].forEach((d, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330 + i * 80, t + d);
    gain.gain.setValueAtTime(0.08, t + d);
    gain.gain.exponentialRampToValueAtTime(0.001, t + d + 0.2);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t + d); osc.stop(t + d + 0.2);
  });
});}

// 完美通关
export function playPerfect() { play(c => {
  const t = c.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t + i * 0.1);
    gain.gain.setValueAtTime(0.1, t + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.35);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.35);
  });
});}

// 按钮点击
export function playClick() { play(c => {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, t);
  gain.gain.setValueAtTime(0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  osc.connect(gain); gain.connect(c.destination);
  osc.start(t); osc.stop(t + 0.04);
});}

// 升级完成
export function playUpgrade() { play(c => {
  const t = c.currentTime;
  [440, 554, 660].forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t + i * 0.07);
    gain.gain.setValueAtTime(0.07, t + i * 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.2);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.2);
  });
});}

// 初始化（首次用户交互时调用）
export function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { enabled = false; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
