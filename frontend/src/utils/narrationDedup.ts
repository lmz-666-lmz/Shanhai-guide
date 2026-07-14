/**
 * Trip-level narration deduplication.
 *
 * Every automatic narration key = `${tripId}:${spotKey}`.
 * spotKey is produced by `getNarrationSpotKey(spot)` so that
 * number ids and fallback name+coord ids never collide.
 *
 * Survives React re-renders and MapPage remounts via sessionStorage.
 */

export interface NarrationRecord {
  spotKey: string;
  spotId: string;
  triggeredAt: number;
  source: 'nearby' | 'arrival';
  popupShown: boolean;
  speechStarted: boolean;
}

export interface NarrationAttemptResult {
  allowed: boolean;
  spotKey: string;
  reason?: 'missing-trip' | 'already-narrated' | 'in-flight' | 'ambient-cooldown';
  record?: NarrationRecord;
}

type SpotLike = {
  id?: string | number | null;
  spotName?: string | null;
  name?: string | null;
  title?: string | null;
  longitude?: string | number | null;
  latitude?: string | number | null;
  lng?: string | number | null;
  lat?: string | number | null;
};

// ---- module-level state (singleton — shared by MapPage + DigitalHumanContext) ----

const _narrated = new Map<string, NarrationRecord>();
const _inFlight = new Set<string>();
let _lastAmbientAt = 0;
const AMBIENT_COOLDOWN_MS = 25_000;

// ---- spot key ----

/** Normalise a CampusSpot (or spot-like object) into a stable string key. */
export function getNarrationSpotKey(spot: SpotLike | null | undefined): string {
  const rawId = spot?.id;
  const idText = rawId == null ? '' : String(rawId).trim();
  const idNumber = Number(idText);
  const isTemporaryId = !idText
    || (Number.isFinite(idNumber) && idNumber <= 0)
    || /^(temp|tmp|demo|manual|start|current|当前位置|演示起点|自选起点)/i.test(idText);
  if (!isTemporaryId) return `id:${idText}`;

  const normalizedName = (spot?.spotName || spot?.name || spot?.title || 'unknown')
    .trim()
    .replace(/\s+/g, ' ');
  const safeCoord = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(6) : '0.000000';
  };
  const lng = safeCoord(spot?.longitude ?? spot?.lng);
  const lat = safeCoord(spot?.latitude ?? spot?.lat);
  return `geo:${normalizedName}:${lng}:${lat}`;
}

function tripSpotKey(tripId: string, spot: SpotLike | null | undefined): string {
  return `${tripId}:${getNarrationSpotKey(spot)}`;
}

// ---- sessionStorage helpers ----

function storageKey(tripId: string) {
  return `shanhai_narrated_spots_${tripId}`;
}

function loadFromStorage(tripId: string): void {
  try {
    const raw = sessionStorage.getItem(storageKey(tripId));
    if (!raw) return;
    const list = JSON.parse(raw) as Array<{ k: string; v: NarrationRecord }>;
    if (!Array.isArray(list)) return;
    for (const { k, v } of list) {
      if (typeof k === 'string' && v && !_narrated.has(k)) _narrated.set(k, v);
      const legacySpotId = (v as Partial<NarrationRecord> | undefined)?.spotId;
      if (typeof k === 'string' && legacySpotId && !String(legacySpotId).startsWith('id:')) {
        const migratedKey = `${tripId}:id:${legacySpotId}`;
        if (!_narrated.has(migratedKey)) {
          _narrated.set(migratedKey, { ...v, spotKey: `id:${legacySpotId}`, spotId: String(legacySpotId) });
        }
      }
    }
  } catch { /* ignore corrupt data */ }
}

function saveToStorage(tripId: string): void {
  const entries: Array<{ k: string; v: NarrationRecord }> = [];
  for (const [k, v] of _narrated) {
    if (k.startsWith(`${tripId}:`)) entries.push({ k, v });
  }
  try {
    sessionStorage.setItem(storageKey(tripId), JSON.stringify(entries));
  } catch { /* quota exceeded — silently ignore */ }
}

// ---- public API ----

