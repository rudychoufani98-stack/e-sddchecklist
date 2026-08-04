import { useState } from 'react';
import api from '../api';

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      localStorage.setItem('token', res.data.token);
      const u = {
        username: res.data.username,
        role: res.data.role,
        scope_project_ids: res.data.scope_project_ids ?? [],
        scope_sub_section_ids: res.data.scope_sub_section_ids ?? [],
        scope_project_id: res.data.scope_project_id ?? null,
        scope_sub_section_id: res.data.scope_sub_section_id ?? null,
      };
      localStorage.setItem('user', JSON.stringify(u));
      onLogin(u);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FDF6E3] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <svg viewBox="0 0 100 100" className="w-16 h-16 mx-auto mb-4 drop-shadow" aria-hidden="true">
            <path d="M0.64 0.00 L1.91 0.00 L12.10 10.19 L19.75 15.29 L33.76 21.02 L43.95 22.93 L60.51 22.29 L75.16 17.83 L85.99 11.46 L98.09 0.00 L99.36 0.00 L100.00 1.91 L88.54 14.01 L84.08 21.02 L80.89 28.03 L78.34 36.31 L77.71 43.31 L77.07 43.95 L77.07 56.05 L78.98 66.24 L84.71 80.25 L89.81 87.90 L100.00 98.73 L98.09 100.00 L88.54 90.45 L83.44 86.62 L68.79 79.62 L56.69 77.07 L43.31 77.07 L31.21 79.62 L18.47 85.35 L8.28 92.99 L1.91 100.00 L0.00 99.36 L0.00 98.09 L9.55 88.54 L16.56 77.71 L20.38 68.15 L22.93 54.78 L22.29 40.13 L18.47 26.75 L12.74 15.92 L8.92 10.83 L0.00 1.91 L0.00 0.64 Z" fill="#001a3d" />
          </svg>
          <h1 className="text-3xl font-black text-[#1a3c5e] tracking-tight">Skykapital</h1>
          <p className="text-gray-500 text-sm mt-1">E&amp;S Due Diligence Tracker</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] focus:border-transparent transition-shadow"
                placeholder="Enter username"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] focus:border-transparent transition-shadow"
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#1a3c5e] hover:bg-[#122d47] text-white font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
