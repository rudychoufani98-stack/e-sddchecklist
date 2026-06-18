import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const STATUS_COLORS = {
  complete: 'bg-emerald-500',
  inProgress: 'bg-amber-400',
  notStarted: 'bg-gray-200',
};

function AddProjectModal({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/sections', { name: name.trim() });
      onAdd(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">Add New Project</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. SBS 4, LCCH 5..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] focus:border-transparent"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()} className="flex-1 py-2.5 bg-[#1a3c5e] text-white rounded-lg hover:bg-[#122d47] transition-colors text-sm font-medium disabled:opacity-60">
              {saving ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectionCard({ section, index, isAdmin, onDelete }) {
  const navigate = useNavigate();
  const [animated, setAnimated] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80 + index * 60);
    return () => clearTimeout(t);
  }, [index]);

  const pct = section.total > 0 ? Math.round((section.complete / section.total) * 100) : 0;

  const statusItems = [
    { label: 'Complete', count: section.complete, dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'In Progress', count: section.inProgress, dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Not Started', count: section.notStarted, dot: 'bg-gray-300', text: 'text-gray-600', bg: 'bg-gray-50' },
  ];

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group"
      style={{ opacity: animated ? 1 : 0, transform: animated ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 0.4s ease, transform 0.4s ease' }}
      onClick={() => navigate(`/sections/${section.id}`)}
    >
      <div className="h-1.5 bg-gray-100">
        <div
          className="h-1.5 bg-gradient-to-r from-[#1a3c5e] to-blue-400 transition-all duration-700"
          style={{ width: animated ? `${pct}%` : '0%' }}
        />
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#1a3c5e] group-hover:text-blue-700 transition-colors">{section.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{section.total} deliverables</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-2xl font-bold text-[#1a3c5e]">{pct}%</div>
              <div className="text-xs text-gray-400">done</div>
            </div>
            {isAdmin && (
              <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setShowMenu(v => !v)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[130px]">
                    <button
                      onClick={() => { setShowMenu(false); navigate(`/sections/${section.id}`); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >View / Edit</button>
                    <button
                      onClick={() => { setShowMenu(false); onDelete(section); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 gap-0.5">
            {section.total > 0 && (
              <>
                <div className={`h-2 ${STATUS_COLORS.complete} transition-all duration-700`} style={{ width: animated ? `${Math.round(section.complete/section.total*100)}%` : '0%' }} />
                <div className={`h-2 ${STATUS_COLORS.inProgress} transition-all duration-700`} style={{ width: animated ? `${Math.round(section.inProgress/section.total*100)}%` : '0%' }} />
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {statusItems.map(({ label, count, dot, text, bg }) => (
            <div key={label} className={`${bg} rounded-lg p-2.5 text-center`}>
              <div className={`text-sm font-bold ${text}`}>{count}</div>
              <div className={`text-xs ${text} opacity-80`}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">{section.complete} of {section.total} complete</span>
          <span className="text-xs font-medium text-[#1a3c5e] group-hover:underline">View details →</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const user = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    api.get('/sections')
      .then(res => setSections(res.data))
      .catch(() => setError('Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(section) {
    setDeleting(true);
    try {
      await api.delete(`/sections/${section.id}`);
      setSections(prev => prev.filter(s => s.id !== section.id));
    } catch {
      alert('Failed to delete project');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const totals = sections.reduce((acc, s) => ({
    total: acc.total + s.total,
    complete: acc.complete + s.complete,
    inProgress: acc.inProgress + s.inProgress,
    notStarted: acc.notStarted + s.notStarted,
  }), { total: 0, complete: 0, inProgress: 0, notStarted: 0 });

  const overallPct = totals.total > 0 ? Math.round((totals.complete / totals.total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1a3c5e] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {showAdd && <AddProjectModal onClose={() => setShowAdd(false)} onAdd={s => setSections(prev => [...prev, s])} />}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Project</h3>
            <p className="text-sm text-gray-600 mb-5">
              Delete <strong>{deleteTarget.name}</strong> and all its deliverables? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteTarget)} disabled={deleting} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-60">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero summary banner */}
      <div className="relative bg-gradient-to-br from-[#1a3c5e] to-[#0f2540] rounded-2xl p-6 mb-8 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-bold opacity-95">Portfolio Overview</h2>
              <p className="text-blue-200 text-sm mt-0.5">E&amp;S Due Diligence — {sections.length} active projects</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-black">{overallPct}<span className="text-2xl font-semibold opacity-70">%</span></div>
              <div className="text-blue-200 text-xs">overall complete</div>
            </div>
          </div>

          <div className="flex h-3 rounded-full overflow-hidden bg-white/20 mb-4">
            <div className="h-3 bg-emerald-400 transition-all duration-1000" style={{ width: `${Math.round(totals.complete/totals.total*100) || 0}%` }} />
            <div className="h-3 bg-amber-400 transition-all duration-1000" style={{ width: `${Math.round(totals.inProgress/totals.total*100) || 0}%` }} />
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Complete', count: totals.complete, color: 'text-emerald-300' },
              { label: 'In Progress', count: totals.inProgress, color: 'text-amber-300' },
              { label: 'Not Started', count: totals.notStarted, color: 'text-blue-200' },
            ].map(({ label, count, color }) => (
              <div key={label} className="bg-white/10 rounded-xl py-3">
                <div className={`text-2xl font-bold ${color}`}>{count}</div>
                <div className="text-blue-200 text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projects header + add button */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Projects</h3>
          <p className="text-sm text-gray-500">Click a project to view and edit deliverables</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a3c5e] text-white text-sm font-medium rounded-lg hover:bg-[#122d47] transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Project
          </button>
        )}
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {sections.map((section, i) => (
          <SectionCard
            key={section.id}
            section={section}
            index={i}
            isAdmin={isAdmin}
            onDelete={setDeleteTarget}
          />
        ))}
        {sections.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No projects yet. {isAdmin && 'Click "Add Project" to get started.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
