export default function ProgressBar({ pct, color = 'bg-[#2e7d32]', animate = false, height = 'h-3' }) {
  return (
    <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${height}`}>
      <div
        className={`${height} ${color} rounded-full transition-all duration-700 ease-out`}
        style={{ width: animate ? `${pct}%` : `${pct}%` }}
      />
    </div>
  );
}
