"use client";

import { useMemo } from "react";
import { format, differenceInDays, startOfMonth, addMonths, endOfMonth } from "date-fns";

export type GanttItem = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  progress: number;
  committee: {
    id: string;
    name: string;
    charterLetter: string;
  };
};

type Props = {
  items: GanttItem[];
  // Optionally provide a specific window, otherwise defaults to current quarter-ish
  baseDate?: Date; 
};

export function GanttChart({ items, baseDate = new Date() }: Props) {
  // Setup a 3-month window
  const windowStart = startOfMonth(baseDate);
  const windowEnd = endOfMonth(addMonths(windowStart, 2));
  const totalDays = differenceInDays(windowEnd, windowStart) + 1;

  // Generate months for header
  const months = useMemo(() => {
    const m = [];
    for (let i = 0; i < 3; i++) {
      const d = addMonths(windowStart, i);
      const daysInMonth = differenceInDays(endOfMonth(d), startOfMonth(d)) + 1;
      m.push({
        name: format(d, "MMMM"),
        days: daysInMonth,
      });
    }
    return m;
  }, [windowStart]);

  // Map items to grid positions
  const rows = useMemo(() => {
    return items.map((item) => {
      const start = new Date(item.startDate);
      const end = new Date(item.endDate);
      
      let startDay = differenceInDays(start, windowStart) + 1;
      let endDay = differenceInDays(end, windowStart) + 1;

      // Bound to window
      startDay = Math.max(1, startDay);
      endDay = Math.min(totalDays, endDay);
      
      // Ensure at least 1 day wide if within window
      if (startDay > totalDays || endDay < 1) return null; // Outside window
      if (startDay > endDay) endDay = startDay;

      // Cycle colors based on committee charter letter code to get a mix of lime, gold, charcoal variations
      const colorIndex = item.committee.charterLetter.charCodeAt(0) % 3;
      const barColors = [
        "bg-primary text-white border-primary",    // Lime/Green
        "bg-amber-500 text-white border-amber-600",// Gold
        "bg-charcoal text-white border-charcoal"   // Charcoal
      ];

      return {
        ...item,
        startDay,
        endDay,
        barColor: barColors[colorIndex],
      };
    }).filter(Boolean) as (GanttItem & { startDay: number; endDay: number; barColor: string })[];
  }, [items, windowStart, totalDays]);

  return (
    <div className="w-full bg-white rounded-xl border border-charcoal/10 overflow-hidden flex flex-col shadow-xs h-full min-h-[400px]">
      <div className="flex bg-slate-50 border-b border-charcoal/10 text-[11px] font-bold text-accent uppercase tracking-wider">
        <div className="w-48 lg:w-56 shrink-0 p-3 border-r border-charcoal/10 flex items-center">
          Committee
        </div>
        <div className="flex-1 overflow-x-auto overflow-y-hidden hide-scrollbar">
          <div className="flex flex-col min-w-[500px]">
            {/* Months Row */}
            <div className="flex border-b border-charcoal/10">
              {months.map((m, i) => (
                <div 
                  key={i} 
                  className="py-1.5 text-center border-r border-charcoal/10 last:border-r-0"
                  style={{ width: `${(m.days / totalDays) * 100}%` }}
                >
                  {m.name}
                </div>
              ))}
            </div>
            {/* Weeks/Days indicator row */}
            <div className="flex h-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex-1 border-r border-charcoal/5 last:border-r-0 text-center text-[10px] text-muted/50 pt-1">
                  Wk {i+1}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex">
        {/* Left Column (Committees) */}
        <div className="w-48 lg:w-56 shrink-0 border-r border-charcoal/10 bg-white relative z-10 shadow-[1px_0_2px_rgba(0,0,0,0.03)]">
          {rows.map((row) => (
            <div key={row.id} className="h-12 px-3 border-b border-charcoal/5 flex items-center gap-2 hover:bg-slate-50 transition-colors">
               <span className="w-5 h-5 flex items-center justify-center rounded bg-accent/10 border border-accent/20 text-accent font-extrabold uppercase shrink-0 text-[10px]">
                  {row.committee.charterLetter}
               </span>
               <span className="text-[11px] font-medium text-charcoal truncate">
                 {row.committee.name}
               </span>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="p-4 text-sm text-muted">No timeline data available.</div>
          )}
        </div>

        {/* Right Grid (Bars) */}
        <div className="flex-1 min-w-[500px] relative bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGxpbmUgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjQ4IiBzdHJva2U9IiNlN2U1ZTQiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')]">
          {rows.map((row) => (
            <div key={row.id} className="h-12 border-b border-charcoal/5 flex items-center relative w-full group">
              <div
                className={`absolute h-7 rounded-md ${row.barColor} border flex items-center text-[10px] font-medium overflow-hidden shadow-sm transition-all group-hover:brightness-110`}
                style={{
                  left: `${((row.startDay - 1) / totalDays) * 100}%`,
                  width: `${((row.endDay - row.startDay + 1) / totalDays) * 100}%`,
                }}
              >
                {/* Progress Fill (darker shade overlay) */}
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-black/15" 
                  style={{ width: `${row.progress}%` }} 
                />
                
                <div className="relative z-10 px-1.5 flex items-center gap-1.5 whitespace-nowrap min-w-0 w-full">
                   <span className="font-bold opacity-90 text-[9px]">{row.progress}%</span>
                   <span className="truncate">{row.title}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
