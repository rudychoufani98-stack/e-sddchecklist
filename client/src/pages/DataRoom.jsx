import { useState, useEffect, useRef } from 'react';
import api from '../api';

export default function DataRoom({ user }) {
  const isAdmin = user?.role === 'admin';
  const [files, setFiles] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadState, setUploadState] = useState({ open: false, sectionId: '', deliverableId: '', uploading: false, error: '' });
  const [deliverables, setDeliverables] = useState([]);
  const fileInputRef = useRef();

  useEffect(() => {
    Promise.all([api.get('/files'), api.get('/sections')])
      .then(([filesRes, sectionsRes]) => {
        setFiles(filesRes.data);
        setSections(sectionsRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function loadDeliverables(sectionId) {
    if (!sectionId) { setDeliverables([]); return; }
    try {
      const res = await api.get(`/sections/${sectionId}/deliverables`);
      setDeliverables(res.data.deliverables.filter((d) => !d.is_doc_type));
    } catch {
      setDeliverables([]);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState((s) => ({ ...s, uploading: true, error: '' }));
    try {
      // 1. Get signed upload URL
      const { data: { signedUrl, storedPath } } = await api.post('/files/request-upload', {
        filename: file.name,
        section_id: uploadState.sectionId,
        deliverable_id: uploadState.deliverableId || null,
      });

      // 2. Upload directly to Supabase Storage
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!uploadRes.ok) throw new Error('Upload to storage failed');

      // 3. Confirm with server
      const { data: newFile } = await api.post('/files/confirm-upload', {
        storedPath,
        filename: file.name,
        section_id: uploadState.sectionId,
        deliverable_id: uploadState.deliverableId || null,
      });

      const sectionName = sections.find((s) => s.id === parseInt(uploadState.sectionId))?.name;
      setFiles((prev) => [{ ...newFile, section_name: sectionName }, ...prev]);
      setUploadState((s) => ({ ...s, open: false, sectionId: '', deliverableId: '', uploading: false }));
    } catch (err) {
      setUploadState((s) => ({ ...s, error: err.response?.data?.error || err.message || 'Upload failed', uploading: false }));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this file?')) return;
    await api.delete(`/files/${id}`);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleDownload(id, filename) {
    try {
      const { data } = await api.get(`/files/${id}/download`);
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = filename;
      a.target = '_blank';
      a.click();
    } catch {
      alert('Download failed');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3c5e]" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Data Room</h2>
          <p className="text-gray-500 text-sm mt-1">{files.length} file{files.length !== 1 ? 's' : ''} across all projects</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setUploadState((s) => ({ ...s, open: true }))}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a3c5e] text-white rounded-lg hover:bg-[#122d47] transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload File
          </button>
        )}
      </div>

      {/* Upload Modal */}
      {isAdmin && uploadState.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Upload File</h3>
              <button onClick={() => setUploadState((s) => ({ ...s, open: false, error: '' }))} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section *</label>
                <select
                  value={uploadState.sectionId}
                  onChange={(e) => {
                    setUploadState((s) => ({ ...s, sectionId: e.target.value, deliverableId: '' }));
                    loadDeliverables(e.target.value);
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]"
                >
                  <option value="">Select section...</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {deliverables.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link to Deliverable (optional)</label>
                  <select
                    value={uploadState.deliverableId}
                    onChange={(e) => setUploadState((s) => ({ ...s, deliverableId: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]"
                  >
                    <option value="">None (section-level)</option>
                    {deliverables.map((d) => <option key={d.id} value={d.id}>{d.number}. {d.title}</option>)}
                  </select>
                </div>
              )}
              {uploadState.error && <p className="text-red-600 text-sm">{uploadState.error}</p>}
              <label className={`flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed rounded-lg transition-colors ${uploadState.sectionId ? 'border-[#1a3c5e] hover:bg-blue-50 cursor-pointer' : 'border-gray-200 cursor-not-allowed opacity-50'}`}>
                {uploadState.uploading ? (
                  <span className="text-sm text-gray-500">Uploading...</span>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-sm text-gray-500">Click to select file</span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleUpload}
                  accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.kmz,.zip"
                  disabled={!uploadState.sectionId || uploadState.uploading}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {sections.map((section) => {
          const sectionFiles = files.filter((f) => f.section_id === section.id);
          if (sectionFiles.length === 0) return null;
          return (
            <div key={section.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-[#1a3c5e]">{section.name}</h3>
                <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
                  {sectionFiles.length} file{sectionFiles.length !== 1 ? 's' : ''}
                </span>
              </div>
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Filename</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Linked To</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Uploaded</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">By</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sectionFiles.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm text-gray-800">{f.filename}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">
                        {f.deliverable_title || <span className="text-gray-400 italic">Section-level</span>}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(f.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">{f.uploaded_by}</td>
                      <td className="px-6 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDownload(f.id, f.filename)}
                            className="text-xs px-2 py-1 bg-[#1a3c5e] text-white rounded hover:bg-[#122d47] transition-colors"
                          >
                            Download
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(f.id)}
                              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {files.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500">No files uploaded yet.</p>
            {isAdmin && <p className="text-gray-400 text-sm mt-1">Click "Upload File" to add your first document.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
