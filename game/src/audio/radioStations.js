// Procedural radio: three stations, each a seeded chord + bass + arp pattern
// played on WebAudio oscillators. No audio files — everything is synthesized,
// so the game stays offline and tiny. Track names rotate every 24 seconds.
import { RADIO } from '../config.js';
import { makeRng } from '../random.js';

export function createRadioStations(audioCtx) {
  const stations = RADIO.map((def, i) => ({
    ...def,
    rng: makeRng(1000 + i * 77),
    trackIndex: 0,
  }));
  let current = 0;
  let nextNoteTime = 0;
  let step = 0;
  let master = null;
  let trackTimer = 0;

  function noteFreq(root, semitone) {
    return root * Math.pow(2, semitone / 12);
  }

  function playNote(freq, time, dur, type, gain) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function scheduleStep(st, time) {
    const beat = 60 / st.bpm / 2; // eighth notes
    const scale = st.scale;
    const bar = Math.floor(step / 8) % 4;
    const chordRoot = [0, 5, 7, 3][bar];
    // Bass on beats 0 and 4.
    if (step % 4 === 0) playNote(noteFreq(st.root, chordRoot), time, beat * 3.5, 'sine', 0.22);
    // Arp: pick from the scale, weighted to the chord.
    const semis = [chordRoot, chordRoot + scale[step % scale.length], chordRoot + 12];
    playNote(noteFreq(st.root * 4, st.rng.pick(semis)), time, beat * 0.9, st.wave, 0.05);
    // Hat tick.
    if (step % 2 === 1) playNote(6000, time, 0.04, 'square', 0.012);
    step += 1;
    return beat;
  }

  return {
    start() {
      if (!audioCtx) return;
      master = audioCtx.createGain();
      master.gain.value = 0.5;
      master.connect(audioCtx.destination);
      nextNoteTime = audioCtx.currentTime + 0.1;
    },
    update(dt) {
      if (!audioCtx || !master) return;
      const st = stations[current];
      const beat = 60 / st.bpm / 2;
      while (nextNoteTime < audioCtx.currentTime + 0.15) {
        scheduleStep(st, nextNoteTime);
        nextNoteTime += beat;
      }
      trackTimer += dt;
      if (trackTimer > 24) {
        trackTimer = 0;
        st.trackIndex = (st.trackIndex + 1) % st.tracks.length;
      }
    },
    nextStation() {
      current = (current + 1) % stations.length;
      step = 0;
      return stations[current];
    },
    currentStation() { return stations[current]; },
    currentTrack() { return stations[current].tracks[stations[current].trackIndex]; },
  };
}
