/**
 * Staff alert sound. Public QR customers never hear this.
 * Unlock + Notification permission happen once on the login click (user gesture).
 */
import {
  applyPickupAlarmAction,
  markAsked,
  notificationToPickupAlarmAction,
  pickupAlarmShouldRun,
  readAlreadyAsked,
  shouldAskBrowserNotificationPermission,
  shouldPlayOneShotChime,
  shouldShowOsNotification,
  type BrowserNotificationPermission,
} from './staff-alert-policy';

let audioCtx: AudioContext | null = null;
let chimeEl: HTMLAudioElement | null = null;
let alarmEl: HTMLAudioElement | null = null;
let lastPlayedAt = 0;
let chimeUrl: string | null = null;
let alarmUrl: string | null = null;
let pendingPickupIds: string[] = [];
let alarmWatch: ReturnType<typeof setInterval> | null = null;
let lastOsNagAt = 0;

function notificationPermission(): BrowserNotificationPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, gain: number, type: OscillatorType = 'triangle'): void {
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(gain, start + 0.015);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function floatToWavUrl(samples: Float32Array, sampleRate: number): string {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function mixTone(
  samples: Float32Array,
  sampleRate: number,
  frequency: number,
  startSec: number,
  durSec: number,
  gain: number,
  square: boolean,
): void {
  const start = Math.floor(startSec * sampleRate);
  const n = Math.floor(durSec * sampleRate);
  for (let i = 0; i < n; i += 1) {
    const t = i / sampleRate;
    const env = Math.min(1, i / (0.01 * sampleRate)) * Math.exp(-t * (square ? 3.2 : 5.5));
    const wave = Math.sin(2 * Math.PI * frequency * t);
    const sample = (square ? Math.sign(wave) * 0.85 + wave * 0.15 : wave) * gain * env;
    const idx = start + i;
    if (idx < samples.length) samples[idx] += sample;
  }
}

function buildChimeUrl(): string {
  if (chimeUrl) return chimeUrl;
  const sampleRate = 22050;
  const samples = new Float32Array(Math.ceil(sampleRate * 0.78));
  mixTone(samples, sampleRate, 523.25, 0, 0.22, 0.2, false);
  mixTone(samples, sampleRate, 659.25, 0.12, 0.28, 0.17, false);
  mixTone(samples, sampleRate, 783.99, 0.26, 0.42, 0.15, false);
  chimeUrl = floatToWavUrl(samples, sampleRate);
  return chimeUrl;
}

/** Urgent two-tone clip that loops until a valet accepts the pickup. */
function buildAlarmUrl(): string {
  if (alarmUrl) return alarmUrl;
  const sampleRate = 22050;
  const samples = new Float32Array(Math.ceil(sampleRate * 1.35));
  mixTone(samples, sampleRate, 880, 0, 0.22, 0.38, true);
  mixTone(samples, sampleRate, 698.46, 0.28, 0.26, 0.4, true);
  mixTone(samples, sampleRate, 880, 0.62, 0.22, 0.38, true);
  mixTone(samples, sampleRate, 698.46, 0.9, 0.28, 0.4, true);
  alarmUrl = floatToWavUrl(samples, sampleRate);
  return alarmUrl;
}

function getChimeElement(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!chimeEl) {
    chimeEl = new Audio(buildChimeUrl());
    chimeEl.preload = 'auto';
    chimeEl.volume = 0.45;
  }
  return chimeEl;
}

function getAlarmElement(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!alarmEl) {
    alarmEl = new Audio(buildAlarmUrl());
    alarmEl.preload = 'auto';
    alarmEl.loop = true;
    alarmEl.volume = 0.7;
  }
  return alarmEl;
}

