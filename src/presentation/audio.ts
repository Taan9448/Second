let context: AudioContext | undefined;
export function playCue(
  kind: 'card' | 'damage' | 'heal' | 'swing' | 'guard',
  volume: number,
  heavy = false,
): void {
  if (volume <= 0) return;
  try {
    context ??= new AudioContext();
    void context.resume();
    const audio = context,
      now = audio.currentTime;
    const output = audio.createGain();
    output.gain.value = volume * 0.5;
    output.connect(audio.destination);
    const duration = kind === 'swing' ? 0.19 : kind === 'damage' ? 0.22 : 0.3;
    const osc = audio.createOscillator(),
      gain = audio.createGain();
    osc.type = kind === 'damage' ? 'triangle' : 'sine';
    const pitch =
      kind === 'damage'
        ? heavy
          ? 100
          : 170
        : kind === 'guard'
          ? 420
          : kind === 'heal'
            ? 620
            : 340;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(
      kind === 'damage' ? 38 : pitch * 1.4,
      now + duration,
    );
    gain.gain.setValueAtTime(kind === 'swing' ? 0.03 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    if (kind === 'damage' || kind === 'swing' || kind === 'guard') {
      const buffer = audio.createBuffer(
        1,
        Math.ceil(audio.sampleRate * duration),
        audio.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const noise = audio.createBufferSource(),
        filter = audio.createBiquadFilter(),
        envelope = audio.createGain();
      noise.buffer = buffer;
      filter.type = kind === 'swing' ? 'bandpass' : 'highpass';
      filter.frequency.setValueAtTime(kind === 'swing' ? 2200 : 900, now);
      if (kind === 'swing') filter.frequency.exponentialRampToValueAtTime(500, now + duration);
      envelope.gain.setValueAtTime(kind === 'swing' ? 0.18 : heavy ? 0.36 : 0.25, now);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      noise.connect(filter);
      filter.connect(envelope);
      envelope.connect(output);
      noise.start(now);
      noise.stop(now + duration);
    }
    // Disconnect completed graphs rather than accumulate idle audio nodes.
    osc.onended = () => output.disconnect();
  } catch {
    /* Audio is optional; a blocked audio context never blocks a combat command. */
  }
}
