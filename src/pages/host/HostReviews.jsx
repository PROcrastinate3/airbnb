import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  EmptyState,
  Modal,
  Spinner,
  Stars,
  StatusBadge,
} from "../../components/ui.jsx";
import { getHostReviews, reportReview } from "../../services/listingService.js";
import { fmtDate } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

export default function HostReviews() {
  const { user } = useAuth();
  const { data, loading, reload } = useAsync(
    () => getHostReviews(user.id),
    [user.id],
  );
  const [listingId, setListingId] = useState("all");
  const [reporting, setReporting] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (loading) return <Spinner />;
  const { reviews, summary } = data;
  const rows = reviews.filter(
    (r) => listingId === "all" || r.listingId === listingId,
  );

  const submitReport = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await reportReview(reporting.id, reason, user);
      setReporting(null);
      setReason("");
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reviews & ratings</h1>

      {summary.length === 0 ? (
        <EmptyState
          title="No listings yet"
          text="Reviews from your guests will appear here."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summary.map((s) => (
            <button
              key={s.id}
              onClick={() => setListingId(listingId === s.id ? "all" : s.id)}
              className={`card text-left transition hover:border-gray-900 ${listingId === s.id ? "border-gray-900 ring-1 ring-gray-900" : ""}`}
            >
              <p className="truncate font-medium">{s.title}</p>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <Stars value={s.rating} />
                <span className="text-gray-500">
                  · {s.count} review{s.count === 1 ? "" : "s"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No reviews to show" />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={r.guest?.avatar}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold">{r.guest?.name}</p>
                    <p className="text-xs text-gray-500">
                      {r.listingTitle} · {fmtDate(r.createdAt)} ·{" "}
                      {"★".repeat(r.rating)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === "hidden" && <StatusBadge status="hidden" />}
                  {r.reported ? (
                    <span className="badge bg-amber-100 text-amber-800">
                      {r.reported.resolved ? "Report resolved" : "Reported"}
                    </span>
                  ) : (
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => setReporting(r)}
                    >
                      Report
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-700">{r.comment}</p>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!reporting}
        onClose={() => setReporting(null)}
        title="Report this review"
      >
        <form onSubmit={submitReport} className="space-y-3 text-sm">
          <p className="text-gray-600">
            An administrator will check whether the review is abusive or
            inappropriate.
          </p>
          <textarea
            required
            rows={3}
            className="input"
            placeholder="What is wrong with this review?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {error && <p className="text-red-600">{error}</p>}
          <button className="btn-primary">Send report</button>
        </form>
      </Modal>
    </div>
  );
}
