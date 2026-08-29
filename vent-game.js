export const VENT_GOAL = 30;
export const COMBO_WINDOW_MS = 780;

function normalizeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

export function createVentState(saved = {}) {
  const totalHits = normalizeInteger(saved.totalHits);
  const combo = normalizeInteger(saved.combo);
  const bestCombo = Math.max(normalizeInteger(saved.bestCombo), combo);
  const lastHit = normalizeInteger(saved.lastHit);
  return {
    totalHits,
    combo,
    bestCombo,
    lastHit,
    progress: Math.min(1, totalHits / VENT_GOAL),
    complete: totalHits >= VENT_GOAL,
  };
}

export function registerVentHit(state, { power = 1, now = Date.now() } = {}) {
  const hitPower = Math.max(1, normalizeInteger(power, 1));
  const continued = state.totalHits > 0 && now - state.lastHit < COMBO_WINDOW_MS;
  const combo = continued ? state.combo + hitPower : hitPower;
  const totalHits = state.totalHits + hitPower;
  return {
    totalHits,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    lastHit: now,
    progress: Math.min(1, totalHits / VENT_GOAL),
    complete: totalHits >= VENT_GOAL,
  };
}

export function resetVentRound(state) {
  return createVentState({ bestCombo: state.bestCombo });
}
