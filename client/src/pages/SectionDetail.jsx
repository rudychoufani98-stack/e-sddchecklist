import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import DeliverableRow from '../components/DeliverableRow';
import FilePanel from '../components/FilePanel';
import StatusBadge from '../components/StatusBadge';

export default function SectionDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [section, setSection] = useState(null);
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filePanel, setFilePanel] = useState(null);

  useEffect(() => {
    api.get(`/sections/${id}/deliverables`)
      .then((res) => {
        setSection(res.data.section);
        setDeliverables(res.data.deliverables);
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id]);

  function handleUpdate(updated) {
    setDeliverables((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3c5e]" />
      </div>
    );
  }

  const regular = deliverables.filter((d) => !d.is_doc_type);
  const docTypes = deliverables.filter((d) => d.is_doc_type);

  const total = regular.length;
  const complete = regular.filter((d) => d.status === 'Yes').length;
  const inProgress = regular.filter((d) => d.status === 'Ongoing').length;
  const notStarted = regular.filter((d) => d.status === 'No').length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {filePanel && (
        <FilePanel
          deliverable={filePanel.deliverable}
          sectionId={id}
          isAdmin={isAdmin}
          onClose={() => setFilePanel(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-[#1a3c5e]">{section?.name}</h2>
          <p className="text-gray-500 text-sm">E&amp;S Deliverables Checklist</p>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Progress Summary</h3>
          <span className="text-3xl font-bold text-[#1a3c5e]">{pct}%</span>
        </div>

        <div className="mb-5">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Overall Completion</span>
            <span>{complete} / {total} complete</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-4 bg-[#2e7d32] rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">Not Started</span>
              <span className="text-gray-600 font-medium">{notStarted}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="h-2 bg-gray-400 rounded-full" style={{ width: total > 0 ? `${Math.round(notStarted/total*100)}%` : '0%' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">In Progress</span>
              <span className="text-amber-600 font-medium">{inProgress}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="h-2 bg-amber-400 rounded-full" style={{ width: total > 0 ? `${Math.round(inProgress/total*100)}%` : '0%' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">Complete</span>
              <span className="text-green-700 font-medium">{complete}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="h-2 bg-[#2e7d32] rounded-full" style={{ width: total > 0 ? `${Math.round(complete/total*100)}%` : '0%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Deliverables Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Required Documentation</h3>
          {!isAdmin && (
            <p className="text-xs text-gray-400 mt-0.5">Read-only view</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Documentation</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Delivery Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Comments</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {regular.map((d) => (
                <DeliverableRow
                  key={d.id}
                  deliverable={d}
                  isAdmin={isAdmin}
                  onUpdate={handleUpdate}
                  onFilesClick={(del) => setFilePanel({ deliverable: del })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Documents */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Project Documents</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {docTypes.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setFilePanel({ deliverable: doc })}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-[#1a3c5e] hover:bg-blue-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1a3c5e]/10 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#1a3c5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">{doc.title}</span>
              </div>
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                {doc.fileCount || 0}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
