import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { DataTable, Spinner, StatusBadge } from "../../components/ui.jsx";
import {
  getAllListings,
  removeListing,
  setListingStatus,
} from "../../services/adminService.js";
import { money } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

const FILTERS = [
  "all",
  "pending",
  "published",
  "rejected",
  "suspended",
  "unlisted",
];

export default function AdminListings() {
  const {
    data: listings,
    loading,
    reload,
  } = useAsync(() => getAllListings(), []);
  const { user } = useAuth();
  const [filter, setFilter] = useState("pending");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  if (loading) return <Spinner />;

  const act = async (id, status) => {
    setBusy(id);
    setError("");
    try {
      await setListingStatus(id, status);
      reload();
    } catch (e) {
      setError(e.message);
    }
    setBusy(null);
  };

  const remove = async (l) => {
    if (
      !window.confirm(
        `Permanently remove "${l.title}"? This also deletes its reviews.`,
      )
    )
      return;
    setBusy(l.id);
    setError("");
    try {
      await removeListing(l.id, user);
      reload();
    } catch (e) {
      setError(e.message); // listings with upcoming reservations can't be removed
    }
    setBusy(null);
  };

  const rows = listings.filter((l) => filter === "all" || l.status === filter);

  const columns = [
    {
      key: "title",
      header: "Listing",
      render: (l) => (
        <div className="flex items-center gap-3">
          <img
            src={l.images[0]}
            alt=""
            className="h-12 w-16 rounded-md object-cover"
          />
          <div>
            <p className="max-w-[240px] truncate font-medium">{l.title}</p>
            <p className="text-xs text-gray-500">{l.location}</p>
          </div>
        </div>
      ),
    },
    { key: "hostName", header: "Host" },
    {
      key: "pricePerNight",
      header: "Price",
      render: (l) => `${money(l.pricePerNight)} / night`,
    },
    {
      key: "status",
      header: "Status",
      render: (l) => <StatusBadge status={l.status} />,
    },
    {
      key: "actions",
      header: "",
      render: (l) => (
        <div className="flex gap-1">
          {l.status !== "published" && (
            <button
              className="btn-primary px-3 py-1.5 text-xs"
              disabled={busy === l.id}
              onClick={() => act(l.id, "published")}
            >
              Approve
            </button>
          )}
          {l.status === "pending" && (
            <button
              className="btn-outline px-3 py-1.5 text-xs"
              disabled={busy === l.id}
              onClick={() => act(l.id, "rejected")}
            >
              Reject
            </button>
          )}
          {l.status === "published" && (
            <button
              className="btn-ghost text-xs text-red-600"
              disabled={busy === l.id}
              onClick={() => act(l.id, "suspended")}
            >
              Hide
            </button>
          )}
          {l.status === "published" && (
            <Link to={`/listing/${l.id}`} className="btn-ghost text-xs">
              View
            </Link>
          )}
          <button
            className="btn-ghost text-xs text-red-600"
            disabled={busy === l.id}
            onClick={() => remove(l)}
          >
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Listings</h1>
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
        <p
          className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        empty="No listings in this state."
      />
    </div>
  );
}
