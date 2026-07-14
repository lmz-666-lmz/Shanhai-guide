import { useState, useEffect, useRef, useCallback } from 'react';
import type { CampusSpot } from '../../types';
import { loadAmapSdk } from '../../utils/amapLoader';
import CampusRouteLayer from './CampusRouteLayer';

declare const AMap: any;

// ---- Types ----

export type MapSelectorMode = 'single-point' | 'route';

export interface SinglePointResult {
  longitude: number;
  latitude: number;
}

export interface RouteResult {
  spotIds: number[];
}

interface Props {
  mode: MapSelectorMode;
  spots: CampusSpot[];
  initialPosition?: { lng: number; lat: number } | null;
  initialRouteSpotIds?: number[];
  onConfirm: (result: SinglePointResult | RouteResult) => void;
  onClose: () => void;
  privacyMode?: boolean;
}

// ---- Constants ----

const spotTypeColors: Record<string, string> = {
  '教学场馆': '#4a7c9b',
  '宿舍生活区': '#5da668',
  '餐饮美食': '#d49065',
  '便民服务': '#9b7bc0',
  '运动场地': '#c47575',
  '绿化景观': '#5ca9a0',
};

const FALLBACK_CENTER = { lng: 119.5590, lat: 39.9326 };

const categories = ['全部', '教学场馆', '宿舍生活区', '餐饮美食', '便民服务', '运动场地', '绿化景观'];

// ---- Component ----

