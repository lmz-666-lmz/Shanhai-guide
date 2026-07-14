export default function RoutePlanningSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
        </div>
        <p className="text-[12px] font-bold text-emerald-600">正在为您定制校园专属路线</p>
      </div>
      
      <div className="bg-white border border-emerald-50 rounded-2xl p-4 shadow-sm relative overflow-hidden">
        {/* Shimmer effect */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-emerald-50/50 to-transparent"></div>
        
        <div className="space-y-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-50 shrink-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-300"></div>
            </div>
            <div className="flex-1">
              <div className="h-3.5 bg-slate-100 rounded-full w-2/3 mb-1.5"></div>
              <div className="h-2 bg-slate-50 rounded-full w-1/3"></div>
            </div>
          </div>
          
          <div className="pl-2.5 space-y-3 border-l-2 border-emerald-50/50 ml-2.5 py-1">
            <div className="flex gap-2 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-200 shrink-0 -ml-3.5"></div>
              <div className="h-2.5 bg-slate-100 rounded-full w-full max-w-[120px]"></div>
            </div>
            <div className="flex gap-2 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-200 shrink-0 -ml-3.5"></div>
              <div className="h-2.5 bg-slate-100 rounded-full w-full max-w-[150px]"></div>
            </div>
            <div className="flex gap-2 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-200 shrink-0 -ml-3.5"></div>
              <div className="h-2.5 bg-slate-100 rounded-full w-full max-w-[100px]"></div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-50 shrink-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-300"></div>
            </div>
            <div className="flex-1">
              <div className="h-3 bg-slate-100 rounded-full w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 pt-1 text-[10px] text-slate-400 justify-center">
        <span className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-slate-300"></div>分析时间预算</span>
        <span className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-slate-300"></div>匹配兴趣点位</span>
        <span className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-slate-300"></div>计算游览顺序</span>
      </div>
    </div>
  );
}
