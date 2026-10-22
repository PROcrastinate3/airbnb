import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { DataTable, Spinner, StatusBadge } from "../../components/ui.jsx";
import {
  deleteReview,
  dismissReport,
  getAllReviews,
  setReviewStatus,
} from "../../services/adminService.js";
import { fmtDate } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

const FILTERS = ["reported", "all", "visible", "hidden"];

// Review moderation: hide or delete abusive reviews, dismiss unfounded host reports.
export default function AdminReviews() {
  useAuth();
  const {
    data: reviews,
    loading,
    reload,
  } = useAsync(() => getAllReviews(), []);
  const [filter, setFilter] = useState("reported");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);

  if (loading) return <Spinner />;

  const run = async (id, fn) => {
    setBusy(id);
    await fn();
    setBusy(null);
    reload();
  };

  const rows = reviews.filter(
    (r) =>
      (filter === "all" ||
        (filter === "reported"
          ? r.reported && !r.reported.resolved
          : r.status === filter)) &&
      (!q ||
        `${r.comment} ${r.guestName} ${r.listingTitle}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );

  const columns = [
    { key: "guestName", header: "Guest" },
    {
      key: "listingTitle",
      header: "Listing",
      render: (r) => (
        <span className="block max-w-[180px] truncate">{r.listingTitle}</span>
      ),
    },
    { key: "rating", header: "Rating", render: (r) => "★".repeat(r.rating) },
    {
      key: "comment",
      header: "Review",
      render: (r) => (
        <div className="max-w-[320px] whitespace-normal">
          <p>{r.comment}</p>
          {r.reported && (
            <p className="mt-1 text-xs text-amber-700">
              Reported: {r.reported.reason}
            </p>
          )}
        </div>
      ),
    },
    { key: "createdAt", header: "Date", render: (r) => fmtDate(r.createdAt) },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.status === "visible" ? (
            <button
              className="btn-outline px-3 py-1.5 text-xs"
              disabled={busy === r.id}
              onClick={() => run(r.id, () => setReviewStatus(r.id, "hidden"))}
            >
              Hide
            </button>
          ) : (
            <button
              className="btn-outline px-3 py-1.5 text-xs"
              disabled={busy === r.id}
              onClick={() => run(r.id, () => setReviewStatus(r.id, "visible"))}
            >
              Restore
            </button>
          )}
          {r.reported && !r.reported.resolved && (
            <button
              className="btn-ghost text-xs"
              disabled={busy === r.id}
              onClick={() => run(r.id, () => dismissReport(r.id))}
            >
              Dismiss report
            </button>
          )}
          <button
            className="btn-ghost text-xs text-red-600"
            disabled={busy === r.id}
            onClick={() =>
              window.confirm("Delete this review permanently?") &&
              run(r.id, () => deleteReview(r.id))
            }
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Review moderation</h1>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 text-sm capitalize ${filter === f ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 hover:border-gray-900"}`}
          >
            {f}
          </button>
        ))}
        <input
          className="input ml-auto max-w-xs py-2"
          placeholder="Search reviews"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        empty="No reviews in this view."
      />
    </div>
  );
}
