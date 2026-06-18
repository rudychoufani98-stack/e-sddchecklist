import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const STATUS_META = {
  Yes:     { label: 'Complete',    dot: 'bg-emerald-500', ring: 'ring-emerald-300', text: 'text-emerald-700', bg: 'bg-emerald-50',  tooltip: 'border-emerald-200' },
  Ongoing: { label: 'In Progress', dot: 'bg-amber-400',   ring: 'ring-amber-300',   text: 'text-amber-700',   bg: 'bg-amber-50',    tooltip: 'border-amber-200'   },
  No:      { label: 'Not Started', dot: 'bg-gray-400',    ring: 'ring-gray-200',    text: 'text-gray-500',    bg: 'bg-gray-50',     tooltip: 'border-gray-200'    },
  overdue: { label: 'Overdue',     dot: 'bg-red-500',     ring: 'ring-red-300',     text: 'text-red-700',     bg: 'bg-red-50',      tooltip: 'border-red-200'     },
};

function parseDate(str) {
  if (!str) return null;
  const parts = str.trim().split('/');
  if (parts.length !== 3) return null;
  let [d, m, y] = parts.map(Number);
  if (y < 100) y += 2000;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date) {
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function daysFromNow(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((date - today) / 86400000);
}

function getStatusKey(item) {
  if (item.status !== 'Yes' && item._date && daysFromNow(item._date) < 0) return 'overdue';
  return item.status;
}

export default function Timeline() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null); // { item, x, y }
  const [selectedStatus, setSelectedStatus] = useState('All');
  const containerRef = useRef(null);

  useEffect(() => {
    api.get('/sections/timeline/all')
      .then(res => setItems(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const parsed = items
    .map(i => ({ ...i, _date: parseDate(i.delivery_date) }))
    .filter(i => i._date);

  // Date range: from earliest to latest + 1 month padding
  const allDates = parsed.map(i => i._date);
  if (allDates.length === 0 && !loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-[#1a3c5e] mb-2">Timeline</h2>
        <p className="text-gray-500 text-sm">No deliverables with deadlines found.</p>
      </div>
    );
  }

  const minDate = allDates.length ? new Date(Math.min(...allDates)) : new Date();
  const maxDate = allDates.length ? new Date(Math.max(...allDates)) : new Date();
  minDate.setDate(1);
  maxDate.setDate(1); maxDate.setMonth(maxDate.getMonth() + 2);

  // Build array of months between min and max
  const months = [];
  const cursor = new Date(minDate);
  while (cursor <= maxDate) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Group items by section
  const sectionMap = {};
  for (const item of parsed) {
    if (!sectionMap[item.section_id]) {
      sectionMap[item.section_id] = { id: item.section_id, name: item.section_name, items: [] };
    }
    sectionMap[item.section_id].items.push(item);
  }
  const sections = Object.values(sectionMap).sort((a, b) => a.id - b.id);

  const MONTH_W = 120; // px per month column
  const ROW_H = 56;    // px per project row
  const LABEL_W = 120; // left label column

  function dateToX(date) {
    const totalMs = maxDate - minDate;
    const offsetMs = date - minDate;
    return (offsetMs / totalMs) * (months.length * MONTH_W);
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayX = dateToX(today);

  // Filter items
  const filterFn = (item) => {
    if (selectedStatus === 'All') return true;
    return getStatusKey(item) === selectedStatus;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1a3c5e] border-t-transparent" />
      </div>
    );
  }

  // Stats
  const totalItems = parsed.length;
  const overdueItems = parsed.filter(i => getStatusKey(i) === 'overdue').length;
  const completeItems = parsed.filter(i => i.status === 'Yes').length;
  const thisWeek = parsed.filter(i => { const d = daysFromNow(i._date); return d >= 0 && d <= 7 && i.status !== 'Yes'; }).length;

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-6">
        <h2 className="text-2xl font-bold text-[#1a3c5e]">Timeline</h2>
        <p className="text-gray-500 text-sm mt-0.5">Project deadlines plotted across time — hover dots for details</p>
      </div>

      {/* Stats */}
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',        value: totalItems,    color: 'text-[#1a3c5e]', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Complete',     value: completeItems, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'This Week',    value: thisWeek,      color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-100' },
          { label: 'Overdue',      value: overdueItems,  color: 'text-red-700',    bg: 'bg-red-50 border-red-100' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`border rounded-xl p-3 text-center ${bg}`}>
            <div className={`text-2xl font-black ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="max-w-5xl mx-auto flex flex-wrap gap-1.5 mb-6">
        {[
          { key: 'All',     label: 'All' },
          { key: 'No',      label: 'Not Started' },
          { key: 'Ongoing', label: 'In Progress' },
          { key: 'Yes',     label: 'Complete' },
          { key: 'overdue', label: 'Overdue' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSelectedStatus(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedStatus === key
                ? 'bg-[#1a3c5e] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1a3c5e]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Gantt chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
        {/* Month header row */}
        <div className="flex border-b border-gray-100 bg-gray-50/80 sticky top-0 z-10">
          <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="flex-shrink-0 px-4 py-3 border-r border-gray-100">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project</span>
          </div>
          <div className="overflow-x-auto flex-1" id="header-scroll">
            <div className="flex" style={{ width: months.length * MONTH_W }}>
              {months.map((m, i) => {
                const isNow = m.getMonth() === today.getMonth() && m.getFullYear() === today.getFullYear();
                return (
                  <div
                    key={i}
                    style={{ width: MONTH_W, minWidth: MONTH_W }}
                    className={`px-2 py-3 border-r border-gray-100 text-xs font-semibold text-center ${
                      isNow ? 'text-[#1a3c5e] bg-blue-50' : 'text-gray-400'
                    }`}
                  >
                    {monthLabel(m)}
                    {isNow && <div className="text-[10px] font-normal text-blue-400">today</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Project rows */}
        <div className="divide-y divide-gray-50">
          {sections.map((section, si) => {
            const visibleItems = section.items.filter(filterFn);
            const rowBg = si % 2 === 0 ? 'bg-white' : 'bg-gray-50/40';

            return (
              <div key={section.id} className={`flex ${rowBg} hover:bg-blue-50/20 transition-colors`} style={{ minHeight: ROW_H }}>
                {/* Project label */}
                <div
                  style={{ width: LABEL_W, minWidth: LABEL_W }}
                  className="flex-shrink-0 px-4 py-3 border-r border-gray-100 flex items-center cursor-pointer group"
                  onClick={() => navigate(`/sections/${section.id}`)}
                >
                  <div>
                    <p className="text-sm font-bold text-[#1a3c5e] group-hover:underline leading-tight">{section.name}</p>
                    <p className="text-[10px] text-gray-400">{section.items.length} items</p>
                  </div>
                </div>

                {/* Timeline lane */}
                <div className="flex-1 overflow-x-auto relative" style={{ minHeight: ROW_H }}>
                  <div className="relative" style={{ width: months.length * MONTH_W, height: ROW_H }}>
                    {/* Month grid lines */}
                    {months.map((m, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-r border-gray-100"
                        style={{ left: (i + 1) * MONTH_W }}
                      />
                    ))}

                    {/* Today line */}
                    {todayX >= 0 && todayX <= months.length * MONTH_W && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-blue-400 z-10 opacity-60"
                        style={{ left: todayX }}
                      />
                    )}

                    {/* Deliverable dots */}
                    {section.items.map(item => {
                      const x = dateToX(item._date);
                      const sk = getStatusKey(item);
                      const meta = STATUS_META[sk];
                      const visible = filterFn(item);

                      return (
                        <button
                          key={item.id}
                          onClick={() => setTooltip(t => t?.item.id === item.id ? null : { item, x })}
                          style={{ left: x, top: '50%', transform: 'translate(-50%, -50%)', opacity: visible ? 1 : 0.15 }}
                          className={`absolute w-4 h-4 rounded-full ${meta.dot} ring-2 ${meta.ring} shadow-sm
                            hover:scale-150 transition-transform z-20 focus:outline-none`}
                          title={item.title}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex flex-wrap gap-4">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full ${meta.dot} ring-1 ${meta.ring}`} />
              <span className="text-xs text-gray-500">{meta.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-0.5 h-3 bg-blue-400 inline-block" />
            <span className="text-xs text-gray-500">Today</span>
          </div>
        </div>
      </div>

      {/* Tooltip / detail panel */}
      {tooltip && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setTooltip(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const item = tooltip.item;
              const sk = getStatusKey(item);
              const meta = STATUS_META[sk];
              const days = daysFromNow(item._date);
              return (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${meta.dot} flex-shrink-0 mt-0.5`} />
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>{meta.label}</span>
                    </div>
                    <button onClick={() => setTooltip(null)} className="text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <h4 className="text-base font-bold text-gray-900 mb-1">{item.title}</h4>
                  <p className="text-xs text-[#1a3c5e] font-semibold mb-3">{item.section_name}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-gray-400 mb-0.5">Due date</div>
                      <div className="font-semibold text-gray-700">{item.delivery_date}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-gray-400 mb-0.5">Days remaining</div>
                      <div className={`font-semibold ${days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-gray-700'}`}>
                        {days < 0 ? `${Math.abs(days)} overdue` : days === 0 ? 'Today' : `${days} days`}
                      </div>
                    </div>
                  </div>
                  {item.comments && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5 mb-3">
                      {item.comments}
                    </div>
                  )}
                  <button
                    onClick={() => { setTooltip(null); navigate(`/sections/${item.section_id}`); }}
                    className="w-full py-2 bg-[#1a3c5e] text-white text-sm font-medium rounded-lg hover:bg-[#122d47] transition-colors"
                  >
                    Open Project
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
