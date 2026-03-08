/**
 * utils/sound.js - 消息通知音效（Web Audio API 合成，无需音频文件）
 */

let audioCtx = null;
let soundEnabled = true;

// 从 localStorage 读取用户偏好
try {
  soundEnabled = localStorage.getItem('sound:enabled') !== 'false';
} catch {}

/**
 * 获取（或懒初始化）AudioContext
 */
function getAudioContext() {
  if (!audioCtx || audioCtx.state === 'closed') {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  // 恢复被 autoplay policy 暂停的上下文
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * 播放新消息提醒音 —— 轻柔的两音调叮咚
 */
export function playMessageSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 第一个音（高）
    playTone(ctx, 880, now, 0.06, 0.15, 0.18);
    // 第二个音（低），稍晚 80ms
    playTone(ctx, 660, now + 0.08, 0.04, 0.12, 0.22);
  } catch {
    // silent fail — 音效不影响功能
  }
}

/**
 * 播放提及提醒音 —— 稍微响亮一点的三音调
 */
export function playMentionSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    playTone(ctx, 880, now, 0.08, 0.1, 0.15);
    playTone(ctx, 1100, now + 0.1, 0.08, 0.1, 0.15);
    playTone(ctx, 1320, now + 0.2, 0.1, 0.15, 0.25);
  } catch {}
}

/**
 * 内部：合成一个正弦波音调
 * @param {AudioContext} ctx
 * @param {number} freq - 频率 Hz
 * @param {number} startTime - 开始时间（ctx时间）
 * @param {number} volume - 峰值音量 0-1
 * @param {number} attack - 渐入时长 s
 * @param {number} decay - 渐出时长 s
 */
function playTone(ctx, freq, startTime, volume, attack, decay) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);
  // 轻微下滑使音色更自然
  osc.frequency.exponentialRampToValueAtTime(freq * 0.98, startTime + attack + decay);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + attack + decay);

  osc.start(startTime);
  osc.stop(startTime + attack + decay + 0.01);
}

/**
 * 开启/关闭音效
 */
export function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  try {
    localStorage.setItem('sound:enabled', enabled ? 'true' : 'false');
  } catch {}
}

export function isSoundEnabled() {
  return soundEnabled;
}
