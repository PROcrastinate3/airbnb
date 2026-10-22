import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { DataTable, Spinner, StatusBadge } from "../../components/ui.jsx";
import { getAllBookings } from "../../services/adminService.js";
import { updateBookingStatus } from "../../services/bookingService.js";
import { fmtDate, money } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

export default function AdminBookings() {
  const {
    data: bookings,
    loading,
    reload,
  } = useAsync(() => getAllBookings(), []);
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  if (loading) return <Spinner />;
  const rows = bookings.filter((b) => filter === "all" || b.status === filter);

  const columns = [
    {
      key: "id",
      header: "ID",
      render: (b) => (
        <span className="font-mono text-xs uppercase">
          {b.id.replace("b_", "")}
        </span>
      ),
    },
    { key: "guestName", header: "Guest" },
    { key: "hostName", header: "Host" },
    {
      key: "listingTitle",
      header: "Listing",
      render: (b) => (
        <span className="block max-w-[220px] truncate">{b.listingTitle}</span>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      render: (b) =>
        `${fmtDate(b.checkIn, { month: "short", day: "numeric" })} → ${fmtDate(b.checkOut)}`,
    },
    { key: "total", header: "Total", render: (b) => money(b.total) },
    {
      key: "status",
      header: "Status",
      render: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: "actions",
      header: "",
      render: (b) =>
        ["pending", "confirmed"].includes(b.status) ? (
          <button
            className="btn-ghost text-xs text-red-600"
            onClick={async () => {
              if (!window.confirm("Cancel this booking and refund the guest?"))
                return;
              try {
                await updateBookingStatus(b.id, "cancelled", user);
                reload();
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Cancel
          </button>
        ) : null,
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Bookings</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "pending", "confirmed", "completed", "cancelled"].map((f) => (
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
      <DataTable columns={columns} rows={rows} />
    </div>
  );
}
