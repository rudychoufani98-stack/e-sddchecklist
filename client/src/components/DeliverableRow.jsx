import { useState } from 'react';
import StatusBadge from './StatusBadge';
import api from '../api';

const STATUS_OPTIONS = ['No', 'Ongoing', 'Yes'];

export default function DeliverableRow({ deliverable, isAdmin, onUpdate, onFilesClick }) {
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState({
    status: deliverable.status,
    delivery_date: deliverable.delivery_date || '',
    comments: deliverable.comments || '',
  });
  const [saving, setSaving] = useState(false);

  async function save(field, value) {
    setSaving(true);
    try {
      const res = await api.patch(`/deliverables/${deliverable.id}`, { [field]: value || null });
      onUpdate(res.data);
    } catch {
      setValues((v) => ({ ...v, [field]: deliverable[field] || '' }));
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }

  function handleKeyDown(e, field) {
    if (e.key === 'Enter') save(field, values[field]);
    if (e.key === 'Escape') {
      setValues((v) => ({ ...v, [field]: deliverable[field] || '' }));
      setEditing(null);
    }
  }

  const pencil = (field) =>
    isAdmin ? (
      <button
        onClick={() => setEditing(field)}
        className="ml-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#1a3c5e] transition-opacity"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    ) : null;

  return (
    <tr className="group hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
        {deliverable.number ?? '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-800 max-w-xs">
        {deliverable.title}
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        {editing === 'status' && isAdmin ? (
          <select
            autoFocus
            value={values.status}
            onChange={(e) => {
              setValues((v) => ({ ...v, status: e.target.value }));
              save('status', e.target.value);
            }}
            onBlur={() => setEditing(null)}
            className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1a3c5e]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'No' ? 'Not Started' : s === 'Ongoing' ? 'In Progress' : 'Complete'}</option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-1">
            <StatusBadge status={values.status} />
            {pencil('status')}
          </div>
        )}
      </td>

      {/* Delivery Date */}
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
        {editing === 'delivery_date' && isAdmin ? (
          <input
            autoFocus
            type="text"
            value={values.delivery_date}
            onChange={(e) => setValues((v) => ({ ...v, delivery_date: e.target.value }))}
            onBlur={() => save('delivery_date', values.delivery_date)}
            onKeyDown={(e) => handleKeyDown(e, 'delivery_date')}
            placeholder="dd/mm/yy"
            className="w-28 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1a3c5e]"
          />
        ) : (
          <div className="flex items-center gap-1">
            <span>{values.delivery_date || '—'}</span>
            {pencil('delivery_date')}
          </div>
        )}
      </td>

      {/* Comments */}
      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
        {editing === 'comments' && isAdmin ? (
          <textarea
            autoFocus
            value={values.comments}
            onChange={(e) => setValues((v) => ({ ...v, comments: e.target.value }))}
            onBlur={() => save('comments', values.comments)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setValues((v) => ({ ...v, comments: deliverable.comments || '' })); setEditing(null); } }}
            rows={2}
            className="w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1a3c5e] resize-none"
          />
        ) : (
          <div className="flex items-start gap-1">
            <span className="line-clamp-2">{values.comments || '—'}</span>
            {pencil('comments')}
          </div>
        )}
      </td>

      {/* Files */}
      <td className="px-4 py-3 whitespace-nowrap">
        <button
          onClick={() => onFilesClick(deliverable)}
          className="flex items-center gap-1.5 text-sm text-[#1a3c5e] hover:text-[#122d47] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span>{deliverable.fileCount || 0}</span>
        </button>
      </td>
    </tr>
  );
}
