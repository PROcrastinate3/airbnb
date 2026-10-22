import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  DataTable,
  Modal,
  Spinner,
  StatusBadge,
} from "../../components/ui.jsx";
import {
  getHostBookings,
  updateBookingStatus,
} from "../../services/bookingService.js";
import { fmtDate, money, todayISO } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

const FILTERS = ["all", "pending", "confirmed", "completed", "cancelled"];

export default function HostReservations() {
  const { user } = useAuth();
  const {
    data: bookings,
    loading,
    reload,
  } = useAsync(() => getHostBookings(user.id), [user.id]);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);

  const act = async (id, status) => {
    setBusy(id);
    setError("");
    try {
      await updateBookingStatus(id, status, user);
      setDetail(null);
      reload();
    } catch (e) {
      setError(e.message);
    }
    setBusy(null);
  };

  if (loading) return <Spinner />;
  const rows = bookings.filter((b) => filter === "all" || b.status === filter);
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  const actions = (b) => (
    <div className="flex gap-1">
      {b.status === "pending" && (
        <>
          <button
            className="btn-primary px-3 py-1.5 text-xs"
            disabled={busy === b.id}
            onClick={() => act(b.id, "confirmed")}
          >
            Accept
          </button>
          <button
            className="btn-outline px-3 py-1.5 text-xs"
            disabled={busy === b.id}
            onClick={() => act(b.id, "cancelled")}
          >
            Decline
          </button>
        </>
      )}
      {b.status === "confirmed" && (
        <>
          <button
            className="btn-ghost text-xs"
            disabled={busy === b.id || b.checkIn > todayISO()}
            title={b.checkIn > todayISO() ? "Available after check-in" : ""}
            onClick={() => act(b.id, "completed")}
          >
            Mark completed
          </button>
          <button
            className="btn-ghost text-xs text-red-600"
            disabled={busy === b.id}
            onClick={() =>
              window.confirm(
                "Cancel this reservation? The guest is refunded in full.",
              ) && act(b.id, "cancelled")
            }
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );

  const columns = [
    {
      key: "guest",
      header: "Guest",
      render: (b) => (
        <button
          className="flex items-center gap-2 text-left hover:underline"
          onClick={() => setDetail(b)}
        >
          <img
            src={b.guest?.avatar}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
          <div>
            <p className="font-medium">{b.guest?.name}</p>
            <p className="text-xs text-gray-500">{b.guest?.email}</p>
          </div>
        </button>
      ),
    },
    {
      key: "listing",
      header: "Listing",
      render: (b) => (
        <span className="block max-w-[220px] truncate">{b.listing?.title}</span>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      render: (b) =>
        `${fmtDate(b.checkIn, { month: "short", day: "numeric" })} → ${fmtDate(b.checkOut)}`,
    },
    { key: "guests", header: "Guests" },
    {
      key: "payout",
      header: "Payout",
      render: (b) => money(b.subtotal + b.cleaningFee),
    },
    {
      key: "status",
      header: "Status",
      render: (b) => <StatusBadge status={b.status} />,
    },
    { key: "actions", header: "", render: actions },
  ];

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Reservations</h1>
      {pendingCount > 0 && (
        <p className="mb-4 text-sm text-amber-700">
          {pendingCount} request{pendingCount > 1 ? "s" : ""} waiting for your
          response.
        </p>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 text-sm capitalize ${filter === f ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 hover:border-gray-900"}`}
          >
            {f}
          </button>
        ))}
      </div>
      {error && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        empty="No reservations match this filter."
      />

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Reservation details"
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <img
                src={detail.guest?.avatar}
                alt=""
                className="h-14 w-14 rounded-full object-cover"
              />
              <div>
                <p className="text-base font-semibold">{detail.guest?.name}</p>
                <p className="text-gray-500">
                  Member since{" "}
                  {fmtDate(detail.guest?.createdAt, {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="break-all font-medium">{detail.guest?.email}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium">{detail.guest?.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Listing</dt>
                <dd className="font-medium">{detail.listing?.title}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Party size</dt>
                <dd className="font-medium">
                  {detail.guests} guest{detail.guests > 1 ? "s" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Check-in</dt>
                <dd className="font-medium">{fmtDate(detail.checkIn)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Checkout</dt>
                <dd className="font-medium">{fmtDate(detail.checkOut)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <StatusBadge status={detail.status} />
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Payment</dt>
                <dd>
                  {detail.payment ? (
                    <StatusBadge status={detail.payment.status} />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-gray-500">Your payout</dt>
                <dd className="font-medium">
                  {money(detail.subtotal + detail.cleaningFee)}{" "}
                  <span className="font-normal text-gray-500">
                    ({detail.nights} nights + cleaning fee)
                  </span>
                </dd>
              </div>
            </dl>
            <div className="border-t border-gray-100 pt-3">
              {actions(detail)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
