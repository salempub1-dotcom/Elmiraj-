let soundUnlocked = false;
let lastHoverAt = 0;
let clickAudio: HTMLAudioElement | null = null;
let hoverAudio: HTMLAudioElement | null = null;

const CLICK_SOUND = 'data:audio/wav;base64,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';
const HOVER_SOUND = 'data:audio/wav;base64,UklGRqQHAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YYAHAAAAAO8GUw2xEqIW2xgyGaEXSRRrD2cJsQLP+0P1j+8g607oTucy6OjqOe/Q9D77AgKaCIEORBOFFgYYqBd1FZoRZAw8Bp//DvkP8xnujuq16LHoguoC7ury1PhK/8cFyQvXEIoUmBbZFkgVBhJYDZ4HTgHq+vT05u8p7AfqrOke6z3uyfJh+JL+2QS2Cq8PXBNyFccVVRQ7EbwMNgcfAfj6P/Vv8Ovs/urO6l/sje8V9JX5l/+bBSILtw/3Ep8UjRTDEmgPxwpDBVT/evky9O7vCu3D6zPsUO7q8bL2P/wYAr0HtAyPEP0SyRPiEl4QdgyAB+oBMfzR9kLy5+4L7dTsR+5B8YD1pPo5AMMFxwrVDpIRwxJNEj4QxAwvCOYCY/0h+JXzKPAl7rrt7e6j8Zz1ffrW/y0FBwr4DaMQzxFhEWUPCQycB4QCOv00+OnzuvDx7rXuCvDR8sf2kPu5AMwFUgrhDSgQ8RArEOwNZwryBfYA6vtE93LzzfCT7+DvrPHJ9O74tv2uAmEHXgtGDtUP6A98DrcL2wdHA2v+uvmm9ZHyxfBr8IzxCvSo9wz8yQBvBYoJtwyqDjMPSA7/C5MIWQS6/yb7EPfc89fxM/H+8SP0bPeF+wcAhASLCLcLuw1mDqgNlQtiCGEE+f+W+6j3kfSe8gDyxPLW9P/37/tBAIcEVAhICxkNmg2/DJ8KcweMA1H/LPuI98P0I/PQ8tLzDfZF+Sj9TQFNBb0IRgumDLsMhQskCdgF+AHq/Rj65van9JXzy/NC9dH3NfsS/wIDnQaFCWwLIQyUC9MJEAeVA8D/9/uf+BD2kPRD9DL1Qvc5+sf9iwEhBSgITQpZCzEL2gl6B1IEugAU/cP5IPdz9ej0jvVQ9/35S/3dAFMETQd6CZ4KnQp2CUwHXAT3AH79T/rC9x/2kPUl9sz3Vfp4/dsAIwTyBvkIAgrwCcgIqQbTA5UATf1W+gP4lvY29uz2ovgn+zH+agF1BP0GuQh5CSkJ1AegBc8Csv+j/Pn5Afjz9uz26vfR+Wf8Yf9oAiQFRweSCOIILwiOBjIEXgFo/qb7Z/nt92P31/c6+WH7Df7tAK4D/QWXB04IDQjfBuYEYAKY/+D8i/rc+AX4Hvgi+fP6V/0FALACBAW+BqoHrQfJBhkF0wI8AKP9VfuZ+aP4jvhc+fL6H/2g/ycCaAQeBhYHMwd0Bu8E1gJqAPb9xfsb+in5DfnI+UH7S/2l/wQCIQS6BZ0GsQb0BX8EgAI3AO395/tm+pf5lPla+tD7x/0AADQCHwSEBTcGJAZPBdMD4QG4/5z9z/uN+vr5KfoS+5f8hv6fAKACSgRmBdIFggWBBPICBgH//hv9mfup+mj63fr3+5P9ef9sAS0DgwRCBVQFuASDA90B//8k/or8Zvvc+vz6wfsR/b7+kABNArkDpwT4BKMEtgNPAp4A3v5H/Q78XPtH+9D74/xd/gkAsQEcAxsEjgRmBKoDdALuAE7/yP2R/NH7ofsG/PL8Qv7L/1cBsQKtAygEFAR1A2AC/gB9/xH+6/wy/P77Vfwp/V3+x/8zAXQCXAPNA7kDJAMkAtsAef8t/iP9gPxZ/LL8fv2g/u//OwFaAiMDfANYA8ACyAGUAFD/Jv5C/cH8tfwe/ez9Af82AGEBVwL4AiwD7gJJAlMBMQAM/wz+Vf0A/Rj9mP1t/nn/lACXAV4CzALVAnYCvwHMAL//vf7t/Wv9Sf2K/ST+AP/+//kAzQFdApQCbALrASYBOABH/3L+2f2S/ab9EP7B/p7/hQBWAfMBRgJDAuwBTgGCAKb/2v47/uH92P0f/qz+af85AP4AmwH5AQwC0QFSAaMA4P8j/4r+Kv4R/kP+tf5X/w8AwwBXAbYB0QGnAT8BqAD7/1H/xP5o/kv+cP7R/l7/AACgACYBfQGZAXcBHAGYAAAAaf/s/pv+gv6j/vn+df8EAJAABAFPAWQBQwHxAHsA9f9z/wj/xv61/tj+J/+X/xQAjADtACcBMgEOAcAAVgDh/3P/Hf/r/ub+Dv9a/7//KwCPANsAAgEBAdcAjAAtAMn/cP8u/xD/GP9E/43/5/9CAJIAyADeANAAoQBZAAUAs/9u/0L/Nf9K/3r/wP8NAFcAkQCyALcAnQBrACkA4/+i/3L/W/9e/3z/rf/t/ywAYwCIAJcAjABrADkAAADI/5v/f/95/4r/rf/d/xEAQQBlAHcAdQBgADwADwDi/7r/n/+V/53/tf/Z/wEAKQBIAFsAXQBQADYAFADx/9D/uf+u/7L/w//d//z/GgAzAEMARwA+ACwAEwD4/9//zf/E/8b/0f/k//v/EQAkADAAMwAtACAADgD8/+r/3f/W/9f/3//t//3/CwAYACAAIgAeABUACQD9//H/6f/l/+b/7P/0////CAAQABQAFQASAAwABAD9//f/8v/w//H/9f/7/wAABQAJAAsACwAJAAUAAQD+//v/+f/5//r//P/+/wAAAgAEAAQABAADAAEAAAD///7//v/+//////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function isPublicStorefront() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  return !path.startsWith('/admin') && !path.startsWith('/dashboard');
}

