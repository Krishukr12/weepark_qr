/** Soft three-note chime for staff notifications. Public QR customers never hear this. */

let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;
let unlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, gain: number): void {
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.value = frequency;
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(gain, start + 0.02);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/** Resume audio after a user gesture so later toasts can play without being blocked. */
export function unlockNotificationAudio(): void {
  if (unlocked) return;
  unlocked = true;
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume();
}

/** Pleasant C–E–G chime. Debounced so a burst of events plays once. */
export function playNotificationChime(): void {
  const now = Date.now();
  if (now - lastPlayedAt < 450) return;
  lastPlayedAt = now;

  const ctx = getAudioContext();
  if (!ctx) return;

  void ctx.resume().then(() => {
    const t = ctx.currentTime + 0.01;
    tone(ctx, 523.25, t, 0.22, 0.045);
    tone(ctx, 659.25, t + 0.12, 0.28, 0.04);
    tone(ctx, 783.99, t + 0.26, 0.42, 0.035);
  }).catch(() => {
    /* Autoplay policies can still block; ignore. */
  });
}
