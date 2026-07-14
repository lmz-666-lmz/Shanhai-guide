import type { ChatSource } from '../../types';

interface Props {
  sources?: ChatSource[];
}

export default function SourceReferencePanel({ sources }: Props) {
  if (!sources || sources.length === 0) return null;
  
  const labels = Array.from(new Set(sources.map(source => source.sourceName || source.title).filter(Boolean)));
  if (labels.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100/60">
      <p className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        AI 知识库依据来源
      </p>
      <div className="flex flex-wrap gap-1.5">
        {labels.slice(0, 4).map(label => (
          <span key={label} className="text-[10px] text-slate-500 bg-slate-50/80 border border-slate-100 rounded-lg px-2 py-1 max-w-full truncate flex items-center gap-1">
            <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span className="truncate">{label}</span>
          </span>
        ))}
        {labels.length > 4 && (
          <span className="text-[10px] text-slate-400 px-1 py-1">+{labels.length - 4}</span>
        )}
      </div>
    </div>
  );
}
