/**
 * Scene serialization & URL-hash sharing helpers.
 * Uses compact JSON -> Base64URL encoding so entire kinetic music machines
 * can be shared as a single clickable URL.
 */

export function serializeScene(state) {
  return {
    version: 1,
    settings: {
      scaleId: state.settings.scaleId,
      rootMidi: state.settings.rootMidi,
      bpm: state.settings.bpm,
      gravity: state.settings.gravity,
      timeScale: state.settings.timeScale,
      reverbMix: state.settings.reverbMix,
      delayMix: state.settings.delayMix,
    },
    emitters: state.emitters.map((e) => ({
      id: e.id,
      x: Math.round(e.x),
      y: Math.round(e.y),
      angle: Number(e.angle.toFixed(3)),
      speed: Math.round(e.speed),
      beatDiv: e.beatDiv,
      instrument: e.instrument,
      spread: Number((e.spread || 0).toFixed(3)),
      enabled: e.enabled !== false,
    })),
    strings: state.strings.map((s) => ({
      id: s.id,
      x1: Math.round(s.x1),
      y1: Math.round(s.y1),
      x2: Math.round(s.x2),
      y2: Math.round(s.y2),
      instrument: s.instrument,
      restitution: Number((s.restitution ?? 0.92).toFixed(2)),
    })),
    bumpers: state.bumpers.map((b) => ({
      id: b.id,
      x: Math.round(b.x),
      y: Math.round(b.y),
      radius: Math.round(b.radius),
      instrument: b.instrument,
      boost: Number((b.boost ?? 1.12).toFixed(2)),
    })),
    wells: state.wells.map((w) => ({
      id: w.id,
      x: Math.round(w.x),
      y: Math.round(w.y),
      strength: Math.round(w.strength),
      radius: Math.round(w.radius),
    })),
    portals: state.portals.map((p) => ({
      id: p.id,
      pairId: p.pairId,
      x: Math.round(p.x),
      y: Math.round(p.y),
      radius: Math.round(p.radius),
      color: p.color,
      pitchShift: p.pitchShift || 0,
    })),
    prisms: state.prisms.map((pr) => ({
      id: pr.id,
      x: Math.round(pr.x),
      y: Math.round(pr.y),
      radius: Math.round(pr.radius),
      instrument: pr.instrument,
    })),
  };
}

export function encodeSceneToHash(scene) {
  const json = JSON.stringify(scene);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `#scene=${b64}`;
}

export function decodeSceneFromHash(hash) {
  if (!hash || !hash.includes('scene=')) return null;
  const match = hash.match(/scene=([A-Za-z0-9_-]+)/);
  if (!match) return null;
  try {
    let b64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}
