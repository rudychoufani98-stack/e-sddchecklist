import { useState, useEffect } from 'react';
import api from '../../api';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function GrvSettings({ user }) {
  const isAdmin = user?.role === 'admin';
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  // Modals
  const [addProject, setAddProject] = useState(false);
  const [addSubSection, setAddSubSection] = useState(null); // project object
  const [deleteProject, setDeleteProject] = useState(null);
  const [deleteSubSection, setDeleteSubSection] = useState(null); // {sub, projectId}

  // Form values
  const [projectName, setProjectName] = useState('');
  const [subName, setSubName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/grv-projects');
      setProjects(r.data);
    } catch {}
    setLoading(false);
  }

  async function handleAddProject(e) {
    e.preventDefault();
    if (!projectName.trim()) return;
    setSaving(true); setError('');
    try {
      await api.post('/grv-projects', { name: projectName.trim() });
      setProjectName(''); setAddProject(false); load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  }

  async function handleAddSubSection(e) {
    e.preventDefault();
    if (!subName.trim() || !addSubSection) return;
    setSaving(true); setError('');
    try {
      await api.post(`/grv-projects/${addSubSection.id}/sub-sections`, { name: subName.trim() });
      setSubName(''); setAddSubSection(null); load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  }

  async function handleDeleteProject() {
    if (!deleteProject) return;
    setSaving(true);
    try {
      await api.delete(`/grv-projects/${deleteProject.id}`);
      setDeleteProject(null); load();
    } catch { } finally { setSaving(false); }
  }

  async function handleDeleteSubSection() {
    if (!deleteSubSection) return;
    setSaving(true);
    try {
      await api.delete(`/grv-projects/${deleteSubSection.projectId}/sub-sections/${deleteSubSection.sub.id}`);
      setDeleteSubSection(null); load();
    } catch { } finally { setSaving(false); }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FDF6E3] flex items-center justify-center">
        <p className="text-gray-500 text-sm">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF6E3]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1a3c5e]">Project Settings</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage grievance projects and sub-sections</p>
          </div>
          <button
            onClick={() => { setProjectName(''); setError(''); setAddProject(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1a3c5e] text-white text-sm font-medium rounded-lg hover:bg-[#122d47] transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Project
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#1a3c5e] border-t-transparent" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No projects yet. Click "Add Project" to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map(project => {
              const subs = project.grv_sub_sections || [];
              const isOpen = expanded === project.id;
              return (
                <div key={project.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                  {/* Project row */}
                  <div className="flex items-center justify-between px-5 py-4">
                    <button
                      className="flex items-center gap-3 flex-1 text-left"
                      onClick={() => setExpanded(isOpen ? null : project.id)}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isOpen ? 'bg-[#1a3c5e]' : 'bg-blue-50'}`}>
                        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90 text-white' : 'text-[#1a3c5e]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1a3c5e]">{project.name}</p>
                        <p className="text-xs text-gray-400">{subs.length} sub-section{subs.length !== 1 ? 's' : ''}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setSubName(''); setError(''); setAddSubSection(project); }}
                        className="px-3 py-1.5 text-xs font-medium text-[#1a3c5e] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        + Sub-section
                      </button>
                      <button
                        onClick={() => setDeleteProject(project)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Sub-sections */}
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      {subs.length === 0 ? (
                        <p className="px-5 py-4 text-xs text-gray-400 italic">No sub-sections yet. Click "+ Sub-section" to add one.</p>
                      ) : (
                        <ul className="divide-y divide-gray-100">
                          {subs.map(sub => (
                            <li key={sub.id} className="flex items-center justify-between px-5 py-3 group">
                              <div className="flex items-center gap-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{sub.name}</span>
                              </div>
                              <button
                                onClick={() => setDeleteSubSection({ sub, projectId: project.id })}
                                className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Project modal */}
      {addProject && (
        <Modal title="Add Project" onClose={() => setAddProject(false)}>
          <form onSubmit={handleAddProject} className="space-y-4">
            <input
              autoFocus
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. LCCH, Sokoto Badagry..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddProject(false)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving || !projectName.trim()} className="flex-1 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm hover:bg-[#122d47] disabled:opacity-60">
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Sub-section modal */}
      {addSubSection && (
        <Modal title={`Add Sub-section to ${addSubSection.name}`} onClose={() => setAddSubSection(null)}>
          <form onSubmit={handleAddSubSection} className="space-y-4">
            <input
              autoFocus
              type="text"
              value={subName}
              onChange={e => setSubName(e.target.value)}
              placeholder="Sub-section name..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddSubSection(null)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving || !subName.trim()} className="flex-1 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm hover:bg-[#122d47] disabled:opacity-60">
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Project confirm */}
      {deleteProject && (
        <Modal title="Delete Project" onClose={() => setDeleteProject(null)}>
          <p className="text-sm text-gray-600 mb-4">
            Delete <strong>{deleteProject.name}</strong> and all its sub-sections? Grievances linked to this project will remain but lose their project link.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteProject(null)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Cancel</button>
            <button onClick={handleDeleteProject} disabled={saving} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60">
              {saving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Sub-section confirm */}
      {deleteSubSection && (
        <Modal title="Remove Sub-section" onClose={() => setDeleteSubSection(null)}>
          <p className="text-sm text-gray-600 mb-4">
            Remove <strong>{deleteSubSection.sub.name}</strong>?
          </p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteSubSection(null)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Cancel</button>
            <button onClick={handleDeleteSubSection} disabled={saving} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60">
              {saving ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
