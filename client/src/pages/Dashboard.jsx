import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import ProgressBar from '../components/ProgressBar';

function SectionCard({ section, index }) {
  const navigate = useNavigate();
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100 + index * 80);
    return () => clearTimeout(t);
  }, [index]);

  const completePct = section.total > 0 ? Math.round((section.complete / section.total) * 100) : 0;
  const inProgressPct = section.total > 0 ? Math.round((section.inProgress / section.total) * 100) : 0;
  const notStartedPct = section.total > 0 ? Math.round((section.notStarted / section.total) * 100) : 0;

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/sections/${section.id}`)}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[#1a3c5e]">{section.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{section.total} deliverables</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-[#1a3c5e]">{completePct}%</span>
          <p className="text-xs text-gray-400">Complete</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Progress</span>
          <span>{section.complete} of {section.total} complete</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-3 bg-[#2e7d32] rounded-full transition-all duration-700 ease-out"
            style={{ width: animated ? `${completePct}%` : '0%' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-green-50 rounded-lg p-2">
          <div className="font-semibold text-green-800">{section.complete}</div>
          <div className="text-green-600">Complete</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-2">
          <div className="font-semibold text-amber-800">{section.inProgress}</div>
          <div className="text-amber-600">In Progress</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="font-semibold text-gray-700">{section.notStarted}</div>
          <div className="text-gray-500">Not Started</div>
        </div>
      </div>

      <button className="mt-4 w-full py-2 text-sm font-medium text-[#1a3c5e] border border-[#1a3c5e] rounded-lg hover:bg-[#1a3c5e] hover:text-white transition-colors">
        View Details
      </button>
    </div>
  );
}

export default function Dashboard() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/sections')
      .then((res) => setSections(res.data))
      .catch(() => setError('Failed to load sections'))
      .finally(() => setLoading(false));
  }, []);

  const totals = sections.reduce((acc, s) => ({
    total: acc.total + s.total,
    complete: acc.complete + s.complete,
    inProgress: acc.inProgress + s.inProgress,
    notStarted: acc.notStarted + s.notStarted,
  }), { total: 0, complete: 0, inProgress: 0, notStarted: 0 });

  const overallPct = totals.total > 0 ? Math.round((totals.complete / totals.total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3c5e]" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Project Overview</h2>
        <p className="text-gray-500 text-sm mt-1">Environmental &amp; Social Due Diligence Progress</p>
      </div>

      {/* Overall summary */}
      <div className="bg-[#1a3c5e] rounded-xl p-6 mb-8 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold opacity-90">Overall Portfolio Progress</h3>
            <p className="text-blue-200 text-sm">{sections.length} active projects</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{overallPct}%</div>
            <div className="text-blue-200 text-sm">across all sections</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="w-full bg-white/20 rounded-full h-2.5">
            <div
              className="h-2.5 bg-white rounded-full transition-all duration-1000"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 text-center">
          <div>
            <div className="text-2xl font-bold">{totals.complete}</div>
            <div className="text-blue-200 text-xs">Complete</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{totals.inProgress}</div>
            <div className="text-blue-200 text-xs">In Progress</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{totals.notStarted}</div>
            <div className="text-blue-200 text-xs">Not Started</div>
          </div>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((section, i) => (
          <SectionCard key={section.id} section={section} index={i} />
        ))}
      </div>
    </div>
  );
}