export default function CampusMapSelector({
  mode,
  spots,
  initialPosition,
  initialRouteSpotIds,
  onConfirm,
  onClose,
  privacyMode = true,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapObject, setMapObject] = useState<any>(null);

  // Selection state
  const [selectedPosition, setSelectedPosition] = useState<{ lng: number; lat: number } | null>(initialPosition || null);
  const [searchValue, setSearchValue] = useState('');
  const [activeType, setActiveType] = useState('全部');

  // Markers & polyline refs
  const markersRef = useRef<any[]>([]);
  const labelsRef = useRef<any[]>([]);
  const privacyLabelsRef = useRef<any[]>([]);
  const viewportInitRef = useRef(false);

  const [draftSpots, setDraftSpots] = useState<number[]>(initialRouteSpotIds || []);

  // ---- Map Init ----
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        await loadAmapSdk();
        if (cancelled || !mapRef.current) return;
        const southGate = spots.find(s => s.spotName.includes('南门'));
        const center = southGate
          ? [Number(southGate.longitude), Number(southGate.latitude)]
          : [FALLBACK_CENTER.lng, FALLBACK_CENTER.lat];
        const map = new AMap.Map(mapRef.current, {
          zoom: 16.5,
          center,
          resizeEnable: true,
          showLabel: !privacyMode,
          features: privacyMode ? ['bg', 'road', 'building'] : ['bg', 'road', 'building', 'point'],
          mapStyle: 'amap://styles/normal',
          isHotspot: !privacyMode,
        });
        mapInstance.current = map;
        setMapObject(map);
        viewportInitRef.current = false;
        window.requestAnimationFrame(() => {
          try { map.resize?.(); } catch {}
        });
        setMapReady(true);
      } catch {
        if (!cancelled) setMapError(true);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [privacyMode]);

  // ---- Cleanup ----
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
      setMapObject(null);
    };
  }, []);

  // ---- Get filtered spots ----
  const filteredSpots = spots.filter(s => {
    const typeMatch = activeType === '全部' || s.spotType === activeType;
    const searchMatch = !searchValue || s.spotName.includes(searchValue) || (s.spotDesc && s.spotDesc.includes(searchValue));
    return typeMatch && searchMatch;
  });

  const selectedRouteSpots = draftSpots
    .map(id => spots.find(s => s.id === id))
    .filter(Boolean) as CampusSpot[];

  // ---- Render Markers ----
  const renderMarkers = useCallback(() => {
    if (!mapInstance.current) return;
    // Clear old
    markersRef.current.forEach((m: any) => { try { mapInstance.current.remove(m); } catch {} });
    markersRef.current = [];
    labelsRef.current.forEach((l: any) => { try { mapInstance.current.remove(l); } catch {} });
    labelsRef.current = [];
    filteredSpots.forEach((spot, index) => {
      const lng = Number(spot.longitude);
      const lat = Number(spot.latitude);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

      const routeIdx = selectedRouteSpots.findIndex(rs => rs.id === spot.id);
      const isRouteSpot = mode === 'route' && routeIdx >= 0;
      const isSelSingle = mode === 'single-point' && selectedPosition
        && Math.abs(selectedPosition.lng - lng) < 0.00005
        && Math.abs(selectedPosition.lat - lat) < 0.00005;

      // Route stations are exclusively rendered and clicked by CampusRouteLayer.
      if (isRouteSpot) return;

      const color = spotTypeColors[spot.spotType] || '#6b7280';
      const size = isSelSingle ? 30 : 18;
      const borderW = isSelSingle ? 4 : 1;
      const borderColor = isSelSingle ? '#ffffff' : 'rgba(255,255,255,0.8)';
      const shadow = isSelSingle
        ? '0 0 0 6px rgba(26,92,138,0.3), 0 4px 12px rgba(0,0,0,0.3)'
        : '0 1px 3px rgba(0,0,0,0.12)';
      const markerBg = isSelSingle ? '#2563EB' : color;

      const markerContent = `
        <div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${markerBg};border:${borderW}px solid ${borderColor};
          box-shadow:${shadow};display:flex;align-items:center;
          justify-content:center;transition:all .3s ease;
        ">
          <div style="width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.9);"></div>
        </div>
      `;

      const marker = new AMap.Marker({
        position: [lng, lat],
        content: markerContent,
        offset: new AMap.Pixel(-size / 2, -size / 2),
        zIndex: isSelSingle ? 2000 + index : 1000 + index,
      });

      const label = new AMap.Text({
        text: spot.spotName,
        position: [lng, lat],
        offset: new AMap.Pixel(22, (index % 3) * 10 - 10),
        zIndex: 3000 + index,
        style: {
          fontSize: isSelSingle ? '12px' : '11px',
          fontWeight: isSelSingle ? '700' : '600',
          fillColor: color,
          strokeColor: '#ffffff',
          strokeWidth: 2,
          background: 'rgba(255,255,255,0.85)',
          padding: '2px 5px',
          borderRadius: '3px',
        },
      });
      mapInstance.current.add(label);
      labelsRef.current.push(label);

      marker.on('click', () => {
        if (mode === 'single-point') {
          setSelectedPosition({ lng, lat });
        } else {
          setDraftSpots(prev => {
            if (prev.includes(spot.id)) return prev.filter(id => id !== spot.id);
            return [...prev, spot.id];
          });
        }
      });

      mapInstance.current.add(marker);
      markersRef.current.push(marker);
    });

    // Single-point: custom position marker
    if (mode === 'single-point' && selectedPosition && !filteredSpots.some(s => {
      const lng = Number(s.longitude), lat = Number(s.latitude);
      return Number.isFinite(lng) && Number.isFinite(lat)
        && Math.abs(selectedPosition.lng - lng) < 0.00005
        && Math.abs(selectedPosition.lat - lat) < 0.00005;
    })) {
      const pm = new AMap.Marker({
        position: [selectedPosition.lng, selectedPosition.lat],
        content: `<div style="width:30px;height:30px;border-radius:50%;background:#EF4444;border:4px solid #fff;box-shadow:0 0 0 6px rgba(239,68,68,.25),0 4px 16px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;border-radius:50%;background:#fff;"></div></div>`,
        offset: new AMap.Pixel(-15, -15),
        zIndex: 5000,
      });
      mapInstance.current.add(pm);
      markersRef.current.push(pm);
    }

  }, [filteredSpots, selectedPosition, draftSpots, mode]);

  useEffect(() => {
    if (!mapReady || !mapInstance.current || !privacyMode || spots.length === 0) return;
    privacyLabelsRef.current.forEach(label => { try { mapInstance.current.remove(label); } catch {} });
    const positions = spots.map(s => [Number(s.longitude), Number(s.latitude)] as [number, number])
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
    if (positions.length === 0) return;
    const centerLng = positions.reduce((sum, p) => sum + p[0], 0) / positions.length;
    const centerLat = positions.reduce((sum, p) => sum + p[1], 0) / positions.length;
    const areas = [
      ['教学区', -0.0022, 0.0017], ['文化区', 0.0016, 0.0015], ['生活区', -0.0018, -0.0017],
      ['景观区', 0.0017, -0.0015], ['服务区', 0, -0.0024],
    ] as const;
    privacyLabelsRef.current = areas.map(([name, dx, dy]) => {
      const label = new AMap.Text({
        text: name,
        position: [centerLng + dx, centerLat + dy],
        zIndex: 700,
        style: { color: '#475569', fontSize: '11px', fontWeight: '700', background: 'rgba(255,255,255,.78)', border: '1px solid #e2e8f0', borderRadius: '999px', padding: '3px 8px' },
      });
      mapInstance.current.add(label);
      return label;
    });
    return () => {
      privacyLabelsRef.current.forEach(label => { try { mapInstance.current?.remove(label); } catch {} });
      privacyLabelsRef.current = [];
    };
  }, [mapReady, privacyMode, spots]);

  useEffect(() => {
    if (mapReady) renderMarkers();
  }, [mapReady, renderMarkers]);

  // ---- Initial viewport: south gate or restore ----
  useEffect(() => {
    if (!mapInstance.current || !mapReady) return;
    if (viewportInitRef.current) return;

    if (mode === 'route' && selectedRouteSpots.length >= 2) {
      const coords = selectedRouteSpots.map(s => [Number(s.longitude), Number(s.latitude)] as [number, number]);
      try {
        const mks = coords.map(c => new AMap.Marker({ position: c }));
        mapInstance.current.setFitView(mks, false, [100, 100, 100, 100], 15);
        mks.forEach((m: any) => m.setMap(null));
        viewportInitRef.current = true;
        return;
      } catch {}
    }
    if (mode === 'single-point' && selectedPosition) {
      mapInstance.current.setZoomAndCenter(18, [selectedPosition.lng, selectedPosition.lat]);
      viewportInitRef.current = true;
      return;
    }
    viewportInitRef.current = true;
  }, [mapReady]);

  // ---- Map click (single-point mode) ----
  useEffect(() => {
    if (!mapInstance.current || mode !== 'single-point') return;
    const handler = (e: any) => {
      setSelectedPosition({ lng: e.lnglat.getLng(), lat: e.lnglat.getLat() });
    };
    mapInstance.current.on('click', handler);
    return () => { try { mapInstance.current.off('click', handler); } catch {} };
  }, [mapReady, mode]);

  // ---- Category change => move viewport ----
  useEffect(() => {
    if (!mapInstance.current || !mapReady) return;
    if (activeType === '全部') return;
    const typed = spots.filter(s => s.spotType === activeType);
    if (typed.length === 0) return;
    const lngs = typed.map(s => Number(s.longitude)).filter(n => Number.isFinite(n));
    const lats = typed.map(s => Number(s.latitude)).filter(n => Number.isFinite(n));
    if (lngs.length === 0) return;
    const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const spreads = typed.map(s => {
      const dx = Number(s.longitude) - avgLng;
      const dy = Number(s.latitude) - avgLat;
      return Math.sqrt(dx * dx + dy * dy);
    });
    const maxSpread = Math.max(...spreads, 0.001);
    const zoom = maxSpread < 0.002 ? 17 : maxSpread < 0.005 ? 16 : 15;
    mapInstance.current.setZoomAndCenter(zoom, [avgLng, avgLat]);
  }, [activeType]);

  // ---- Helpers ----
  const handleConfirm = () => {
    if (mode === 'single-point') {
      if (!selectedPosition) return;
      onConfirm({ longitude: selectedPosition.lng, latitude: selectedPosition.lat });
    } else {
      if (draftSpots.length < 2) return;
      onConfirm({ spotIds: [...draftSpots] });
    }
  };

  const moveSpotUp = (idx: number) => {
    if (idx <= 0) return;
    setDraftSpots(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveSpotDown = (idx: number) => {
    if (idx >= draftSpots.length - 1) return;
    setDraftSpots(prev => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const estimateWalkMinutes = (spts: CampusSpot[]) => {
    if (spts.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < spts.length - 1; i++) {
      const a = Number(spts[i].longitude), b = Number(spts[i].latitude);
      const c = Number(spts[i + 1].longitude), d = Number(spts[i + 1].latitude);
      const dx = (c - a) * 111320 * Math.cos(b * Math.PI / 180);
      const dy = (d - b) * 110540;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return Math.max(1, Math.round(total / 75));
  };

  // ---- Render ----
  return (
    <div className="fixed inset-0 z-[3000] flex flex-col bg-white">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-4 px-4 pb-2 bg-gradient-to-b from-white/90 via-white/70 to-transparent pointer-events-none">
        <div className="flex items-center gap-3 mb-3 pointer-events-auto">
          <button
            className="w-11 h-11 rounded-full bg-white/90 backdrop-blur-md shadow-sm flex items-center justify-center text-slate-600 active:scale-95 transition-transform"
            onClick={onClose}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div className="flex-1">
            <div className="relative bg-white/90 rounded-full flex items-center px-4 h-10 border border-slate-100 shadow-sm">
              <svg className="text-slate-400 w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="w-full bg-transparent border-none outline-none ml-2 text-sm text-slate-800 placeholder:text-slate-400"
                placeholder="搜索点位、设施、活动..."
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pointer-events-auto pb-2">
          {categories.map(type => (
            <button
              key={type}
              className={`flex-none px-4 py-1.5 rounded-full text-[11px] font-medium transition-all shadow-sm ${
                activeType === type ? 'bg-primary-blue text-white' : 'bg-white/90 text-slate-500 border border-slate-100'
              }`}
              onClick={() => setActiveType(type)}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Status bar */}
        <div className="pointer-events-auto mt-1">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap sm:flex-wrap">
            {/* 顺序预览：路线编辑状态标签，不拦截点击 */}
            {mode === 'route' && selectedRouteSpots.length >= 2 && (
              <span className="flex-none rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm pointer-events-none whitespace-nowrap">
                顺序预览
              </span>
            )}
            <div className="flex-none bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm inline-flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap">
                {mode === 'single-point' ? '点击地图或点位选择位置' : '点击点位加入路线'}
              </span>
            </div>
            <span className="flex-none text-[10px] text-slate-400 whitespace-nowrap">
              显示 {filteredSpots.length} 个点位
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {mapError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50">
            <svg className="w-10 h-10 text-slate-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-sm text-slate-500 mb-3">校园地图加载失败，请重试</p>
            <button className="bg-primary-blue text-white px-5 py-2 rounded-full text-sm font-bold active:scale-95" onClick={() => { setMapError(false); window.location.reload(); }}>
              重新加载
            </button>
          </div>
        ) : (
          <>
            <div ref={mapRef} className="w-full h-full bg-[#F0F4F8]" />
            {mode === 'route' && (
              <CampusRouteLayer
                  map={mapObject}
                  routeSpots={selectedRouteSpots}
                  currentStationIndex={0}
                  animated
                  showStationNumber
                  showMovingIndicator={false}
                  fitRoute={false}
                  variant="sequence-preview"
                  previewAvatar={selectedRouteSpots.length >= 2}
                  previewPlaying={selectedRouteSpots.length >= 2}
                  onStationClick={(spot) => setDraftSpots(prev => prev.filter(id => id !== spot.id))}
                />
            )}
            {!mapReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F0F4F8] z-10">
                <div className="w-6 h-6 border-2 border-primary-blue/20 border-t-primary-blue rounded-full animate-spin mb-3"></div>
                <span className="text-xs text-slate-400">正在加载校园地图...</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom panel */}
      <div className="shrink-0 bg-white border-t border-slate-100 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
        {mode === 'single-point' ? (
          <div>
            {selectedPosition ? (
              <>
                <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
                  <span>经度: {selectedPosition.lng.toFixed(5)}</span>
                  <span>纬度: {selectedPosition.lat.toFixed(5)}</span>
                </div>
                <button
                  className="w-full bg-primary-blue text-white font-bold py-3.5 rounded-full active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20"
                  onClick={handleConfirm}
                >
                  确认此位置
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-400 text-center py-2">点击地图选择点位位置</p>
            )}
          </div>
        ) : (
          <div>
            {/* Route summary */}
            {draftSpots.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">
                    已选 {draftSpots.length} 个点位
                  </span>
                  {draftSpots.length >= 2 && (
                    <span className="text-[10px] text-slate-400">
                      预计步行 {estimateWalkMinutes(selectedRouteSpots)} 分钟
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedRouteSpots.map((spot, idx) => (
                    <div key={spot.id} className="flex items-center gap-1 bg-blue-50 border border-blue-100 rounded-full px-2 py-1">
                      <span className="w-5 h-5 rounded-full bg-primary-blue text-white text-[10px] font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                      <span className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">{spot.spotName}</span>
                      <div className="flex gap-0.5 ml-1">
                        <button className="w-4 h-4 rounded bg-white text-[10px] text-slate-400 hover:text-slate-700 flex items-center justify-center" onClick={() => moveSpotUp(idx)} title="上移">↑</button>
                        <button className="w-4 h-4 rounded bg-white text-[10px] text-slate-400 hover:text-slate-700 flex items-center justify-center" onClick={() => moveSpotDown(idx)} title="下移">↓</button>
                        <button className="w-4 h-4 rounded bg-white text-[10px] text-red-400 hover:text-red-600 flex items-center justify-center" onClick={() => setDraftSpots(prev => prev.filter(id => id !== spot.id))} title="删除">×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="text-[10px] text-slate-400 underline" onClick={() => setDraftSpots([])}>清空全部</button>
              </div>
            )}
            <div className="text-[10px] text-slate-400 text-center mb-2">
              第 {Math.max(1, draftSpots.length)} 站
              {draftSpots.length >= 2 && <> · 共 {draftSpots.length} 站</>}
            </div>
            <button
              className={`w-full font-bold py-3.5 rounded-full active:scale-[0.98] transition-transform shadow-lg ${
                draftSpots.length >= 2
                  ? 'bg-primary-blue text-white shadow-blue-500/20'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              onClick={handleConfirm}
              disabled={draftSpots.length < 2}
            >
              {draftSpots.length >= 2 ? '确认此路线' : '请至少选择两个点位'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
