let clickAudio: HTMLAudioElement | null = null;

const CLICK_SOUND = 'data:audio/wav;base64,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';

function isPublicStorefront() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  return !path.startsWith('/admin') && !path.startsWith('/dashboard');
}

function interactiveTarget(event: Event) {
  const origin = event.target;
  if (!(origin instanceof Element)) return null;
  return origin.closest('button:not(:disabled), a[href], [role="button"]');
}

function playClickSound() {
  if (!clickAudio) {
    clickAudio = new Audio(CLICK_SOUND);
    clickAudio.preload = 'auto';
    clickAudio.volume = 0.48;
  }

  try {
    clickAudio.currentTime = 0;
    void clickAudio.play();
  } catch {
    // Browsers may block audio in rare restricted contexts; fail silently.
  }
}

export function installUiSounds() {
  if (typeof document === 'undefined') return;

  const onPointerDown = (event: PointerEvent) => {
    if (!isPublicStorefront() || event.button !== 0) return;
    const target = interactiveTarget(event);
    if (!target || target.closest('[data-ui-sound="off"]')) return;
    playClickSound();
  };

  // Click/press only. No hover or mouse-move audio is installed.
  document.addEventListener('pointerdown', onPointerDown, true);
}