function getClickAudio() {
  if (!clickAudio) {
    clickAudio = new Audio(CLICK_SOUND);
    clickAudio.preload = 'auto';
    clickAudio.volume = 0.52;
  }
  return clickAudio;
}

function getHoverAudio() {
  if (!hoverAudio) {
    hoverAudio = new Audio(HOVER_SOUND);
    hoverAudio.preload = 'auto';
    hoverAudio.volume = 0.30;
  }
  return hoverAudio;
}

function play(audio: HTMLAudioElement) {
  try {
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  } catch {
    // Audio feedback is enhancement-only; never interfere with store actions.
  }
}

function interactiveTarget(event: Event) {
  const origin = event.target;
  if (!(origin instanceof Element)) return null;
  return origin.closest('button:not(:disabled), a[href], [role="button"], input[type="submit"]');
}

function hoverTarget(event: Event) {
  const origin = event.target;
  if (!(origin instanceof Element)) return null;
  return origin.closest(
    'header nav button, header nav a, main section, main article, main .group, [data-ui-hover-sound="true"]',
  );
}

export function installUiSounds() {
  if (typeof document === 'undefined') return;

  // Prime the embedded sounds early. They are tiny data URIs and make no network request.
  getClickAudio();
  getHoverAudio();

  const onPointerDown = (event: PointerEvent) => {
    if (!isPublicStorefront() || event.button !== 0) return;
    const target = interactiveTarget(event);
    if (!target || target.closest('[data-ui-sound="off"]')) return;

    // This play() happens directly inside the user's gesture, which reliably unlocks
    // audio in Chrome/Safari/Edge. Subsequent hover cues can then play normally.
    soundUnlocked = true;
    play(getClickAudio());
  };

  const onMouseOver = (event: MouseEvent) => {
    if (!soundUnlocked || !isPublicStorefront()) return;

    const target = hoverTarget(event);
    if (!target || target.closest('[data-ui-sound="off"]')) return;

    const previous = event.relatedTarget;
    if (previous instanceof Node && target.contains(previous)) return;

    const now = performance.now();
    if (now - lastHoverAt < 145) return;
    lastHoverAt = now;
    play(getHoverAudio());
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('mouseover', onMouseOver, true);
}
