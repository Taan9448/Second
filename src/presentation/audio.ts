let context: AudioContext | undefined;
export function playCue(kind: 'card' | 'damage' | 'heal', volume: number): void {
  if (volume <= 0) return;
  try {
    context ??= new AudioContext();
    void context.resume();
    const now = context.currentTime,
      osc = context.createOscillator(),
      gain = context.createGain();
    osc.type = kind === 'damage' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(kind === 'heal' ? 660 : kind === 'card' ? 330 : 140, now);
    osc.frequency.exponentialRampToValueAtTime(
      kind === 'heal' ? 880 : kind === 'card' ? 550 : 50,
      now + 0.16,
    );
    gain.gain.setValueAtTime(volume * 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  } catch {
    /* A browser without audio can still play. */
  }
}
