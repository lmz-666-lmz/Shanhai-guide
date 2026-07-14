import { useDigitalHuman, type NarrationMode } from '../contexts/DigitalHumanContext';
import { DefaultSpotCover, resolveImageUrl } from '../utils/image';

const modes: Array<{ value: NarrationMode; label: string }> = [
  { value: 'concise', label: '简洁' }, { value: 'detailed', label: '详细' },
  { value: 'fresh', label: '新生' }, { value: 'alumni', label: '校友' },
  { value: 'parent', label: '家长' },
];

const modeLoadingLabel: Record<string, string> = {
  concise: '小海正在整理简洁讲解…', detailed: '小海正在整理详细讲解…',
  fresh: '小海正在整理新生视角讲解…', alumni: '小海正在整理校友视角讲解…',
  parent: '小海正在整理家长视角讲解…',
};

const modeDisplayLabel: Record<string, string> = {
  concise: '简洁视角', detailed: '详细视角',
  fresh: '新生视角', alumni: '校友视角',
  parent: '家长视角',
};

export default function PointNarrationPanel() {
  const { narration, openNarration, closeNarration, speak, effectiveConfig } = useDigitalHuman();
  const spot = narration.spot;
  if (!narration.open || !spot) return null;
  const image = resolveImageUrl(spot.spotImage);
  const currentModeLabel = modeDisplayLabel[narration.mode] || narration.mode;
  const isLoading = narration.loading;
  const loadingText = modeLoadingLabel[narration.mode] || '正在依据校园知识库整理讲解…';

  return (
    <div className="fixed inset-0 z-[3600] bg-slate-950/35 flex items-end" onClick={closeNarration}>
      <section
        className={`w-full max-h-[86dvh] overflow-y-auto rounded-t-[28px] bg-white shadow-2xl ${effectiveConfig.largeText ? 'text-[17px]' : ''} ${effectiveConfig.highContrast ? 'contrast-125' : ''}`}
        onClick={event => event.stopPropagation()}
        aria-label={`${spot.spotName}讲解面板`}
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 pt-3 pb-3 border-b border-slate-100">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-primary-blue">
                小海导览介绍 · {currentModeLabel}
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-slate-900">{spot.spotName}</h2>
            </div>
            <button className="h-10 w-10 rounded-full bg-slate-100 text-slate-500 text-xl" onClick={closeNarration} aria-label="关闭讲解">×</button>
          </div>
        </div>

        <div className="p-5 pb-[calc(24px+env(safe-area-inset-bottom))] space-y-4">
          <div className="h-40 overflow-hidden rounded-2xl bg-slate-100">
            {image ? <img src={image} alt={spot.spotName} className="h-full w-full object-cover" /> : <DefaultSpotCover spotType={spot.spotType} className="h-full w-full" />}
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {modes.map(modeItem => (
              <button
                key={modeItem.value}
                onClick={() => void openNarration(spot, modeItem.value)}
                disabled={isLoading}
                className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-bold transition-colors disabled:opacity-50 ${
                  narration.mode === modeItem.value ? 'bg-primary-blue text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {modeItem.label}视角
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-blue-50/70 p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-extrabold text-primary-blue">
                {narration.mode === 'concise' ? '约30秒简短讲解' : narration.mode === 'detailed' ? '约60-90秒详细讲解' : '约35秒讲解'}
              </p>
              <button
                disabled={isLoading || !narration.content}
                onClick={() => speak(narration.content)}
                className="min-h-9 rounded-full bg-white px-3 text-[11px] font-bold text-primary-blue disabled:opacity-50"
              >
                朗读讲解
              </button>
            </div>
            {isLoading ? (
              <p className="text-sm text-slate-500 animate-pulse">{loadingText}</p>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{narration.content}</p>
            )}
            {/* Generation source + material status */}
            {!isLoading && (
              <p className="mt-2 text-[10px] text-slate-400">
                {narration.generatedBy === 'deepseek' ? 'AI生成' : '基础资料模式'}
                {narration.generatedBy === 'deepseek' && narration.sources && narration.sources.filter(s => s.sourceType === 'knowledge').length > 0
                  ? ` · 使用点位资料和${narration.sources.filter(s => s.sourceType === 'knowledge').length}条知识库资料`
                  : narration.generatedBy === 'deepseek' ? ' · 仅使用点位基础资料' : ' · AI服务暂不可用'}
                {' · '}{currentModeLabel}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[10px] text-slate-400">开放时间</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{spot.openTime || '以学校实际安排为准'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[10px] text-slate-400">推荐停留</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{spot.recommendTime || 15} 分钟</p>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <p className="text-xs font-extrabold text-emerald-700">依据来源</p>
            {narration.sources.length > 0 ? narration.sources.map((source, index) => (
              <div key={`${source.sourceType}-${source.sourceId || index}`} className="mt-2 rounded-xl bg-white p-3">
                <p className="text-xs font-bold text-slate-700">{source.title || source.sourceName}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">{source.sourceName}{source.snippet ? ` · ${source.snippet}` : ''}</p>
              </div>
            )) : <p className="mt-2 text-xs text-amber-700">{effectiveConfig.fallbackMessages.noKnowledge}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
