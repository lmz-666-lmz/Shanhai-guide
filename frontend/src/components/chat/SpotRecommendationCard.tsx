import type { CampusSpot } from '../../types';
import { resolveImageUrl, DefaultSpotCover } from '../../utils/image';
import { useDigitalHuman } from '../../contexts/DigitalHumanContext';

interface Props {
  spots: CampusSpot[];
  onNavigate: (params: { page: string; spotId?: number; navigationMode?: boolean }) => void;
}

export default function SpotRecommendationCard({ spots, onNavigate }: Props) {
  const { openNarration, capabilityEnabled } = useDigitalHuman();
  if (!spots || spots.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      {spots.slice(0, 3).map(spot => {
        const imageUrl = resolveImageUrl(spot.spotImage);
        return (
          <div key={spot.id} className="bg-blue-50/70 border border-blue-100 rounded-2xl overflow-hidden">
            <button
              className="w-full text-left flex gap-3 p-3 active:bg-blue-100/60 transition-colors"
              onClick={() => onNavigate({ page: 'map', spotId: spot.id, navigationMode: true })}
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-white shrink-0">
                {imageUrl ? (
                  <img src={imageUrl} alt={spot.spotName} className="w-full h-full object-cover" />
                ) : (
                  <DefaultSpotCover spotType={spot.spotType} className="w-full h-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-primary-blue mb-1">识别到校园点位</p>
                <h4 className="font-bold text-sm text-slate-800 truncate">{spot.spotName}</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{spot.spotDesc || spot.spotType}</p>
              </div>
            </button>
            <div className="grid grid-cols-3 gap-2 px-3 pb-3">
              <button
                disabled={!capabilityEnabled('pointNarration')}
                className="bg-blue-50 text-primary-blue rounded-xl py-2 text-xs font-bold disabled:opacity-40"
                onClick={() => void openNarration(spot)}
              >
                {capabilityEnabled('pointNarration') ? '小海讲解' : '该能力当前由管理员关闭'}
              </button>
              <button
                className="bg-white text-primary-blue rounded-xl py-2 text-xs font-bold active:scale-95 transition-transform"
                onClick={() => onNavigate({ page: 'map', spotId: spot.id })}
              >
                查看地图
              </button>
              <button
                className="bg-primary-blue text-white rounded-xl py-2 text-xs font-bold active:scale-95 transition-transform"
                onClick={() => onNavigate({ page: 'map', spotId: spot.id, navigationMode: true })}
              >
                开始导航
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
