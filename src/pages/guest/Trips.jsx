import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  EmptyState,
  Modal,
  Spinner,
  StatusBadge,
} from "../../components/ui.jsx";
import ReviewForm from "../../components/ReviewForm.jsx";
import {
  getCancellationPreview,
  getGuestBookings,
  updateBookingStatus,
} from "../../services/bookingService.js";
import {
  getReviewEligibility,
  getReviewedListingIds,
} from "../../services/listingService.js";
import { areaLine, fmtDate, money } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

export default function Trips() {
  const { user } = useAuth();
  const {
    data: bookings,
    loading,
    reload,
  } = useAsync(() => getGuestBookings(user.id), [user.id]);
  const { data: reviewed, reload: reloadReviewed } = useAsync(
    () => getReviewedListingIds(user.id),
    [user.id],
  );
  const [tab, setTab] = useState("upcoming");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(null); // { booking, refund }
  const [reviewing, setReviewing] = useState(null); // { listingId, title }
  const [notice, setNotice] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (bookings || []).filter(
    (b) => ["confirmed", "pending"].includes(b.status) && b.checkOut >= today,
  );
  const past = (bookings || []).filter(
    (b) =>
      b.status === "completed" ||
      (b.status === "confirmed" && b.checkOut < today),
  );
  const cancelled = (bookings || []).filter((b) => b.status === "cancelled");
  const lists = { upcoming, past, cancelled };

  const askCancel = async (b) => {
    setError("");
    setCancelling({ booking: b, refund: await getCancellationPreview(b.id) });
  };

  const confirmCancel = async () => {
    const { booking } = cancelling;
    setBusyId(booking.id);
    try {
      await updateBookingStatus(booking.id, "cancelled", user);
      setCancelling(null);
      reload();
    } catch (e) {
      setError(e.message);
    }
    setBusyId(null);
  };

  const openReview = async (b) => {
    setNotice("");
    const el = await getReviewEligibility(user.id, b.listingId);
    if (!el.eligible)
      return setNotice(
        el.reason === "already"
          ? "You already reviewed this stay."
          : "Only completed stays can be reviewed.",
      );
    setReviewing({ listingId: b.listingId, title: b.listing?.title });
  };

  return (
    <div className="container-page max-w-4xl py-10">
      <h1 className="text-3xl font-semibold">Trips</h1>
      <div className="mt-6 flex gap-2 border-b border-gray-200">
        {Object.keys(lists).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 pb-3 text-sm font-medium capitalize ${tab === t ? "border-gray-900" : "border-transparent text-gray-500"}`}
          >
            {t} ({lists[t].length})
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="mt-4 text-sm text-amber-700">{notice}</p>}

      {loading ? (
        <Spinner />
      ) : lists[tab].length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={`No ${tab} trips`}
            text="Time to dust off your bags and start planning your next adventure."
            action={
              <Link to="/search" className="btn-primary">
                Start searching
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {lists[tab].map((b) => (
            <div key={b.id} className="card flex flex-col gap-4 sm:flex-row">
              <img
                src={b.listing?.images?.[0]}
                alt=""
                className="h-36 w-full rounded-xl object-cover sm:w-48"
              />
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/listing/${b.listingId}`}
                    className="font-semibold hover:underline"
                  >
                    {b.listing?.title}
                  </Link>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-sm text-gray-500">{areaLine(b.listing)}</p>
                <p className="mt-2 text-sm">
                  {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {b.guests}{" "}
                  guest{b.guests > 1 ? "s" : ""}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  Total {money(b.total)}
                  {b.payment && <StatusBadge status={b.payment.status} />}
                  {b.status === "pending" && (
                    <span className="text-xs text-amber-700">
                      Waiting for host to accept
                    </span>
                  )}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  <Link
                    to={`/booking/${b.id}/confirmation`}
                    className="btn-outline px-4 py-2 text-sm"
                  >
                    Details
                  </Link>
                  {tab === "upcoming" && (
                    <button
                      className="btn-ghost text-red-600"
                      disabled={busyId === b.id}
                      onClick={() => askCancel(b)}
                    >
                      Cancel
                    </button>
                  )}
                  {tab === "past" &&
                    ((reviewed || []).includes(b.listingId) ? (
                      <span className="px-3 py-2 text-sm text-gray-500">
                        Reviewed ✓
                      </span>
                    ) : (
                      <button
                        className="btn-ghost"
                        onClick={() => openReview(b)}
                      >
                        Leave a review
                      </button>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel this reservation?"
      >
        {cancelling && (
          <div className="space-y-3 text-sm">
            <p>
              {cancelling.booking.listing?.title} ·{" "}
              {fmtDate(cancelling.booking.checkIn)} →{" "}
              {fmtDate(cancelling.booking.checkOut)}
            </p>
            <p className="rounded-lg bg-gray-50 p-3">
              Cancellation policy:{" "}
              <b className="capitalize">
                {cancelling.booking.listing?.cancellationPolicy}
              </b>
              .<br />
              You will be refunded <b>{money(cancelling.refund.amount)}</b> (
              {cancelling.refund.percent}% of {money(cancelling.booking.total)}
              ).
            </p>
            {error && <p className="text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                className="btn-primary bg-red-600 hover:bg-red-700"
                disabled={busyId === cancelling.booking.id}
                onClick={confirmCancel}
              >
                {busyId === cancelling.booking.id
                  ? "Cancelling…"
                  : "Yes, cancel"}
              </button>
              <button
                className="btn-outline"
                onClick={() => setCancelling(null)}
              >
                Keep reservation
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={reviewing?.title || "Review"}
      >
        {reviewing && (
          <ReviewForm
            listingId={reviewing.listingId}
            userId={user.id}
            onDone={() => {
              setReviewing(null);
              reloadReviewed();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