export const narrationDedup = {
  /** Call once when a trip session is (re)activated to restore prior state. */
  initTrip(tripId: string) {
    if (!tripId) return;
    loadFromStorage(tripId);
  },

  /** True if this spot has already been auto-narrated in this trip. */
  isNarrated(tripId: string, spot: SpotLike | null | undefined): boolean {
    if (!tripId) return false;
    return _narrated.has(tripSpotKey(tripId, spot));
  },

  /** True if automatic narration is allowed for this spot right now. */
  canAutoNarrate(tripId: string, spot: SpotLike | null | undefined, source: 'nearby' | 'arrival'): boolean {
    return this.tryMarkAutomaticNarration(tripId, spot, source, { dryRun: true }).allowed;
  },

  /** Atomically check and mark automatic narration before any popup/API/speech work. */
  tryMarkAutomaticNarration(
    tripId: string,
    spot: SpotLike | null | undefined,
    source: 'nearby' | 'arrival',
    options: { dryRun?: boolean } = {},
  ): NarrationAttemptResult {
    const spotKey = getNarrationSpotKey(spot);
    if (!tripId) return { allowed: false, spotKey, reason: 'missing-trip' };
    const key = tripSpotKey(tripId, spot);
    if (_narrated.has(key)) return { allowed: false, spotKey, reason: 'already-narrated' };
    if (_inFlight.has(key)) return { allowed: false, spotKey, reason: 'in-flight' };
    if (source === 'nearby') {
      if (Date.now() - _lastAmbientAt < AMBIENT_COOLDOWN_MS) return { allowed: false, spotKey, reason: 'ambient-cooldown' };
    }
    if (options.dryRun) return { allowed: true, spotKey };
    const record: NarrationRecord = {
      spotKey,
      spotId: spot?.id == null ? '' : String(spot.id),
      triggeredAt: Date.now(),
      source,
      popupShown: false,
      speechStarted: false,
    };
    _narrated.set(key, record);
    _inFlight.add(key);
    if (source === 'nearby') _lastAmbientAt = Date.now();
    saveToStorage(tripId);
    return { allowed: true, spotKey, record };
  },

  /** Atomically mark a spot as auto-narrated (creates record, sets in-flight).
   *  Must be called BEFORE any async work (API / popup / speech). */
  markTriggered(tripId: string, spot: SpotLike | null | undefined, source: 'nearby' | 'arrival'): NarrationRecord {
    const result = this.tryMarkAutomaticNarration(tripId, spot, source);
    if (result.record) return result.record;
    return _narrated.get(tripSpotKey(tripId, spot)) || {
      spotKey: result.spotKey,
      spotId: spot?.id == null ? '' : String(spot.id),
      triggeredAt: Date.now(),
      source,
      popupShown: false,
      speechStarted: false,
    };
  },

  /** Mark popup as shown for an already-triggered spot. */
  markPopupShown(tripId: string, spot: SpotLike | null | undefined) {
    const key = tripSpotKey(tripId, spot);
    const rec = _narrated.get(key);
    if (rec) {
      rec.popupShown = true;
      saveToStorage(tripId);
    }
  },

  /** Mark speech as started for an already-triggered spot. */
  markSpeechStarted(tripId: string, spot: SpotLike | null | undefined) {
    const key = tripSpotKey(tripId, spot);
    const rec = _narrated.get(key);
    if (rec) {
      rec.speechStarted = true;
      saveToStorage(tripId);
    }
  },

  /** Check / set in-flight lock — prevents concurrent API calls for same spot. */
  markInFlight(tripId: string, spot: SpotLike | null | undefined): boolean {
    const key = tripSpotKey(tripId, spot);
    if (_inFlight.has(key)) return false;
    _inFlight.add(key);
    return true;
  },

  /** Release in-flight lock (call in finally block). */
  clearInFlight(tripId: string, spot: SpotLike | null | undefined) {
    _inFlight.delete(tripSpotKey(tripId, spot));
  },

  /** Backward-compatible alias. */
  releaseInFlight(tripId: string, spot: SpotLike | null | undefined) {
    this.clearInFlight(tripId, spot);
  },

  /** Clear all records for a given trip (on explicit exit / completion). */
  clearTrip(tripId: string) {
    for (const k of _narrated.keys()) {
      if (k.startsWith(`${tripId}:`)) _narrated.delete(k);
    }
    for (const k of _inFlight) {
      if (k.startsWith(`${tripId}:`)) _inFlight.delete(k);
    }
    try { sessionStorage.removeItem(storageKey(tripId)); } catch { /* ignore */ }
  },

  /** Alias for clearTrip — mark trip as complete and clean up. */
  completeTrip(tripId: string) {
    this.clearTrip(tripId);
  },

  /** Clear ALL state (e.g. on hard reset). */
  clearAll() {
    _narrated.clear();
    _inFlight.clear();
    _lastAmbientAt = 0;
  },
};
