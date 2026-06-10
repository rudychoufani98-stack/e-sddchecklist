import { useState } from 'react';
import api from '../api';

const STATUS_OPTIONS = ['No', 'Ongoing', 'Yes'];
const STATUS_META = {
  Yes:     { label: 'Complete',    bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Ongoing: { label: 'In Progress', bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-400'  },
  No:      { label: 'Not Started', bg: 'bg-gray-100',    text: 'text-gray-500',    dot: 'bg-gray-400'   },
};

export default function DeliverableRow({ deliverable, isAdmin, onUpdate, onDelete, onFilesClick }) {
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState({
    status: deliverable.status,
    delivery_date: deliverable.delivery_date || '',
    comments: deliverable.comments || '',
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(field, value) {
    setSaving(true);
    try {
      const res = await api.patch(`/deliverables/${deliverable.id}`, { [field]: value || null });
      onUpdate(res.data);
    } catch {
      setValues(v => ({ ...v, [field]: deliverable[field] || '' }));
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/deliverables/${deliverable.id}`);
      onDelete(deliverable.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function handleKeyDown(e, field) {
    if (e.key === 'Enter') save(field, values[field]);
    if (e.key === 'Escape') { setValues(v => ({ ...v, [field]: deliverable[field] || '' })); setEditing(null); }
  }

  const meta = STATUS_META[values.status] || STATUS_META.No;

  if (confirmDelete) {
    return (
      <tr className="bg-red-50">
        <td colSpan={isAdmin ? 7 : 6} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-700">Delete <strong>{deliverable.title}</strong>?</span>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-white transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="group hover:bg-blue-50/30 transition-colors">
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap font-mono">
        {deliverable.number ?? '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-800 max-w-xs font-medium">
        {deliverable.title}
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        {editing === 'status' && isAdmin ? (
          <select
            autoFocus
            value={values.status}
            onChange={e => { setValues(v => ({ ...v, status: e.target.value })); save('status', e.target.value); }}
            onBlur={() => setEditing(null)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        ) : (
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-default ${meta.bg} ${meta.text} ${isAdmin ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={() => isAdmin && setEditing('status')}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} flex-shrink-0`} />
            {meta.label}
          </div>
        )}
      </td>

      {/* Due Date */}
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
        {editing === 'delivery_date' && isAdmin ? (
          <input
            autoFocus
            type="text"
            value={values.delivery_date}
            onChange={e => setValues(v => ({ ...v, delivery_date: e.target.value }))}
            onBlur={() => save('delivery_date', values.delivery_date)}
            onKeyDown={e => handleKeyDown(e, 'delivery_date')}
            placeholder="dd/mm/yy"
            className="w-24 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]"
          />
        ) : (
          <span
            onClick={() => isAdmin && setEditing('delivery_date')}
            className={`${isAdmin ? 'cursor-pointer hover:text-[#1a3c5e]' : ''} ${values.delivery_date ? 'text-gray-700' : 'text-gray-300'}`}
          >
            {values.delivery_date || '—'}
          </span>
        )}
      </td>

      {/* Comments */}
      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
        {editing === 'comments' && isAdmin ? (
          <textarea
            autoFocus
            value={values.comments}
            onChange={e => setValues(v => ({ ...v, comments: e.target.value }))}
            onBlur={() => save('comments', values.comments)}
            onKeyDown={e => { if (e.key === 'Escape') { setValues(v => ({ ...v, comments: deliverable.comments || '' })); setEditing(null); } }}
            rows={2}
            className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] resize-none"
          />
        ) : (
          <span
            onClick={() => isAdmin && setEditing('comments')}
            className={`line-clamp-2 ${isAdmin ? 'cursor-pointer hover:text-[#1a3c5e]' : ''} ${values.comments ? '' : 'text-gray-300'}`}
          >
            {values.comments || '—'}
          </span>
        )}
      </td>

      {/* Files */}
      <td className="px-4 py-3 whitespace-nowrap">
        <button
          onClick={() => onFilesClick(deliverable)}
          className={`flex items-center gap-1 text-xs font-medium rounded-lg px-2 py-1 transition-colors ${
            deliverable.fileCount > 0
              ? 'bg-[#1a3c5e] text-white hover:bg-[#122d47]'
              : 'text-gray-400 hover:text-[#1a3c5e] hover:bg-blue-50'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          {deliverable.fileCount || 0}
        </button>
      </td>

      {/* Delete (admin only) */}
      {isAdmin && (
        <td className="px-2 py-3 whitespace-nowrap">
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      )}
    </tr>
  );
}
