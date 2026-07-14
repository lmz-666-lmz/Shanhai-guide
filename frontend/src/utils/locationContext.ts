/**
 * 共享位置上下文 —— ChatPage 读取 MapPage 当前 real / demo / manual 位置。
 * 不建立第二套定位状态，只读取 sessionStorage 中 MapPage 维护的 key。
 */

const LOCATION_MODE_KEY = 'locationMode';
const DEMO_START_KEY = 'demoStart';
const DEMO_POSITION_KEY = 'shanhai_demo_position';
const CURRENT_POSITION_KEY = 'shanhai_current_position';
const MANUAL_START_KEY = 'shanhai_manual_start';
const UPDATED_AT_KEY = 'shanhai_location_updated_at';
const LEGACY_LOCATION_MODE_KEY = 'shanhai_location_mode';
const LEGACY_DEMO_START_KEY = 'shanhai_demo_start';
const POSITION_MAX_AGE_MS = 5 * 60 * 1000;

export interface CampusLocationContext {
  /** 位置模式 */
  mode: 'real' | 'demo' | 'manual' | 'unlocated';
  /** 当前位置坐标（real: 最新GPS, demo: 演示位置, manual: 用户确认的手动起点） */
  position: { longitude: number; latitude: number } | null;
  /** 位置标签，用于路线卡显示 */
  label: string;
  /** 最新位置更新时间。为 null 时视为不可验证。 */
  updatedAt: number | null;
}

function readStorage(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function readPosition(raw: string | null): { longitude: number; latitude: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 2) {
      const lng = Number(parsed[0]);
      const lat = Number(parsed[1]);
      // Accept any valid coordinate pair within China's general bounding box
      // (73°E–135°E, 3°N–54°N). This covers all major Chinese cities.
      if (Number.isFinite(lng) && Number.isFinite(lat) && lng >= 73 && lng <= 135 && lat >= 3 && lat <= 54) {
        return { longitude: lng, latitude: lat };
      }
    }
  } catch { /* ignore */ }
  return null;
}

function readUpdatedAt(): number | null {
  const parsed = Number(readStorage(UPDATED_AT_KEY));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isFresh(updatedAt: number | null): boolean {
  return updatedAt !== null && Date.now() - updatedAt <= POSITION_MAX_AGE_MS;
}

/** 读取地图页当前共享位置上下文 */
export function getCampusLocationContext(): CampusLocationContext {
  const mode = readStorage(LOCATION_MODE_KEY) || readStorage(LEGACY_LOCATION_MODE_KEY);

  if (mode === 'demo') {
    const raw = readStorage(DEMO_POSITION_KEY) || readStorage(DEMO_START_KEY) || readStorage(LEGACY_DEMO_START_KEY);
    const position = readPosition(raw);
    const updatedAt = readUpdatedAt();
    return { mode: 'demo', position, label: position ? '演示位置' : '演示位置（未设置）', updatedAt };
  }

  if (mode === 'real') {
    const realRaw = readStorage(CURRENT_POSITION_KEY);
    const position = readPosition(realRaw);
    const updatedAt = readUpdatedAt();
    if (position && isFresh(updatedAt)) return { mode: 'real', position, label: '当前位置', updatedAt };
    return { mode: 'unlocated', position: null, label: '', updatedAt };
  }

  if (mode === 'manual') {
    const manualRaw = readStorage(MANUAL_START_KEY);
    const position = readPosition(manualRaw);
    const updatedAt = readUpdatedAt();
    if (position) return { mode: 'manual', position, label: '手动起点', updatedAt };
    return { mode: 'manual', position: null, label: '手动起点（未设置）', updatedAt };
  }

  return { mode: 'unlocated', position: null, label: '', updatedAt: null };
}

/** 检查是否有可用位置 */
export function hasLocation(ctx: CampusLocationContext): boolean {
  return ctx.position !== null
    && Number.isFinite(ctx.position.longitude)
    && Number.isFinite(ctx.position.latitude);
}
