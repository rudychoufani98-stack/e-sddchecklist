import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function NavBar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
    navigate('/login');
  }

  const linkClass = (path) =>
    `px-3 py-2 rounded text-sm font-medium transition-colors ${
      location.pathname === path
        ? 'bg-white/20 text-white'
        : 'text-blue-100 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <nav className="bg-[#1a3c5e] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                <span className="text-[#1a3c5e] font-bold text-xs">ES</span>
              </div>
              <span className="text-white font-semibold text-lg tracking-tight">
                E&amp;S Due Diligence Tracker
              </span>
            </Link>
            <div className="flex gap-1 ml-4">
              <Link to="/" className={linkClass('/')}>Dashboard</Link>
              <Link to="/data-room" className={linkClass('/data-room')}>Data Room</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-white text-sm font-medium">{user?.username}</div>
              <div className="text-blue-200 text-xs capitalize">
                {user?.role === 'admin' ? 'Administrator' : `Viewer (${user?.username})`}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="ml-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
