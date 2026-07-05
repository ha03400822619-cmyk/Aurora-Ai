/**
 * Subtle “system boot” audio — Web Audio only, no assets.
 * Must run from a user gesture (button click).
 */
export function playWorkspaceEntrySound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    master.connect(ctx.destination);

    const noise = ctx.createBufferSource();
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) {
      ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    }
    noise.buffer = noiseBuf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(4200, now + 0.12);
    noiseFilter.frequency.exponentialRampToValueAtTime(900, now + 0.32);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.06, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    noise.connect(noiseFilter);
    noiseFilter.connect(ng);
    ng.connect(master);
    noise.start(now);
    noise.stop(now + 0.36);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.22);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, now + 0.05);
    og.gain.exponentialRampToValueAtTime(0.06, now + 0.1);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc.connect(og);
    og.connect(master);
    osc.start(now + 0.05);
    osc.stop(now + 0.58);

    ctx.resume?.();
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    }, 900);
  } catch {
    /* ignore */
  }
}
