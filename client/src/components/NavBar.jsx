import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function NavBar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

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
        <div className="flex items-center justify-between h-15 py-3">
          {/* Logo + nav links */}
          <div className="flex items-center gap-5">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-[#1a3c5e] font-black text-xs tracking-tight">ES</span>
              </div>
              <div>
                <div className="text-white font-bold text-sm leading-tight">E&amp;S Due Diligence</div>
                <div className="text-blue-300 text-[10px] leading-tight">LCCH Tracker</div>
              </div>
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              {navLink('/', 'Dashboard')}
              {navLink('/timeline', 'Timeline')}
              {navLink('/data-room', 'Data Room')}
            </div>
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <div className="text-right">
                <div className="text-white text-xs font-semibold leading-tight truncate max-w-[160px]">{user?.username}</div>
                <div className="text-blue-300 text-[10px] leading-tight">
                  {user?.role === 'admin' ? 'Administrator' : 'Viewer'}
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