function playWebAudioChime(): void {
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

function playWebAudioAlarmBurst(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume().then(() => {
    const t = ctx.currentTime + 0.01;
    tone(ctx, 880, t, 0.18, 0.09, 'square');
    tone(ctx, 698.46, t + 0.22, 0.22, 0.1, 'square');
  }).catch(() => {
    /* ignore */
  });
}

function nagPickupOsBanner(): void {
  const hidden = typeof document !== 'undefined' && document.hidden;
  if (!shouldShowOsNotification(notificationPermission(), hidden)) return;
  const now = Date.now();
  if (now - lastOsNagAt < 4000) return;
  lastOsNagAt = now;
  const banner = new Notification('Pickup waiting', {
    body: 'A customer is waiting for their vehicle. Accept the pickup.',
    icon: '/icon-dark.png',
    tag: 'weepark-pickup-alarm',
    requireInteraction: true,
    silent: false,
  });
  banner.onclick = () => {
    window.focus();
    banner.close();
    window.dispatchEvent(new CustomEvent('weepark:notification-open', { detail: '/parking' }));
  };
}

function stopAlarmPlayback(): void {
  if (alarmWatch) {
    clearInterval(alarmWatch);
    alarmWatch = null;
  }
  lastOsNagAt = 0;
  if (alarmEl) {
    alarmEl.loop = false;
    alarmEl.pause();
    alarmEl.currentTime = 0;
  }
}

function ensureAlarmPlaying(): void {
  resumeNotificationAudio();
  playWebAudioAlarmBurst();
  const el = getAlarmElement();
  if (el) {
    el.loop = true;
    if (el.paused) void el.play().catch(() => playWebAudioAlarmBurst());
  }
  nagPickupOsBanner();
  if (!alarmWatch) {
    alarmWatch = setInterval(() => {
      if (!pickupAlarmShouldRun(pendingPickupIds)) {
        stopAlarmPlayback();
        return;
      }
      resumeNotificationAudio();
      playWebAudioAlarmBurst();
      const alarm = getAlarmElement();
      if (alarm?.paused) void alarm.play().catch(() => undefined);
      nagPickupOsBanner();
    }, 1600);
  }
}

function commitPickupAlarm(next: string[]): void {
  pendingPickupIds = next;
  if (pickupAlarmShouldRun(pendingPickupIds)) ensureAlarmPlaying();
  else stopAlarmPlayback();
}

function unlockMediaElement(el: HTMLAudioElement | null): void {
  if (!el) return;
  const previous = el.volume;
  el.volume = 0.001;
  void el
    .play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.volume = previous;
    })
    .catch(() => {
      el.volume = previous;
    });
}

/** Resume audio after a user gesture so later toasts can play without being blocked. */
export function resumeNotificationAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

/**
 * Call synchronously from the login submit handler (still a user gesture).
 * Unlocks Web Audio / HTMLAudio and asks for OS notifications once.
 */
export function primeStaffAlertsFromUserGesture(): void {
  resumeNotificationAudio();
  const ctx = getAudioContext();
  if (ctx) void ctx.resume();
  unlockMediaElement(getChimeElement());
  unlockMediaElement(getAlarmElement());

  const storage = typeof localStorage === 'undefined' ? null : localStorage;
  const permission = notificationPermission();
  if (shouldAskBrowserNotificationPermission(permission, readAlreadyAsked(storage))) {
    markAsked(storage);
    void Notification.requestPermission();
  } else if (permission !== 'default') {
    markAsked(storage);
  }
}

/** Pleasant C–E–G chime. Debounced so a burst of events plays once. */
export function playNotificationChime(): Promise<boolean> {
  const now = Date.now();
  if (now - lastPlayedAt < 450) return Promise.resolve(false);
  lastPlayedAt = now;

  resumeNotificationAudio();
  playWebAudioChime();

  const el = getChimeElement();
  if (!el) return Promise.resolve(false);
  el.currentTime = 0;
  return el.play().then(() => true).catch(() => false);
}

export function notePickupRequested(pickupRequestId: string): void {
  commitPickupAlarm(applyPickupAlarmAction(pendingPickupIds, { kind: 'requested', pickupRequestId }));
}

export function notePickupResolved(pickupRequestId: string): void {
  commitPickupAlarm(applyPickupAlarmAction(pendingPickupIds, { kind: 'resolved', pickupRequestId }));
}

export function syncPendingPickupAlarms(pendingIds: readonly string[]): void {
  commitPickupAlarm(applyPickupAlarmAction(pendingPickupIds, { kind: 'sync', pendingIds }));
}

export function clearPickupAlarms(): void {
  commitPickupAlarm(applyPickupAlarmAction(pendingPickupIds, { kind: 'clear' }));
}

export function getPendingPickupAlarmIds(): string[] {
  return [...pendingPickupIds];
}

export function announceStaffNotification(input: {
  title: string;
  message: string;
  href?: string | null;
  type?: string;
  pickupRequestId?: string | null;
}): void {
  const alarmAction = notificationToPickupAlarmAction(input.type ?? '', input.pickupRequestId);
  if (alarmAction?.kind === 'requested') notePickupRequested(alarmAction.pickupRequestId);
  if (alarmAction?.kind === 'resolved') notePickupResolved(alarmAction.pickupRequestId);

  const playChime = shouldPlayOneShotChime(input.type ?? '');
  const hidden = typeof document !== 'undefined' && document.hidden;
  const permission = notificationPermission();

  const afterSound = (played: boolean) => {
    if (input.type === 'PICKUP_REQUESTED') {
      nagPickupOsBanner();
      return;
    }
    if (!shouldShowOsNotification(permission, hidden)) return;
    const banner = new Notification(input.title, {
      body: input.message,
      icon: '/icon-dark.png',
      tag: 'weepark-staff',
      silent: played,
    });
    banner.onclick = () => {
      window.focus();
      banner.close();
      if (input.href) {
        window.dispatchEvent(new CustomEvent('weepark:notification-open', { detail: input.href }));
      }
    };
  };

  if (playChime) {
    void playNotificationChime().then(afterSound);
    return;
  }
  afterSound(true);
}
