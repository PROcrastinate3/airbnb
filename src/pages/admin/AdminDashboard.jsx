import { Link } from "react-router-dom";
import {
  BarChart,
  DataTable,
  Spinner,
  StatCard,
  StatusBadge,
} from "../../components/ui.jsx";
import { getAdminStats } from "../../services/adminService.js";
import { fmtDate, money } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

export default function AdminDashboard() {
  const { data: s, loading } = useAsync(() => getAdminStats(), []);
  if (loading) return <Spinner />;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Platform overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Gross revenue"
          value={money(s.revenue)}
          hint="Successful payments"
        />
        <StatCard
          label="Platform fees"
          value={money(s.platformFees)}
          hint="Service fees earned"
        />
        <StatCard
          label="Users"
          value={s.users}
          hint={`${s.guests} guests · ${s.hosts} hosts`}
        />
        <StatCard label="Bookings" value={s.bookings} />
        <StatCard
          label="Properties"
          value={s.listings}
          hint={`${s.publishedListings} published · ${s.pendingListings} pending`}
        />
        <StatCard
          label="Hosts"
          value={s.hosts}
          hint={`${s.pendingHosts} application${s.pendingHosts === 1 ? "" : "s"} waiting`}
        />
      </div>

      {s.pendingHosts > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <span>
            <b>{s.pendingHosts}</b> host application
            {s.pendingHosts > 1 ? "s are" : " is"} waiting for approval.
          </span>
          <Link to="/admin/hosts" className="btn-primary px-4 py-2 text-sm">
            Review
          </Link>
        </div>
      )}
      {s.reportedReviews > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <span>
            <b>{s.reportedReviews}</b> reported review
            {s.reportedReviews > 1 ? "s" : ""} to moderate.
          </span>
          <Link to="/admin/reviews" className="btn-primary px-4 py-2 text-sm">
            Moderate
          </Link>
        </div>
      )}

      {s.pendingListings > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <span>
            <b>{s.pendingListings}</b> listing
            {s.pendingListings > 1 ? "s are" : " is"} waiting for approval.
          </span>
          <Link to="/admin/listings" className="btn-primary px-4 py-2 text-sm">
            Review
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 font-semibold">Revenue (last 6 months)</h2>
          <BarChart data={s.months} format={(v) => money(v)} />
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Latest bookings</h2>
          <DataTable
            columns={[
              { key: "guestName", header: "Guest" },
              {
                key: "listingTitle",
                header: "Listing",
                render: (b) => (
                  <span className="block max-w-[200px] truncate">
                    {b.listingTitle}
                  </span>
                ),
              },
              {
                key: "checkIn",
                header: "Check-in",
                render: (b) => fmtDate(b.checkIn),
              },
              {
                key: "status",
                header: "Status",
                render: (b) => <StatusBadge status={b.status} />,
              },
            ]}
            rows={s.recentBookings}
          />
        </div>
      </div>
    </div>
  );
}
