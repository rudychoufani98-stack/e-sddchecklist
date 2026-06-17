import { useState, useEffect } from 'react';
import api from '../../api';

const COMPLAINT_REL = [
  { value: 'local_resident',   label: 'Local Resident' },
  { value: 'local_community',  label: 'Local Community' },
  { value: 'employee',         label: 'Employee' },
  { value: 'other',            label: 'Other' },
];
const NATURE_TYPES = [
  { value: 'social',         label: 'Social' },
  { value: 'environmental',  label: 'Environmental' },
];
const RISK_LEVELS  = ['low', 'medium', 'high'];
const PRIORITY     = ['low', 'medium', 'high'];
const ESCALATION   = [
  { value: 'level_1_site_team',         label: 'Level 1 — Site Team' },
  { value: 'level_2_project_manager',   label: 'Level 2 — Project Manager' },
  { value: 'level_3_senior_management', label: 'Level 3 — Senior Management' },
  { value: 'level_4_external_mediator', label: 'Level 4 — External Mediator' },
];
const PDCA = ['plan', 'do', 'check', 'act'];

const EMPTY = {
  date_of_receipt: '',
  date_of_registration: '',
  project_id: '',
  sub_section_id: '',
  complaint_relationship: '',
  community_name: '',
  nature_type: '',
  nature_of_grievance: '',
  issue_description: '',
  risk_significance: 'low',
  priority_level: 'low',
  proposed_resolution: '',
  deadline: '',
  status: 'open',
  date_of_acknowledgment: '',
  escalation_level: 'level_1_site_team',
  follow_up_required: false,
  next_follow_up_date: '',
  pdca: '',
  lesson_learned: '',
};

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] focus:border-transparent bg-white";

