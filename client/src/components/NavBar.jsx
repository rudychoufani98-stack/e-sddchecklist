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
        className={`flex items-center gap-1 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          isActive ? 'bg-white/15 text-white shadow-inner ring-1 ring-white/10' : 'text-blue-100/90 hover:bg-white/10 hover:text-white'
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

const OWNER = 'rudy.choufani@skykapital.com';

function ProfileMenu({ user, initials, roleLabel, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const isOwner = user?.username === OWNER;

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function go(path) { setOpen(false); navigate(path); }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-white/10 transition-colors">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FFD700] to-[#e6b800] flex items-center justify-center shadow-sm ring-1 ring-white/20">
          <span className="text-[#1a3c5e] text-xs font-black">{initials}</span>
        </div>
        <div className="hidden sm:block text-right">
          <div className="text-white text-xs font-semibold leading-tight truncate max-w-[160px]">{user?.username}</div>
          <div className="text-blue-300/90 text-[10px] leading-tight">{roleLabel}</div>
        </div>
        <svg className={`hidden sm:block w-3.5 h-3.5 text-blue-200 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 min-w-[220px] py-1.5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 mb-1">
            <p className="text-sm font-bold text-gray-800 truncate">{user?.username}</p>
            <p className="text-xs text-gray-400">{roleLabel}</p>
          </div>
          <button onClick={() => go('/settings')}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#1a3c5e] transition-colors">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
          {isOwner && (
            <button onClick={() => go('/user-access')}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#1a3c5e] transition-colors">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              User Access
            </button>
          )}
          <div className="border-t border-gray-100 my-1" />
          <button onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
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
      className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
        location.pathname === path
          ? 'bg-white/15 text-white shadow-inner ring-1 ring-white/10'
          : 'text-blue-100/90 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );

  const initials = user?.username?.slice(0, 2).toUpperCase() || 'U';
  const roleLabel = user?.role === 'admin' ? 'Administrator' : user?.role === 'submitter' ? 'Grievance Submitter' : 'Viewer';

  return (
    <nav className="bg-gradient-to-r from-[#15304c] via-[#1a3c5e] to-[#15304c] shadow-lg sticky top-0 z-40 border-b-2 border-[#FFD700]/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          {/* Logo + nav */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
              <svg viewBox="0 0 100 100" className="w-8 h-8 flex-shrink-0" aria-hidden="true">
                <path d="M50 3 Q50 50 97 50 Q50 50 50 97 Q50 50 3 50 Q50 50 50 3 Z" fill="white" />
              </svg>
              <div>
                <div className="text-white font-bold text-base leading-tight tracking-tight">Skykapital</div>
                <div className="text-blue-300/90 text-[10px] leading-tight tracking-wide">E&amp;S Due Diligence Tracker</div>
              </div>
            </Link>

            <div className="hidden sm:block w-px h-8 bg-white/15" />

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
                      { path: '/grv/grievances',           label: 'External Grievances' },
                      { path: '/grv/resolving-solutions',  label: 'Resolving Solutions' },
                      { path: '/grv/submit',               label: 'Submit Grievance' },
                      { path: '/grv/settings',             label: 'Project Settings' },
                    ]}
                  />
                  {user?.role === 'admin' && navLink('/construction', 'Construction Progress')}
                </>
              )}
            </div>
          </div>

          {/* Profile dropdown */}
          <ProfileMenu user={user} initials={initials} roleLabel={roleLabel} onLogout={handleLogout} />
        </div>
      </div>
    </nav>
  );
}
