let audioContext: AudioContext | null = null;
let hoverUnlocked = false;
let lastHoverAt = 0;

function isPublicStorefront() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  return !path.startsWith('/admin') && !path.startsWith('/dashboard');
}

async function ensureAudioContext() {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return null;

  if (!audioContext) audioContext = new AudioContextCtor();

  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch {
      return null;
    }
  }

  return audioContext.state === 'running' ? audioContext : null;
}

async function playTone({
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
  const context = await ensureAudioContext();
  if (!context) return;

  const start = context.currentTime + delay;
  const end = start + duration;
  const oscillator = context.createOscillator();
  const volume = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), end);

  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.014, duration / 3));
  volume.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.012);
}

async function playClickSound() {
  await Promise.all([
    playTone({ from: 390, to: 560, duration: 0.065, gain: 0.028, type: 'triangle' }),
    playTone({ from: 920, to: 760, duration: 0.042, gain: 0.008, type: 'sine', delay: 0.008 }),
  ]);
}

async function playHoverSound() {
  const now = performance.now();
  if (now - lastHoverAt < 120) return;
  lastHoverAt = now;

  await playTone({ from: 690, to: 820, duration: 0.045, gain: 0.011, type: 'sine' });
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
    void playClickSound();
  };

  const onMouseOver = (event: MouseEvent) => {
    if (!hoverUnlocked || !isPublicStorefront()) return;
    const origin = event.target;
    if (!(origin instanceof Element)) return;

    const target = origin.closest('header nav button, header nav a, [data-ui-hover-sound="true"]');
    if (!target || target.closest('[data-ui-sound="off"]')) return;

    const previous = event.relatedTarget;
    if (previous instanceof Node && target.contains(previous)) return;
    void playHoverSound();
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('mouseover', onMouseOver, true);
}
