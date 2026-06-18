import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';

const OWNER = 'rudy.choufani@skykapital.com';
const ROLES = [
  { value: 'admin',     label: 'Administrator' },
  { value: 'viewer',    label: 'Viewer' },
  { value: 'submitter', label: 'Grievance Submitter' },
];
const roleBadge = {
  admin:     'bg-[#1a3c5e] text-white',
  viewer:    'bg-blue-100 text-blue-700',
  submitter: 'bg-amber-100 text-amber-700',
};

export default function UserAccess({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // New user form
  const [nu, setNu] = useState({ username: '', password: '', role: 'viewer' });
  const [creating, setCreating] = useState(false);

  // Reset-password modal
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPwd, setResetPwd] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get('/users'); setUsers(res.data); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Guard: only owner
  if (user && user.username !== OWNER) return <Navigate to="/" />;

  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); }

  async function createUser(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/users', nu);
      flash('success', `User "${nu.username.toLowerCase()}" created.`);
      setNu({ username: '', password: '', role: 'viewer' });
      load();
    } catch (err) { flash('error', err.response?.data?.error || 'Could not create user.'); }
    setCreating(false);
  }

  async function changeRole(u, role) {
    try { await api.patch(`/users/${encodeURIComponent(u.username)}`, { role }); load(); }
    catch (err) { flash('error', err.response?.data?.error || 'Could not update role.'); }
  }

  async function resetPassword() {
    try {
      await api.patch(`/users/${encodeURIComponent(resetTarget.username)}`, { new_password: resetPwd });
      flash('success', `Password reset for "${resetTarget.username}".`);
      setResetTarget(null); setResetPwd('');
    } catch (err) { flash('error', err.response?.data?.error || 'Could not reset password.'); }
  }

  async function deleteUser() {
    try {
      await api.delete(`/users/${encodeURIComponent(deleteTarget.username)}`);
      flash('success', `User "${deleteTarget.username}" deleted.`);
      setDeleteTarget(null); load();
    } catch (err) { flash('error', err.response?.data?.error || 'Could not delete user.'); setDeleteTarget(null); }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-black text-[#1a3c5e] mb-1">User Access</h1>
      <p className="text-sm text-gray-500 mb-6">Create accounts, set roles, reset passwords. Restricted to the owner account.</p>

      {msg && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-sm font-semibold ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Create user */}
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6 mb-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Add New User</p>
        <form onSubmit={createUser} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-gray-500 mb-1">Username / Email</label>
            <input value={nu.username} onChange={e => setNu(s => ({ ...s, username: e.target.value }))} required
              placeholder="name@company.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-bold text-gray-500 mb-1">Temporary Password</label>
            <input type="text" value={nu.password} onChange={e => setNu(s => ({ ...s, password: e.target.value }))} required minLength={8}
              placeholder="min 8 characters"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Role</label>
            <select value={nu.role} onChange={e => setNu(s => ({ ...s, role: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button type="submit" disabled={creating}
            className="px-4 py-2 bg-[#1a3c5e] text-white text-sm font-bold rounded-lg hover:bg-[#122d47] disabled:opacity-50 transition-colors">
            {creating ? 'Adding…' : '+ Add User'}
          </button>
        </form>
      </div>

      {/* Users list */}
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">{users.length} user{users.length !== 1 ? 's' : ''}</span>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100 text-left">
              {['Username', 'Role', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && <tr><td colSpan={3} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>}
            {!loading && users.map(u => {
              const isOwner = u.username === OWNER;
              return (
                <tr key={u.username} className="hover:bg-amber-50/20">
                  <td className="px-5 py-3 font-medium text-gray-800 break-all">
                    {u.username}
                    {isOwner && <span className="ml-2 text-[10px] font-bold text-[#FFD700] bg-[#1a3c5e] px-1.5 py-0.5 rounded">OWNER</span>}
                  </td>
                  <td className="px-5 py-3">
                    {isOwner ? (
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${roleBadge.admin}`}>Administrator</span>
                    ) : (
                      <select value={u.role} onChange={e => changeRole(u, e.target.value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border-0 cursor-pointer ${roleBadge[u.role] || ''}`}>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setResetTarget(u); setResetPwd(''); }}
                        className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                        Reset Password
                      </button>
                      {!isOwner && (
                        <button onClick={() => setDeleteTarget(u)}
                          className="px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setResetTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-4 break-all">{resetTarget.username}</p>
            <input type="text" value={resetPwd} onChange={e => setResetPwd(e.target.value)} autoFocus minLength={8}
              placeholder="New password (min 8 characters)"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setResetTarget(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={resetPassword} disabled={resetPwd.length < 8}
                className="px-4 py-2 text-sm font-bold bg-[#1a3c5e] text-white rounded-xl hover:bg-[#122d47] disabled:opacity-50">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete User</h3>
            <p className="text-sm text-gray-600 mb-5">Delete <strong className="break-all">{deleteTarget.username}</strong>? They will lose access immediately.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={deleteUser} className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
