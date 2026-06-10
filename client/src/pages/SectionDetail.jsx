import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import DeliverableRow from '../components/DeliverableRow';
import FilePanel from '../components/FilePanel';

function AddDeliverableModal({ sectionId, onClose, onAdd }) {
  const [title, setTitle] = useState('');
  const [isDocType, setIsDocType] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/sections/${sectionId}/deliverables`, { title: title.trim(), is_doc_type: isDocType });
      onAdd(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add deliverable');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">Add Deliverable</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Noise Management Plan"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isDocType"
              checked={isDocType}
              onChange={e => setIsDocType(e.target.checked)}
              className="w-4 h-4 rounded text-[#1a3c5e]"
            />
            <label htmlFor="isDocType" className="text-sm text-gray-700">
              Project document (not a deliverable checklist item)
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving || !title.trim()} className="flex-1 py-2.5 bg-[#1a3c5e] text-white rounded-lg hover:bg-[#122d47] transition-colors text-sm font-medium disabled:opacity-60">
              {saving ? 'Adding...' : 'Add Deliverable'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const STATUS_META = {
  Yes:     { label: 'Complete',    bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  Ongoing: { label: 'In Progress', bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-400'  },
  No:      { label: 'Not Started', bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400'   },
};

export default function SectionDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [section, setSection] = useState(null);
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filePanel, setFilePanel] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    api.get(`/sections/${id}/deliverables`)
      .then(res => { setSection(res.data.section); setDeliverables(res.data.deliverables); })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id]);

  function handleUpdate(updated) {
    setDeliverables(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d));
  }

  function handleDelete(delId) {
    setDeliverables(prev => prev.filter(d => d.id !== delId));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1a3c5e] border-t-transparent" />
      </div>
    );
  }

  const regular = deliverables.filter(d => !d.is_doc_type);
  const docTypes = deliverables.filter(d => d.is_doc_type);

  const total = regular.length;
  const complete = regular.filter(d => d.status === 'Yes').length;
  const inProgress = regular.filter(d => d.status === 'Ongoing').length;
  const notStarted = regular.filter(d => d.status === 'No').length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  const filtered = filter === 'All' ? regular : regular.filter(d => d.status === (filter === 'Complete' ? 'Yes' : filter === 'In Progress' ? 'Ongoing' : 'No'));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {filePanel && (
        <FilePanel
          deliverable={filePanel.deliverable}
          sectionId={id}
          isAdmin={isAdmin}
          onClose={() => setFilePanel(null)}
        />
      )}
      {showAdd && (
        <AddDeliverableModal
          sectionId={id}
          onClose={() => setShowAdd(false)}
          onAdd={d => setDeliverables(prev => [...prev, d])}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-[#1a3c5e]">{section?.name}</h2>
          <p className="text-gray-500 text-sm">E&amp;S Deliverables Checklist</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a3c5e] text-white text-sm font-medium rounded-lg hover:bg-[#122d47] transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Deliverable
          </button>
        )}
      </div>

      {/* Progress card */}
      <div className="bg-gradient-to-br from-[#1a3c5e] to-[#0f2540] rounded-2xl p-5 mb-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium opacity-80">Overall Progress</span>
          <span className="text-3xl font-black">{pct}<span className="text-base font-medium opacity-70">%</span></span>
        </div>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-white/20 mb-4">
          <div className="h-2.5 bg-emerald-400 transition-all duration-700" style={{ width: `${Math.round(complete/total*100)||0}%` }} />
          <div className="h-2.5 bg-amber-400 transition-all duration-700" style={{ width: `${Math.round(inProgress/total*100)||0}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Complete',    count: complete,    color: 'text-emerald-300' },
            { label: 'In Progress', count: inProgress,  color: 'text-amber-300' },
            { label: 'Not Started', count: notStarted,  color: 'text-blue-200' },
          ].map(({ label, count, color }) => (
            <div key={label} className="bg-white/10 rounded-xl py-2.5">
              <div className={`text-xl font-bold ${color}`}>{count}</div>
              <div className="text-blue-200 text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {['All', 'Not Started', 'In Progress', 'Complete'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-[#1a3c5e] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1a3c5e] hover:text-[#1a3c5e]'
            }`}
          >
            {f}
            {f === 'All' ? ` (${total})` : f === 'Complete' ? ` (${complete})` : f === 'In Progress' ? ` (${inProgress})` : ` (${notStarted})`}
          </button>
        ))}
      </div>

      {/* Deliverables table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Required Documentation</h3>
          {!isAdmin && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Read-only</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-10">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Deliverable</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Comments</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">Files</th>
                {isAdmin && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-gray-400 text-sm">No deliverables match this filter.</td></tr>
              )}
              {filtered.map(d => (
                <DeliverableRow
                  key={d.id}
                  deliverable={d}
                  isAdmin={isAdmin}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onFilesClick={del => setFilePanel({ deliverable: del })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project documents */}
      {docTypes.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Project Documents</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {docTypes.map(doc => (
              <button
                key={doc.id}
                onClick={() => setFilePanel({ deliverable: doc })}
                className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl hover:border-[#1a3c5e] hover:bg-blue-50/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#1a3c5e]/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-[#1a3c5e]/20 transition-colors">
                    <svg className="w-4 h-4 text-[#1a3c5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{doc.title}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${doc.fileCount > 0 ? 'bg-[#1a3c5e] text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {doc.fileCount || 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
