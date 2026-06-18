import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SectionDetail from './pages/SectionDetail';
import DataRoom from './pages/DataRoom';
import Timeline from './pages/Timeline';
import ConstructionProgress from './pages/ConstructionProgress';
import ExternalGrievances from './pages/grv/ExternalGrievances';
import SubmitGrievance from './pages/grv/SubmitGrievance';
import GrvSettings from './pages/grv/GrvSettings';
import ResolvingSolutions from './pages/grv/ResolvingSolutions';
import Settings from './pages/Settings';
import UserAccess from './pages/UserAccess';
import NavBar from './components/NavBar';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  function handleLogin(userData) { setUser(userData); }
  function handleLogout() { setUser(null); }

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Login onLogin={handleLogin} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#FDF6E3]">
        <NavBar user={user} onLogout={handleLogout} />
        <main>
          <Routes>
            {user.role === 'submitter' ? (
              <>
                <Route path="/grv/submit"     element={<SubmitGrievance />} />
                <Route path="/grv/grievances" element={<ExternalGrievances user={user} />} />
                <Route path="/settings"       element={<Settings user={user} />} />
                <Route path="*"               element={<Navigate to="/grv/grievances" />} />
              </>
            ) : (
              <>
                <Route path="/"                element={<Dashboard />} />
                <Route path="/sections/:id"    element={<SectionDetail user={user} />} />
                <Route path="/data-room"       element={<DataRoom user={user} />} />
                <Route path="/timeline"              element={<Timeline />} />
                <Route path="/construction"         element={<ConstructionProgress />} />
                <Route path="/grv/grievances"  element={<ExternalGrievances user={user} />} />
                <Route path="/grv/submit"      element={<SubmitGrievance />} />
                <Route path="/grv/settings"          element={<GrvSettings user={user} />} />
                <Route path="/grv/resolving-solutions" element={<ResolvingSolutions user={user} />} />
                <Route path="/settings"              element={<Settings user={user} />} />
                <Route path="/user-access"           element={<UserAccess user={user} />} />
                <Route path="/login"           element={<Navigate to="/" />} />
                <Route path="*"               element={<Navigate to="/" />} />
              </>
            )}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
