let audioContext: AudioContext | null = null;
let hoverUnlocked = false;
let lastHoverAt = 0;

function isPublicStorefront() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  return !path.startsWith('/admin') && !path.startsWith('/dashboard');
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return null;

  if (!audioContext) audioContext = new AudioContextCtor();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

function playTone({
  from,
  to,
  duration,
  gain,
  type = 'sine',
  delay = 0,
}: {
  from: number;
  to: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  delay?: number;
}) {
  const context = getAudioContext();
  if (!context) return;

  const start = context.currentTime + delay;
  const end = start + duration;
  const oscillator = context.createOscillator();
  const volume = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), end);

  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.012, duration / 3));
  volume.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.01);
}

function playClickSound() {
  // A short, soft two-layer tick. Kept deliberately quiet so it feels tactile,
  // not like a notification sound.
  playTone({ from: 430, to: 610, duration: 0.05, gain: 0.010, type: 'triangle' });
  playTone({ from: 880, to: 740, duration: 0.035, gain: 0.0028, type: 'sine', delay: 0.006 });
}

function playHoverSound() {
  const now = performance.now();
  if (now - lastHoverAt < 95) return;
  lastHoverAt = now;
  playTone({ from: 720, to: 810, duration: 0.032, gain: 0.0032, type: 'sine' });
}

function interactiveTarget(event: Event) {
  const origin = event.target;
  if (!(origin instanceof Element)) return null;
  return origin.closest('button:not(:disabled), a[href], [role="button"]');
}

export function installUiSounds() {
  if (typeof document === 'undefined') return;

  const onPointerDown = (event: PointerEvent) => {
    if (!isPublicStorefront() || event.button !== 0) return;
    const target = interactiveTarget(event);
    if (!target || target.closest('[data-ui-sound="off"]')) return;

    hoverUnlocked = true;
    playClickSound();
  };

  const onPointerOver = (event: PointerEvent) => {
    if (!hoverUnlocked || !isPublicStorefront() || event.pointerType !== 'mouse') return;
    const origin = event.target;
    if (!(origin instanceof Element)) return;

    const target = origin.closest('header nav button, header nav a, [data-ui-hover-sound="true"]');
    if (!target || target.closest('[data-ui-sound="off"]')) return;

    const previous = event.relatedTarget;
    if (previous instanceof Node && target.contains(previous)) return;
    playHoverSound();
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerover', onPointerOver, true);
}
