import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const STATUS_META = {
  Yes:     { label: 'Complete',    bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  Ongoing: { label: 'In Progress', bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-400',   bar: 'bg-amber-400'  },
  No:      { label: 'Not Started', bg: 'bg-gray-100',    text: 'text-gray-500',    border: 'border-gray-200',    dot: 'bg-gray-400',    bar: 'bg-gray-400'   },
};

// Parse "dd/mm/yy" or "dd/mm/yyyy" → Date
function parseDate(str) {
  if (!str) return null;
  const parts = str.trim().split('/');
  if (parts.length !== 3) return null;
  let [d, m, y] = parts.map(Number);
  if (y < 100) y += 2000;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

function formatMonth(date) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function daysFromNow(date) {
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((date - today) / 86400000);
}

function DueBadge({ date }) {
  const days = daysFromNow(date);
  if (days < 0) return <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{Math.abs(days)}d overdue</span>;
  if (days === 0) return <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">Due today</span>;
  if (days <= 7) return <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Due in {days}d</span>;
  return <span className="text-xs text-gray-400">{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>;
}

export default function Timeline() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProject, setSelectedProject] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  useEffect(() => {
    api.get('/sections/timeline/all')
      .then(res => setItems(res.data))
      .catch(() => setError('Failed to load timeline'))
      .finally(() => setLoading(false));
  }, []);

  const projects = ['All', ...Array.from(new Set(items.map(i => i.section_name))).sort()];

  const filtered = items.filter(item => {
    if (selectedProject !== 'All' && item.section_name !== selectedProject) return false;
    if (selectedStatus !== 'All' && item.status !== selectedStatus) return false;
    return true;
  });

  // Group by month
  const parsed = filtered
    .map(item => ({ ...item, _date: parseDate(item.delivery_date) }))
    .filter(item => item._date)
    .sort((a, b) => a._date - b._date);

  const grouped = [];
  const seen = {};
  for (const item of parsed) {
    const key = formatMonth(item._date);
    if (!seen[key]) { seen[key] = true; grouped.push({ month: key, date: item._date, items: [] }); }
    grouped[grouped.length - 1].items.push(item);
  }

  // Summary stats
  const overdue = parsed.filter(i => i._date && daysFromNow(i._date) < 0 && i.status !== 'Yes').length;
  const upcoming7 = parsed.filter(i => { const d = daysFromNow(i._date); return d >= 0 && d <= 7 && i.status !== 'Yes'; }).length;
  const total = parsed.length;
  const done = parsed.filter(i => i.status === 'Yes').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1a3c5e] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1a3c5e]">Timeline</h2>
        <p className="text-gray-500 text-sm mt-0.5">Deliverable deadlines across all projects</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
        {[
          { label: 'Total Deadlines', value: total,     color: 'text-[#1a3c5e]', bg: 'bg-blue-50',    border: 'border-blue-100' },
          { label: 'Complete',        value: done,      color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Due This Week',   value: upcoming7, color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-100' },
          { label: 'Overdue',         value: overdue,   color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-100' },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className={`${bg} border ${border} rounded-2xl p-4 text-center`}>
            <div className={`text-3xl font-black ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Project</label>
          <div className="flex flex-wrap gap-1.5">
            {projects.map(p => (
              <button
                key={p}
                onClick={() => setSelectedProject(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedProject === p
                    ? 'bg-[#1a3c5e] text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1a3c5e] hover:text-[#1a3c5e]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
          <div className="flex gap-1.5">
            {['All', 'No', 'Ongoing', 'Yes'].map(s => (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedStatus === s
                    ? 'bg-[#1a3c5e] text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1a3c5e] hover:text-[#1a3c5e]'
                }`}
              >
                {s === 'All' ? 'All' : s === 'Yes' ? 'Complete' : s === 'Ongoing' ? 'In Progress' : 'Not Started'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {grouped.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No deadlines found for this filter.</p>
        </div>
      )}

      {/* Timeline groups */}
      <div className="space-y-8">
        {grouped.map(({ month, date, items: monthItems }) => {
          const isPast = date < new Date() && date.getMonth() < new Date().getMonth() || date.getFullYear() < new Date().getFullYear();
          const isCurrentMonth = date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();

          return (
            <div key={month}>
              {/* Month header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                  isCurrentMonth
                    ? 'bg-[#1a3c5e] text-white'
                    : isPast
                    ? 'bg-gray-100 text-gray-500'
                    : 'bg-blue-50 text-[#1a3c5e]'
                }`}>
                  {month}
                  {isCurrentMonth && <span className="ml-2 text-xs font-normal opacity-75">current</span>}
                </div>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{monthItems.length} deadline{monthItems.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Items */}
              <div className="space-y-2.5 pl-2">
                {monthItems.map(item => {
                  const meta = STATUS_META[item.status] || STATUS_META.No;
                  const days = daysFromNow(item._date);
                  const isOverdue = days < 0 && item.status !== 'Yes';

                  return (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/sections/${item.section_id}`)}
                      className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md group ${
                        isOverdue
                          ? 'bg-red-50 border-red-200 hover:border-red-400'
                          : `bg-white ${meta.border} border hover:border-[#1a3c5e]`
                      }`}
                    >
                      {/* Left accent bar */}
                      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-400' : meta.bar}`} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 group-hover:text-[#1a3c5e] transition-colors truncate">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs font-medium text-[#1a3c5e] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                {item.section_name}
                              </span>
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </span>
                            </div>
                            {item.comments && (
                              <p className="text-xs text-gray-400 mt-1.5 line-clamp-1">{item.comments}</p>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <DueBadge date={item._date} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
