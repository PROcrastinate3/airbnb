import { useState } from "react";
import {
  BarChart,
  DataTable,
  Spinner,
  StatCard,
} from "../../components/ui.jsx";
import { getAnalytics } from "../../services/adminService.js";
import { money } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

export default function AdminAnalytics() {
  const [range, setRange] = useState(6);
  const { data: a, loading } = useAsync(() => getAnalytics(range), [range]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Reports & analytics</h1>
        <select
          className="input w-44 py-2"
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
          aria-label="Date range"
        >
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </select>
      </div>

      {loading || !a ? (
        <Spinner />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Bookings"
              value={a.totals.bookings}
              hint={`${a.totals.nights} nights sold`}
            />
            <StatCard
              label="Booking revenue"
              value={money(a.totals.revenue)}
              hint={`${money(a.totals.fees)} platform fees`}
            />
            <StatCard
              label="Average booking"
              value={money(a.totals.avgBooking)}
            />
            <StatCard
              label="Cancellation rate"
              value={`${a.totals.cancellationRate.toFixed(1)}%`}
              hint={`${a.totals.newUsers} new users`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-4 font-semibold">Bookings per month</h2>
              <BarChart data={a.bookingsByMonth} />
            </div>
            <div className="card">
              <h2 className="mb-4 font-semibold">Revenue per month</h2>
              <BarChart data={a.revenueByMonth} format={(v) => money(v)} />
            </div>
            <div className="card">
              <h2 className="mb-4 font-semibold">Reservation status</h2>
              <BarChart data={a.statusCounts} />
            </div>
            <div className="card">
              <h2 className="mb-4 font-semibold">New users per month</h2>
              <BarChart data={a.usersByMonth} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 font-semibold">Top listings</h2>
              <DataTable
                columns={[
                  {
                    key: "title",
                    header: "Listing",
                    render: (r) => (
                      <span className="block max-w-[220px] truncate">
                        {r.title}
                      </span>
                    ),
                  },
                  { key: "bookings", header: "Bookings" },
                  { key: "nights", header: "Nights" },
                  {
                    key: "revenue",
                    header: "Revenue",
                    render: (r) => money(r.revenue),
                  },
                ]}
                rows={a.topListings}
                empty="No bookings in this period."
              />
            </div>
            <div>
              <h2 className="mb-3 font-semibold">Revenue by category</h2>
              <DataTable
                columns={[
                  { key: "label", header: "Category" },
                  { key: "bookings", header: "Bookings" },
                  {
                    key: "revenue",
                    header: "Revenue",
                    render: (r) => money(r.revenue),
                  },
                ]}
                rows={a.byCategory.map((c) => ({ ...c, id: c.category }))}
                empty="No bookings in this period."
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