export default function SubmitGrievance() {
  const [projects, setProjects] = useState([]);
  const [subSections, setSubSections] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/grv-projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.project_id) { setSubSections([]); return; }
    const proj = projects.find(p => p.id === parseInt(form.project_id));
    setSubSections(proj?.grv_sub_sections || []);
    set('sub_section_id', '');
  }, [form.project_id, projects]);

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.project_id)   { setError('Project is required'); setSaving(false); return; }
      if (!payload.nature_type)  { setError('Nature type is required'); setSaving(false); return; }
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
      payload.project_id     = payload.project_id     ? parseInt(payload.project_id)     : null;
      payload.sub_section_id = payload.sub_section_id ? parseInt(payload.sub_section_id) : null;
      const res = await api.post('/grievances', payload);
      setSuccess(res.data.reference_no);
      setForm(EMPTY);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FDF6E3]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-[#1a3c5e] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[#1a3c5e]">Submit External Grievance</h1>
          </div>
          <p className="text-sm text-gray-500 ml-11">HITECH Construction Company Limited</p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">Grievance submitted successfully</p>
              <p className="text-sm text-green-700 mt-0.5">Reference number: <strong>{success}</strong></p>
              <button onClick={() => setSuccess(null)} className="text-xs text-green-600 underline mt-1">Submit another</button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section A — Project Info */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
            <h2 className="text-sm font-bold text-[#1a3c5e] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
              A. Project Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Date of Receipt" required>
                <input type="date" value={form.date_of_receipt} onChange={e => set('date_of_receipt', e.target.value)} className={inputCls} required />
              </Field>
              <Field label="Date of Registration">
                <input type="date" value={form.date_of_registration} onChange={e => set('date_of_registration', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Project" required>
                <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className={inputCls} required>
                  <option value="">Select project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Sub-section">
                <select value={form.sub_section_id} onChange={e => set('sub_section_id', e.target.value)} className={inputCls} disabled={!subSections.length}>
                  <option value="">Select sub-section...</option>
                  {subSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Section B — Complainant */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
            <h2 className="text-sm font-bold text-[#1a3c5e] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
              B. Complainant Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Complainant Relationship" required>
                <select value={form.complaint_relationship} onChange={e => set('complaint_relationship', e.target.value)} className={inputCls} required>
                  <option value="">Select...</option>
                  {COMPLAINT_REL.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
              <Field label="Community Name">
                <input type="text" value={form.community_name} onChange={e => set('community_name', e.target.value)} placeholder="Village / community" className={inputCls} />
              </Field>
            </div>
          </div>

          {/* Section C — Grievance Details */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
            <h2 className="text-sm font-bold text-[#1a3c5e] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
              C. Grievance Details
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nature Type" required>
                  <select value={form.nature_type} onChange={e => set('nature_type', e.target.value)} className={inputCls} required>
                    <option value="">Select...</option>
                    {NATURE_TYPES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                </Field>
                <Field label="Nature of Grievance">
                  <input type="text" value={form.nature_of_grievance} onChange={e => set('nature_of_grievance', e.target.value)} placeholder="Brief category" className={inputCls} />
                </Field>
              </div>
              <Field label="Issue Description" required>
                <textarea value={form.issue_description} onChange={e => set('issue_description', e.target.value)} rows={3} placeholder="Describe the issue in detail..." className={inputCls + ' resize-none'} required />
              </Field>
              <Field label="Proposed Resolution">
                <textarea value={form.proposed_resolution} onChange={e => set('proposed_resolution', e.target.value)} rows={2} placeholder="Suggested resolution..." className={inputCls + ' resize-none'} />
              </Field>
            </div>
          </div>

          {/* Section D — Risk & Priority */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
            <h2 className="text-sm font-bold text-[#1a3c5e] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
              D. Risk &amp; Priority
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Risk Significance">
                <select value={form.risk_significance} onChange={e => set('risk_significance', e.target.value)} className={inputCls}>
                  {RISK_LEVELS.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="Priority Level">
                <select value={form.priority_level} onChange={e => set('priority_level', e.target.value)} className={inputCls}>
                  {PRIORITY.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="Deadline">
                <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} className={inputCls} />
              </Field>
            </div>
          </div>

          {/* Section E — Follow-up & Resolution */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
            <h2 className="text-sm font-bold text-[#1a3c5e] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
              E. Follow-up &amp; Resolution
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Escalation Level">
                <select value={form.escalation_level} onChange={e => set('escalation_level', e.target.value)} className={inputCls}>
                  {ESCALATION.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </Field>
              <Field label="Date of Acknowledgment">
                <input type="date" value={form.date_of_acknowledgment} onChange={e => set('date_of_acknowledgment', e.target.value)} className={inputCls} />
              </Field>
              <Field label="PDCA Stage">
                <select value={form.pdca} onChange={e => set('pdca', e.target.value)} className={inputCls}>
                  <option value="">None</option>
                  {PDCA.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2 flex items-center gap-3 py-1">
                <input type="checkbox" id="follow_up" checked={form.follow_up_required} onChange={e => set('follow_up_required', e.target.checked)} className="w-4 h-4 rounded" />
                <label htmlFor="follow_up" className="text-sm text-gray-700 font-medium">Follow-up required</label>
              </div>
              {form.follow_up_required && (
                <Field label="Next Follow-up Date">
                  <input type="date" value={form.next_follow_up_date} onChange={e => set('next_follow_up_date', e.target.value)} className={inputCls} />
                </Field>
              )}
              <div className="sm:col-span-2">
                <Field label="Lesson Learned">
                  <textarea value={form.lesson_learned} onChange={e => set('lesson_learned', e.target.value)} rows={2} placeholder="Any lessons learned from this grievance..." className={inputCls + ' resize-none'} />
                </Field>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#1a3c5e] hover:bg-[#122d47] text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm shadow-sm"
          >
            {saving ? 'Submitting...' : 'Submit Grievance'}
          </button>
        </form>
      </div>
    </div>
  );
}
