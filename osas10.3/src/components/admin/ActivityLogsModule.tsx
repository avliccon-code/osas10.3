import React, { useState, useEffect } from 'react';
import { getActivityLogs } from '../../services/storage';
import { Activity, Search, Filter, ShieldCheck, Clock } from 'lucide-react';

export const ActivityLogsModule: React.FC = () => {
  const [logs, setLogs] = useState(getActivityLogs());
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');

  useEffect(() => {
    const handleUpdate = () => {
      setLogs(getActivityLogs());
    };
    window.addEventListener('osas_storage_updated', handleUpdate);
    return () => window.removeEventListener('osas_storage_updated', handleUpdate);
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.performedBy.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());
    const matchesModule = moduleFilter === 'ALL' || log.module === moduleFilter;
    return matchesSearch && matchesModule;
  });

  const modulesList = Array.from(new Set(logs.map((l) => l.module)));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">System Activity Audit Trail</h3>
            <p className="text-[11px] text-slate-500">Real-time log recording every action taken within OSAS (Auto-retained for 30 days)</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="ALL">All Modules</option>
            {modulesList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
        {filteredLogs.map((log) => (
          <div key={log.id} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-800 rounded">
                  {log.module}
                </span>
                <h4 className="text-xs font-bold text-slate-900">{log.action}</h4>
              </div>
              <p className="text-xs text-slate-600 leading-snug">{log.details}</p>
              <p className="text-[10px] text-slate-400 font-medium">Performed by: {log.performedBy}</p>
            </div>
            <span className="text-[10px] text-slate-400 font-mono shrink-0 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(log.timestamp).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
