/**
 * Critical alert alarm.
 *
 * The repository ships no audio asset, so the alarm is synthesised with the
 * Web Audio API: two alternating tones repeated for a few seconds. That keeps
 * it dependency-free and tunable, and it works in a WebView as well as a
 * desktop browser.
 *
 * Why it is not an <audio> element with a loop:
 *  - autoplay policies block audio until the user has interacted with the page,
 *    and the browser reports that as a rejected play() promise rather than by
 *    throwing, so the caller needs the promise to offer "Enable sound";
 *  - the alarm must stop the moment the component unmounts, and a synthesised
 *    oscillator plus its gain envelope is trivial to cancel, whereas a media
 *    element can keep playing off-screen.
 *
 * The alarm is deliberately event driven: `play()` is called once per newly
 * announced alert by useAlertAlarm, never from render or from the poll loop.
 */

const TONE_A = 880;
const TONE_B = 660;
const TONE_MS = 180;
const GAP_MS = 90;

/** Two cycles of two tones: enough to be noticed, short enough not to nag. */
const DEFAULT_PATTERN = 4;

// Resolved on demand rather than at module load: a WebView may install the
// constructor after the bundle has been evaluated, and the tests swap it.
function audioContextCtor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

/** True when this browser can synthesise sound at all. */
export function audioSupported() {
  return Boolean(audioContextCtor());
}

export function createAlarm({ pattern = DEFAULT_PATTERN, createContext } = {}) {
  const factory = createContext ?? (() => {
    const Ctor = audioContextCtor();
    return Ctor ? new Ctor() : null;
  });
  let context = null;
  let stopTimer = null;
  let playing = false;
  let muted = false;

  /** Creates the context lazily and resumes it if the browser suspended it. */
  async function ensureContext() {
    if (!context) context = factory();
    if (context && context.state === 'suspended' && typeof context.resume === 'function') {
      await context.resume();
    }
    return context;
  }

  function tone(frequency, startAt, durationMs) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    // A short attack/release avoids the click an abrupt stop produces.
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.2, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + durationMs / 1000 + 0.02);
  }

  /**
   * Plays the alarm once.
   *
   * Resolves to 'played', 'muted' (the officer turned sound off) or 'blocked'
   * (the browser refused to start audio until the user interacts). It never
   * throws: a rejected alarm must not take the dashboard down with it.
   */
  async function play() {
    if (muted) return 'muted';
    if (stopTimer) return 'playing';

    let ctx;
    try {
      ctx = await ensureContext();
    } catch {
      return 'blocked';
    }
    if (!ctx) return 'blocked';
    // resume() rejects when the page has had no user gesture yet.
    if (ctx.state === 'suspended') return 'blocked';

    const stepSeconds = (TONE_MS + GAP_MS) / 1000;
    const now = ctx.currentTime + 0.02;
    for (let index = 0; index < pattern; index += 1) {
      const startAt = now + index * stepSeconds;
      tone(index % 2 === 0 ? TONE_A : TONE_B, startAt, TONE_MS);
    }

    playing = true;
    stopTimer = setTimeout(() => {
      playing = false;
      stopTimer = null;
    }, pattern * (TONE_MS + GAP_MS) + 120);
    return 'played';
  }

  /** Cancels the alarm and closes the audio context, so nothing keeps sounding. */
  async function stop() {
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    playing = false;
    if (context && typeof context.close === 'function') {
      try {
        await context.close();
      } catch {
        // Already closed.
      }
      context = null;
    }
  }

  function setMuted(next) {
    muted = Boolean(next);
    if (muted) {
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = null;
      playing = false;
    }
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function isPlaying() {
    return playing;
  }

  return { play, stop, setMuted, isMuted, isPlaying };
}

export const ALARM_PATTERN_LENGTH = DEFAULT_PATTERN;