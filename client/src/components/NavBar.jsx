import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

function DropdownMenu({ label, items, basePath }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  const isActive = items.some(i => location.pathname.startsWith(i.path));

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'
        }`}
      >
        {label}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 z-50 min-w-[200px] py-1.5 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-gray-100 mb-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
          </div>
          {items.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-50 text-[#1a3c5e] font-semibold'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-[#1a3c5e]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${location.pathname === item.path ? 'bg-[#1a3c5e]' : 'bg-gray-300'}`} />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NavBar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
    navigate('/login');
  }

  const navLink = (path, label) => (
    <Link
      to={path}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        location.pathname === path
          ? 'bg-white/20 text-white'
          : 'text-blue-100 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );

  const initials = user?.username?.slice(0, 2).toUpperCase() || 'U';

  return (
    <nav className="bg-[#1a3c5e] shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          {/* Logo + nav */}
          <div className="flex items-center gap-5">
            <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-[#1a3c5e] font-black text-xs tracking-tight">ES</span>
              </div>
              <div>
                <div className="text-white font-bold text-sm leading-tight">E&amp;S Due Diligence</div>
                <div className="text-blue-300 text-[10px] leading-tight">ESG Tracker</div>
              </div>
            </Link>

            <div className="hidden sm:flex items-center gap-1">
              {user?.role === 'submitter' ? (
                <>
                  {navLink('/grv/grievances', 'Grievances')}
                  {navLink('/grv/submit', 'Submit Grievance')}
                </>
              ) : (
                <>
                  <DropdownMenu
                    label="ESG Tracker"
                    items={[
                      { path: '/',          label: 'Dashboard' },
                      { path: '/timeline',  label: 'Timeline' },
                      { path: '/data-room', label: 'Data Room' },
                    ]}
                  />
                  <DropdownMenu
                    label="ESG Data Collection"
                    items={[
                      { path: '/grv/grievances', label: 'External Grievances' },
                      { path: '/grv/submit',     label: 'Submit Grievance' },
                      { path: '/grv/settings',   label: 'Project Settings' },
                    ]}
                  />
                  {user?.role === 'admin' && navLink('/construction', 'Construction Progress')}
                </>
              )}
            </div>
          </div>

          {/* User + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <div className="text-right">
                <div className="text-white text-xs font-semibold leading-tight truncate max-w-[160px]">{user?.username}</div>
                <div className="text-blue-300 text-[10px] leading-tight capitalize">
                  {user?.role === 'admin' ? 'Administrator' : user?.role === 'submitter' ? 'Grievance Submitter' : 'Viewer'}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors border border-white/10"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
