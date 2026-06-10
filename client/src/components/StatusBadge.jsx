const CONFIG = {
  Yes: { label: 'Complete', cls: 'bg-green-100 text-green-800 border-green-200' },
  Ongoing: { label: 'In Progress', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  No: { label: 'Not Started', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] || CONFIG.No;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
