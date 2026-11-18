// Audio engine: one WebAudio context (created on the first user gesture),
// synthesized sound effects (shots, cash, sirens, stingers) and the procedural
// radio. Everything is guarded so headless capture without audio still works.
import { createRadioStations } from './radioStations.js';

export function createAudio() {
  let ctx = null;
  let radio = null;
  let radioOn = true;
  let engineOsc = null;
  let engineGain = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      radio = createRadioStations(ctx);
      radio.start();
      // Engine hum: two detuned saws through a lowpass, gain follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
    } catch (_e) {
      ctx = null;
    }
    return ctx;
  }

  function blip(freq, dur, type, gain, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  const STINGERS = {
    shot: () => { blip(220, 0.12, 'square', 0.16, 60); },
    punch: () => { blip(140, 0.1, 'sine', 0.25, 70); },
    reload: () => { blip(600, 0.06, 'square', 0.08); setTimeout(() => blip(900, 0.06, 'square', 0.08), 90); },
    cash: () => { blip(880, 0.1, 'sine', 0.14); setTimeout(() => blip(1320, 0.14, 'sine', 0.14), 90); },
    stage: () => { blip(660, 0.12, 'triangle', 0.16); setTimeout(() => blip(990, 0.18, 'triangle', 0.16), 110); },
    go: () => { blip(440, 0.15, 'square', 0.12); setTimeout(() => blip(880, 0.3, 'square', 0.12), 150); },
    siren: () => { blip(700, 0.5, 'sine', 0.1, 1100); setTimeout(() => blip(1100, 0.5, 'sine', 0.1, 700), 500); },
    clear: () => { blip(520, 0.2, 'sine', 0.12, 780); },
    fail: () => { blip(330, 0.4, 'sawtooth', 0.12, 110); },
  };

  return {
    get radioOn() { return radioOn && !!ctx; },
    ensure,
    stinger(name) {
      if (!ctx) return;
      const fn = STINGERS[name];
      if (fn) fn();
    },
    currentStation() {
      return radio ? radio.currentStation() : { name: 'RADIO', tracks: ['—'] };
    },
    currentTrack() {
      return radio ? radio.currentTrack() : '—';
    },
    toggleRadio() {
      radioOn = !radioOn;
      if (radio && ctx) {
        // Radio keeps scheduling; mute by toggling the master via a flag is
        // simplest: recreate gain is overkill — just stop/start scheduling.
        if (!radioOn) radio.suspended = true;
        else radio.suspended = false;
      }
      return radioOn;
    },
    nextStation() {
      if (radio) return radio.nextStation();
      return null;
    },
    update(dt, speedKmh, inCar) {
      if (!ctx) return;
      if (radioOn && radio && !radio.suspended) radio.update(dt);
      if (engineGain && engineOsc) {
        const target = inCar ? 0.02 + Math.min(0.06, speedKmh / 2000) : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(45 + speedKmh * 1.1, ctx.currentTime, 0.1);
      }
    },
  };
}
