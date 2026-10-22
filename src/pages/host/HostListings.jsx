import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { EmptyState, Spinner, StatusBadge } from "../../components/ui.jsx";
import {
  deleteListing,
  getHostListings,
  updateListing,
} from "../../services/listingService.js";
import { money } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

export default function HostListings() {
  const { user } = useAuth();
  const {
    data: listings,
    loading,
    reload,
  } = useAsync(() => getHostListings(user.id), [user.id]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const remove = async (l) => {
    if (!window.confirm(`Delete "${l.title}"? This cannot be undone.`)) return;
    setBusy(l.id);
    setError("");
    try {
      await deleteListing(l.id, user);
      reload();
    } catch (e) {
      setError(e.message); // e.g. the listing still has upcoming reservations
    }
    setBusy(null);
  };

  const toggle = async (l) => {
    setBusy(l.id);
    setError("");
    try {
      await updateListing(
        l.id,
        { status: l.status === "published" ? "unlisted" : "pending" },
        user,
      );
      reload();
    } catch (e) {
      setError(e.message);
    }
    setBusy(null);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My listings</h1>
        <Link to="/host/listings/new" className="btn-primary">
          + New listing
        </Link>
      </div>

      {error && (
        <p
          className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
      {loading ? (
        <Spinner />
      ) : listings.length === 0 ? (
        <EmptyState
          title="You have no listings yet"
          text="Create your first listing to start earning."
          action={
            <Link to="/host/listings/new" className="btn-primary">
              Create listing
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((l) => (
            <div
              key={l.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <img
                src={l.images[0]}
                alt=""
                className="h-44 w-full object-cover"
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug">{l.title}</h3>
                  <StatusBadge status={l.status} />
                </div>
                <p className="mt-1 text-sm text-gray-500">{l.location}</p>
                <p className="mt-1 text-sm">
                  <b>{money(l.pricePerNight)}</b> / night · ★{" "}
                  {l.rating ? l.rating.toFixed(2) : "New"}
                </p>
                {l.status === "pending" && (
                  <p className="mt-2 text-xs text-amber-700">
                    Awaiting admin approval.
                  </p>
                )}
                {l.status === "rejected" && (
                  <p className="mt-2 text-xs text-red-700">
                    Rejected — edit the listing and resubmit.
                  </p>
                )}
                {l.status === "suspended" && (
                  <p className="mt-2 text-xs text-red-700">
                    Hidden by an administrator.
                  </p>
                )}
                {!l.instantBook && (
                  <p className="mt-1 text-xs text-gray-500">Request to book</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/host/listings/${l.id}/edit`}
                    className="btn-outline px-3 py-1.5 text-sm"
                  >
                    Edit
                  </Link>
                  {l.status === "published" && (
                    <Link to={`/listing/${l.id}`} className="btn-ghost">
                      View
                    </Link>
                  )}
                  {["published", "unlisted"].includes(l.status) && (
                    <button
                      className="btn-ghost"
                      disabled={busy === l.id}
                      onClick={() => toggle(l)}
                    >
                      {l.status === "published" ? "Unlist" : "Request relist"}
                    </button>
                  )}
                  <button
                    className="btn-ghost text-red-600"
                    disabled={busy === l.id}
                    onClick={() => remove(l)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
