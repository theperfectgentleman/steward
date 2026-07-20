import { useState, useMemo } from "react";
import { format } from "date-fns";

export type AlertItem = {
  id: string;
  type: "blocked" | "completed" | "minutes" | "assignment";
  message: string;
  time: string;
  href?: string;
  committeeId?: string;
  meetingId?: string;
};

type Props = {
  alerts: AlertItem[];
  onAlertClick?: (alert: AlertItem) => void;
};

const ITEMS_PER_PAGE = 10;

export function AlertFeed({ alerts, onAlertClick }: Props) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [committeeFilter, setCommitteeFilter] = useState("All");

  // Extract unique committees for the dropdown
  const uniqueCommittees = useMemo(() => {
    const map = new Map<string, string>();
    alerts.forEach(a => {
      if (a.committeeId) {
        // We only have the ID here, we might need to rely on the message for the name, 
        // or just pass a committee map. For simplicity, we'll extract the name from the message 
        // assuming it starts with "Committee Name: " or similar if possible.
        // As a fallback, we'll just use the ID if we can't extract it. 
        // The dashboard API ideally would send committeeName.
        const nameMatch = a.message.split(":")[0];
        if (nameMatch && nameMatch.length < 40) {
          map.set(a.committeeId, nameMatch);
        } else {
          map.set(a.committeeId, `Committee ${a.committeeId.substring(0, 4)}`);
        }
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (statusFilter !== "All" && a.type !== statusFilter.toLowerCase()) return false;
      if (committeeFilter !== "All" && a.committeeId !== committeeFilter) return false;
      return true;
    });
  }, [alerts, statusFilter, committeeFilter]);

  const totalPages = Math.ceil(filteredAlerts.length / ITEMS_PER_PAGE);
  const paginatedAlerts = filteredAlerts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (alerts.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-sm text-muted bg-white rounded-xl border border-charcoal/10">
        No alerts right now. All committees are on track.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-charcoal/10 shadow-xs overflow-hidden flex flex-col min-h-[400px]">
      {/* Filters */}
      <div className="p-3 border-b border-charcoal/10 flex items-center justify-between gap-3 flex-wrap bg-slate-50">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-accent uppercase tracking-wider">Status</label>
          <select 
            className="text-sm border border-charcoal/15 rounded-md px-2 py-1 bg-white"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="All">All</option>
            <option value="Blocked">Blocked</option>
            <option value="Completed">Completed</option>
            <option value="Assignment">Assignment</option>
            <option value="Minutes">Minutes</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-accent uppercase tracking-wider">Committee</label>
          <select 
            className="text-sm border border-charcoal/15 rounded-md px-2 py-1 bg-white max-w-[150px] truncate"
            value={committeeFilter}
            onChange={(e) => { setCommitteeFilter(e.target.value); setPage(1); }}
          >
            <option value="All">All</option>
            {uniqueCommittees.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap min-w-[400px]">
          <thead className="bg-slate-50/50 text-[10px] uppercase tracking-wider text-muted font-semibold border-b border-charcoal/10">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium hidden sm:table-cell">Status</th>
              <th className="px-3 py-2 font-medium w-full">Alert Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal/5">
            {paginatedAlerts.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted">No alerts match your filters.</td>
              </tr>
            ) : (
              paginatedAlerts.map(alert => (
                <tr 
                  key={alert.id} 
                  className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => alert.href && onAlertClick?.(alert)}
                >
                  <td className="px-3 py-2.5 text-charcoal/70">
                    {format(new Date(alert.time), "dd-MMM-yyyy")}
                  </td>
                  <td className="px-3 py-2.5 capitalize text-charcoal/70 hidden sm:table-cell">
                    {alert.type}
                  </td>
                  <td className="px-3 py-2.5 text-charcoal font-medium whitespace-normal line-clamp-2">
                    <span className="group-hover:text-primary transition-colors">
                      {alert.message}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-charcoal/10 flex items-center justify-between text-sm bg-slate-50/50">
          <button 
            className="px-3 py-1.5 rounded border border-charcoal/15 bg-white disabled:opacity-50 text-charcoal hover:bg-slate-50 transition-colors"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            &lsaquo; Prev
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              // Simple sliding window for pages
              if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                return (
                  <button
                    key={p}
                    className={`w-7 h-7 flex items-center justify-center rounded text-sm ${page === p ? 'bg-primary text-white font-bold' : 'text-charcoal hover:bg-slate-100'}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              }
              if (p === page - 2 || p === page + 2) {
                return <span key={p} className="text-muted">...</span>;
              }
              return null;
            })}
          </div>

          <button 
            className="px-3 py-1.5 rounded border border-charcoal/15 bg-white disabled:opacity-50 text-charcoal hover:bg-slate-50 transition-colors"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next &rsaquo;
          </button>
        </div>
      )}
      <div className="p-2 text-center text-[11px] text-muted border-t border-charcoal/5 bg-slate-50/50">
        Showing {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, filteredAlerts.length)} of {filteredAlerts.length} total alerts
      </div>
    </div>
  );
}
