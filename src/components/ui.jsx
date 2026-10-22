import { statusStyles } from "../utils/format.js";

export function StatusBadge({ status }) {
  return (
    <span
      className={`badge capitalize ${statusStyles[status] || "bg-gray-100 text-gray-700"}`}
    >
      {String(status).replace("_", " ")}
    </span>
  );
}

export function Spinner({ className = "" }) {
  return (
    <div
      className={`flex justify-center py-16 ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
    </div>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 px-6 py-14 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && (
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{text}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stars({ value, size = "text-sm" }) {
  return (
    <span className={`inline-flex items-center gap-1 ${size}`}>
      <span className="text-gray-900">★</span>
      <span className="font-medium">{value ? value.toFixed(2) : "New"}</span>
    </span>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-xl leading-none hover:bg-gray-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function BarChart({ data, format = (v) => v }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex h-48 items-stretch gap-3">
      {data.map((d) => (
        <div
          key={d.key || d.label}
          className="flex min-w-0 flex-1 flex-col items-center gap-2"
        >
          <span className="h-4 text-xs text-gray-500">
            {d.value ? format(d.value) : ""}
          </span>

          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-brand-500 transition-all"
              style={{
                height: `${Math.max((d.value / max) * 100, d.value ? 4 : 1)}%`,
              }}
            />
          </div>

          <span className="text-xs font-medium text-gray-600">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DataTable({ columns, rows, empty = "Nothing to show yet." }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-600"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-gray-500"
              >
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.id || i} className="hover:bg-gray-50">
              {columns.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-4 py-3">
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
