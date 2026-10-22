import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  BarChart,
  Spinner,
  StatCard,
  StatusBadge,
} from "../../components/ui.jsx";
import { getHostStats } from "../../services/hostService.js";
import { getHostBookings } from "../../services/bookingService.js";
import { fmtDate, money } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

export default function HostDashboard() {
  const { user } = useAuth();
  const { data: stats, loading } = useAsync(
    () => getHostStats(user.id),
    [user.id],
  );
  const { data: bookings } = useAsync(
    () => getHostBookings(user.id),
    [user.id],
  );

  if (loading) return <Spinner />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome back, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-gray-500">
            Here's what's happening with your listings.
          </p>
        </div>
        <Link to="/host/listings/new" className="btn-primary">
          + New listing
        </Link>
      </div>

      {stats.pendingRequests > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <span>
            <b>{stats.pendingRequests}</b> booking request
            {stats.pendingRequests > 1 ? "s are" : " is"} waiting for your
            answer.
          </span>
          <Link
            to="/host/reservations"
            className="btn-primary px-4 py-2 text-sm"
          >
            Review
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total earnings"
          value={money(stats.earnings)}
          hint={`${money(stats.thisMonth)} this month`}
        />
        <StatCard
          label="Active listings"
          value={`${stats.activeListings} / ${stats.totalListings}`}
        />
        <StatCard
          label="Upcoming stays"
          value={stats.upcoming}
          hint={`${stats.pendingRequests} pending requests`}
        />
        <StatCard
          label="Average rating"
          value={stats.avgRating ? `★ ${stats.avgRating.toFixed(2)}` : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <h2 className="mb-4 font-semibold">Earnings (last 6 months)</h2>
          <BarChart data={stats.months} format={(v) => money(v)} />
        </div>
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent reservations</h2>
            <Link
              to="/host/reservations"
              className="text-sm font-medium underline"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {(bookings || []).slice(0, 5).map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.guest?.name}</p>
                  <p className="truncate text-xs text-gray-500">
                    {b.listing?.title} ·{" "}
                    {fmtDate(b.checkIn, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </li>
            ))}
            {(bookings || []).length === 0 && (
              <li className="py-6 text-center text-sm text-gray-500">
                No reservations yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
