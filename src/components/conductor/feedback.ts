// Audible + haptic cues for the scanner (playbook S2: "an audible cue"). A
// conductor at a noisy bus door often isn't looking at the screen.
let context: AudioContext | null = null;

function tone(frequency: number, startAt: number, duration: number) {
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.2, context.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + startAt + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(context.currentTime + startAt);
  oscillator.stop(context.currentTime + startAt + duration);
}

export type Cue = "valid" | "already" | "invalid";

export function playCue(cue: Cue): void {
  try {
    context ??= new AudioContext();
    if (cue === "valid") {
      tone(880, 0, 0.12);
      tone(1320, 0.13, 0.18);
    } else if (cue === "already") {
      tone(660, 0, 0.18);
      tone(660, 0.25, 0.18);
    } else {
      tone(220, 0, 0.35);
      tone(180, 0.4, 0.35);
    }
    navigator.vibrate?.(cue === "valid" ? 80 : [200, 100, 200]);
  } catch {
    // Audio can be blocked until the first user gesture — the visual panel still shows.
  }
}
