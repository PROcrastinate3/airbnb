import { useAuth } from "../../context/AuthContext.jsx";
import {
  BarChart,
  DataTable,
  Spinner,
  StatCard,
  StatusBadge,
} from "../../components/ui.jsx";
import { getHostPayouts, getHostStats } from "../../services/hostService.js";
import { fmtDate, money } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

export default function HostEarnings() {
  const { user } = useAuth();
  const { data: stats, loading } = useAsync(
    () => getHostStats(user.id),
    [user.id],
  );
  const { data: payouts } = useAsync(() => getHostPayouts(user.id), [user.id]);

  if (loading) return <Spinner />;

  const paid = (payouts || [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const scheduled = (payouts || [])
    .filter((p) => p.status === "scheduled")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Earnings</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total earnings" value={money(stats.earnings)} />
        <StatCard label="Paid out" value={money(paid)} />
        <StatCard
          label="Scheduled"
          value={money(scheduled)}
          hint="Released after check-in"
        />
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">Monthly earnings</h2>
        <BarChart data={stats.months} format={(v) => money(v)} />
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Payout history</h2>
        {/* STRIPE: for real payouts use Stripe Connect (Express accounts) and list stripe.payouts / transfers here */}
        <DataTable
          columns={[
            {
              key: "checkIn",
              header: "Stay",
              render: (p) => fmtDate(p.checkIn),
            },
            { key: "guest", header: "Guest" },
            {
              key: "listing",
              header: "Listing",
              render: (p) => (
                <span className="block max-w-[260px] truncate">
                  {p.listing}
                </span>
              ),
            },
            { key: "amount", header: "Amount", render: (p) => money(p.amount) },
            {
              key: "status",
              header: "Status",
              render: (p) => <StatusBadge status={p.status} />,
            },
          ]}
          rows={(payouts || []).map((p) => ({ ...p, id: p.bookingId }))}
          empty="No payouts yet."
        />
      </div>
    </div>
  );
}
