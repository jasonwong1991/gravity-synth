/**
 * Musical Harmony & Scale Engine
 * Ensures every collision in GravitySynth produces consonant, expressive music.
 */

export const ROOT_NOTES = [
  { name: 'C', midi: 48 },
  { name: 'D', midi: 50 },
  { name: 'Eb', midi: 51 },
  { name: 'E', midi: 52 },
  { name: 'F', midi: 53 },
  { name: 'G', midi: 55 },
  { name: 'A', midi: 57 },
  { name: 'Bb', midi: 58 },
];

export const SCALES = {
  pentatonic: {
    id: 'pentatonic',
    name: 'Major Pentatonic',
    nameZh: '星辰五声 (Major Pentatonic)',
    mood: 'Bright & Uplifting',
    moodZh: '明亮治愈',
    intervals: [0, 2, 4, 7, 9],
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Minor',
    nameZh: '赛博小调 (Cyberpunk Minor)',
    mood: 'Sci-Fi & Moody',
    moodZh: '科幻深邃',
    intervals: [0, 2, 3, 7, 10],
  },
  lydian: {
    id: 'lydian',
    name: 'Dream Lydian',
    nameZh: '梦境利底亚 (Dream Lydian)',
    mood: 'Ethereal & Cosmic',
    moodZh: '飘渺奇幻',
    intervals: [0, 2, 4, 6, 7, 9, 11],
  },
  hirajoshi: {
    id: 'hirajoshi',
    name: 'Zen Hirajoshi',
    nameZh: '竹林禅音 (Hirajoshi)',
    mood: 'Serene & Zen',
    moodZh: '东方空灵',
    intervals: [0, 2, 3, 7, 8],
  },
  lofi: {
    id: 'lofi',
    name: 'Lo-Fi Maj9 Chill',
    nameZh: 'Lo-Fi 爵士 (Maj9 Chill)',
    mood: 'Warm & Nostalgic',
    moodZh: '慵懒复古',
    intervals: [0, 2, 4, 7, 11],
  },
  wholeTone: {
    id: 'wholeTone',
    name: 'Cosmic Whole-Tone',
    nameZh: '量子全音 (Cosmic Whole-Tone)',
    mood: 'Hypnotic & Sci-Fi',
    moodZh: '星际迷幻',
    intervals: [0, 2, 4, 6, 8, 10],
  },
};

export const INSTRUMENTS = {
  crystal: { id: 'crystal', name: 'Crystal Bell', nameZh: '水晶风铃', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.7)' },
  pluck: { id: 'pluck', name: 'Neon Harp', nameZh: '霓虹竖琴', color: '#a855f7', glow: 'rgba(168, 85, 247, 0.7)' },
  synth: { id: 'synth', name: 'Cyber Synth', nameZh: '赛博合成', color: '#f43f5e', glow: 'rgba(244, 63, 94, 0.7)' },
  kalimba: { id: 'kalimba', name: 'Zen Kalimba', nameZh: '空灵拇指琴', color: '#34d399', glow: 'rgba(52, 211, 153, 0.7)' },
  drum: { id: 'drum', name: 'Pulse Drums', nameZh: '脉冲鼓点', color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.75)' },
};

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Convert MIDI note number to frequency in Hz (A4 = 440Hz, MIDI 69).
 */
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Format MIDI note into readable label like "C4" or "Eb5".
 */
export function midiToLabel(midi) {
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${name}${octave}`;
}

/**
 * Map a normalized value [0, 1] (for example, string length or bumper radius)
 * into a quantized MIDI note in the selected scale & root across ~2.5 octaves.
 * Shorter strings / smaller bumpers produce higher pitches!
 */
export function normalizedToMidi(norm, scaleId = 'pentatonic', rootMidi = 48, octaveSpan = 2.4) {
  const scale = SCALES[scaleId] || SCALES.pentatonic;
  const clamped = Math.max(0, Math.min(1, norm));
  const totalDegrees = Math.max(1, Math.round(scale.intervals.length * octaveSpan));
  const degreeIndex = Math.round(clamped * (totalDegrees - 1));
  const octave = Math.floor(degreeIndex / scale.intervals.length);
  const interval = scale.intervals[degreeIndex % scale.intervals.length];
  return rootMidi + octave * 12 + interval;
}

/**
 * Map physical length (e.g. string length in pixels) to a musical MIDI note.
 * Shorter length -> higher pitch, longer length -> deeper bass pitch.
 */
export function lengthToMidi(lengthPx, scaleId = 'pentatonic', rootMidi = 48) {
  const minLen = 45;
  const maxLen = 380;
  const clamped = Math.max(minLen, Math.min(maxLen, lengthPx));
  // Invert so shorter = 1.0 (high note), longer = 0.0 (low note)
  const norm = 1 - (clamped - minLen) / (maxLen - minLen);
  return normalizedToMidi(norm, scaleId, rootMidi, 2.6);
}

/**
 * Map bumper radius (in px) to MIDI note. Smaller bumper -> higher chime.
 */
export function radiusToMidi(radiusPx, scaleId = 'pentatonic', rootMidi = 48) {
  const minR = 14;
  const maxR = 54;
  const clamped = Math.max(minR, Math.min(maxR, radiusPx));
  const norm = 1 - (clamped - minR) / (maxR - minR);
  return normalizedToMidi(norm, scaleId, rootMidi, 2.2);
}

/**
 * Return a vivid neon HSL color derived from MIDI pitch class and optional instrument hue bias.
 */
export function pitchToColor(midi, instrument = 'crystal') {
  if (instrument === 'drum') return INSTRUMENTS.drum.color;
  const pitchClass = ((Math.round(midi) % 12) + 12) % 12;
  const baseOffsets = {
    crystal: 185,
    pluck: 265,
    synth: 330,
    kalimba: 145,
  };
  const offset = baseOffsets[instrument] ?? 200;
  const hue = (offset + pitchClass * 11) % 360;
  return `hsl(${hue}, 92%, 66%)`;
}
