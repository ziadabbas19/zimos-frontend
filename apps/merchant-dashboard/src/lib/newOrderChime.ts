/**
 * The new-order chime: two short notes from the Web Audio API, so there is no
 * sound file to ship. Browsers only allow audio after the person has
 * interacted with the page; before that the call fails silently.
 *
 * Whether it may ring is the teammate's own choice, saved with their
 * notification settings (Settings → My notifications, `soundEnabled`). The
 * bell reads it with every summary it asks for and keeps it here, so the live
 * updates (components/LiveUpdates) follow the same choice.
 */

let soundEnabled = false;

export function rememberSoundSetting(enabled: boolean): void {
  soundEnabled = enabled;
}

export function soundSetting(): boolean {
  return soundEnabled;
}

export function playChime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const note = (frequency: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.3);
    };
    note(880, 0);
    note(1174.66, 0.16);
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // No audio device or not allowed yet: the badge still updates.
  }
}
