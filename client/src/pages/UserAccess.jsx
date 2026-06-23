import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';

const OWNER = 'rudy.choufani@skykapital.com';
const ROLES = [
  { value: 'admin',     label: 'Administrator' },
  { value: 'viewer',    label: 'Viewer' },
  { value: 'submitter', label: 'Grievance Submitter' },
  { value: 'auditor',   label: 'Auditor (Lender)' },
];
const roleBadge = {
  admin:     'bg-[#1a3c5e] text-white',
  viewer:    'bg-blue-100 text-blue-700',
  submitter: 'bg-amber-100 text-amber-700',
  auditor:   'bg-purple-100 text-purple-700',
};

export default function UserAccess({ user }) {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // New user form
  const [nu, setNu] = useState({ username: '', password: '', role: 'viewer', scope_project_id: '', scope_sub_section_id: '' });
  const [creating, setCreating] = useState(false);

  // Reset-password modal
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPwd, setResetPwd] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, pRes] = await Promise.all([api.get('/users'), api.get('/grv-projects')]);
      setUsers(uRes.data);
      setProjects(pRes.data);
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function projName(id) { return projects.find(p => p.id === id)?.name || ''; }
  function subName(pid, sid) {
    const p = projects.find(x => x.id === pid);
    return (p?.grv_sub_sections || []).find(s => s.id === sid)?.name || '';
  }

  // Guard: only owner
  if (user && user.username !== OWNER) return <Navigate to="/" />;

  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); }

  async function createUser(e) {
    e.preventDefault();
    if (nu.role === 'auditor' && !nu.scope_project_id) { flash('error', 'Select a project for the auditor.'); return; }
    setCreating(true);
    try {
      const payload = {
        username: nu.username, password: nu.password, role: nu.role,
        scope_project_id: nu.role === 'auditor' ? Number(nu.scope_project_id) : null,
        scope_sub_section_id: nu.role === 'auditor' && nu.scope_sub_section_id ? Number(nu.scope_sub_section_id) : null,
      };
      await api.post('/users', payload);
      flash('success', `User "${nu.username.toLowerCase()}" created.`);
      setNu({ username: '', password: '', role: 'viewer', scope_project_id: '', scope_sub_section_id: '' });
      load();
    } catch (err) { flash('error', err.response?.data?.error || 'Could not create user.'); }
    setCreating(false);
  }

  async function changeRole(u, role) {
    try {
      const body = { role };
      // Auditor needs a scope — default to the first project if none set yet
      if (role === 'auditor') body.scope_project_id = u.scope_project_id || projects[0]?.id;
      await api.patch(`/users/${encodeURIComponent(u.username)}`, body);
      load();
    } catch (err) { flash('error', err.response?.data?.error || 'Could not update role.'); }
  }

  async function changeScope(u, field, value) {
    try {
      const body = { [field]: value ? Number(value) : null };
      if (field === 'scope_project_id') body.scope_sub_section_id = null; // reset sub when project changes
      await api.patch(`/users/${encodeURIComponent(u.username)}`, body);
      load();
    } catch (err) { flash('error', err.response?.data?.error || 'Could not update scope.'); }
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
            <select value={nu.role} onChange={e => setNu(s => ({ ...s, role: e.target.value, scope_project_id: '', scope_sub_section_id: '' }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {nu.role === 'auditor' && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Audited Project *</label>
                <select value={nu.scope_project_id} onChange={e => setNu(s => ({ ...s, scope_project_id: e.target.value, scope_sub_section_id: '' }))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]">
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Sub-Section (optional)</label>
                <select value={nu.scope_sub_section_id} onChange={e => setNu(s => ({ ...s, scope_sub_section_id: e.target.value }))}
                  disabled={!nu.scope_project_id}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] disabled:opacity-50">
                  <option value="">Whole project</option>
                  {(projects.find(p => p.id === Number(nu.scope_project_id))?.grv_sub_sections || []).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <button type="submit" disabled={creating}
            className="px-4 py-2 bg-[#1a3c5e] text-white text-sm font-bold rounded-lg hover:bg-[#122d47] disabled:opacity-50 transition-colors">
            {creating ? 'Adding…' : '+ Add User'}
          </button>
        </form>
        {nu.role === 'auditor' && (
          <p className="mt-3 text-xs text-purple-600 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
            🔒 Auditor accounts (for lenders) see <strong>only the Grievances dashboard</strong>, read-only, restricted to the selected project{nu.scope_sub_section_id ? ' / sub-section' : ''}.
          </p>
        )}
      </div>

      {/* Users list */}
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">{users.length} user{users.length !== 1 ? 's' : ''}</span>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100 text-left">
              {['Username', 'Role', 'Scope', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>}
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
                    {u.role === 'auditor' ? (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <select value={u.scope_project_id || ''} onChange={e => changeScope(u, 'scope_project_id', e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white">
                          <option value="">— project —</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select value={u.scope_sub_section_id || ''} onChange={e => changeScope(u, 'scope_sub_section_id', e.target.value)}
                          disabled={!u.scope_project_id}
                          className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white disabled:opacity-50">
                          <option value="">Whole project</option>
                          {(projects.find(p => p.id === u.scope_project_id)?.grv_sub_sections || []).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
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
