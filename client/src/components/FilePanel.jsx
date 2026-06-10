import { useState, useEffect, useRef } from 'react';
import api from '../api';

export default function FilePanel({ deliverable, sectionId, isAdmin, onClose }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef();

  useEffect(() => { loadFiles(); }, [deliverable?.id]);

  async function loadFiles() {
    try {
      const res = await api.get('/files', { params: { section_id: sectionId } });
      const filtered = deliverable
        ? res.data.filter((f) => f.deliverable_id === deliverable.id)
        : res.data.filter((f) => !f.deliverable_id);
      setFiles(filtered);
    } catch {
      setError('Failed to load files');
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      // 1. Get signed upload URL from server
      const { data: { signedUrl, storedPath } } = await api.post('/files/request-upload', {
        filename: file.name,
        section_id: sectionId,
        deliverable_id: deliverable?.id || null,
      });

      // 2. Upload directly to Supabase Storage (bypasses Vercel size limit)
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!uploadRes.ok) throw new Error('Upload to storage failed');

      // 3. Confirm with server — saves metadata to DB
      const { data: newFile } = await api.post('/files/confirm-upload', {
        storedPath,
        filename: file.name,
        section_id: sectionId,
        deliverable_id: deliverable?.id || null,
      });

      setFiles((prev) => [newFile, ...prev]);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this file?')) return;
    try {
      await api.delete(`/files/${id}`);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError('Delete failed');
    }
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
      setError('Download failed');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">
              {deliverable ? deliverable.title : 'Project Documents'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{files.length} file{files.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {files.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-6">No files attached yet.</p>
          )}
          {files.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{f.filename}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(f.uploaded_at).toLocaleDateString()} &bull; {f.uploaded_by}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0 ml-2">
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
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="p-4 border-t">
            <label className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#1a3c5e] hover:bg-blue-50 transition-colors">
              {uploading ? (
                <span className="text-sm text-gray-500">Uploading...</span>
              ) : (
                <>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-sm text-gray-500">Click to upload file</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
                accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.kmz,.zip"
                disabled={uploading}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
