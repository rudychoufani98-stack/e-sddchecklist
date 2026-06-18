import { useState } from 'react';
import api from '../api';

export default function Settings({ user }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null); // {type, text}
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) { setMsg({ type: 'error', text: 'New passwords do not match.' }); return; }
    if (next.length < 8) { setMsg({ type: 'error', text: 'New password must be at least 8 characters.' }); return; }
    setSaving(true);
    try {
      await api.post('/users/change-password', { current_password: cur, new_password: next });
      setMsg({ type: 'success', text: 'Password updated successfully.' });
      setCur(''); setNext(''); setConfirm('');
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Could not update password.' });
    }
    setSaving(false);
  }

  const roleLabel = user?.role === 'admin' ? 'Administrator' : user?.role === 'submitter' ? 'Grievance Submitter' : 'Viewer';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-black text-[#1a3c5e] mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">Manage your account.</p>

      {/* Account card */}
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6 mb-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Account</p>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD700] to-[#e6b800] flex items-center justify-center shadow-sm">
            <span className="text-[#1a3c5e] font-black">{user?.username?.slice(0,2).toUpperCase()}</span>
          </div>
          <div>
            <p className="font-bold text-gray-800 break-all">{user?.username}</p>
            <p className="text-sm text-gray-400">{roleLabel}</p>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Change Password</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
            <input type="password" value={cur} onChange={e => setCur(e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <input type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={8}
              placeholder="At least 8 characters"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
          </div>
          {msg && (
            <p className={`text-sm font-semibold ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
          )}
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 bg-[#1a3c5e] text-white font-bold rounded-xl hover:bg-[#122d47] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
