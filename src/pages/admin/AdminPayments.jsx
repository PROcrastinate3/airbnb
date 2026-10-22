import { useState } from "react";
import {
  DataTable,
  Spinner,
  StatCard,
  StatusBadge,
} from "../../components/ui.jsx";
import { getAllPayments, refundPayment } from "../../services/adminService.js";
import { fmtDate, money } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

export default function AdminPayments() {
  const {
    data: payments,
    loading,
    reload,
  } = useAsync(() => getAllPayments(), []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  if (loading) return <Spinner />;

  const sum = (st) =>
    payments.filter((p) => p.status === st).reduce((s, p) => s + p.amount, 0);

  const refund = async (p) => {
    if (!window.confirm(`Refund ${money(p.amount)} to ${p.guestName}?`)) return;
    setBusy(p.id);
    setError("");
    try {
      await refundPayment(p.id);
      reload();
    } catch (e) {
      setError(e.message);
    }
    setBusy(null);
  };

  const columns = [
    {
      key: "id",
      header: "Payment",
      render: (p) => (
        <span className="font-mono text-xs">{p.stripePaymentIntentId}</span>
      ),
    },
    { key: "createdAt", header: "Date", render: (p) => fmtDate(p.createdAt) },
    { key: "guestName", header: "Guest" },
    { key: "hostName", header: "Host" },
    {
      key: "method",
      header: "Method",
      render: (p) => `${p.brand} ••••${p.last4}`,
    },
    { key: "amount", header: "Amount", render: (p) => money(p.amount) },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "actions",
      header: "",
      render: (p) =>
        p.status === "succeeded" ? (
          <button
            className="btn-ghost text-xs text-red-600"
            disabled={busy === p.id}
            onClick={() => refund(p)}
          >
            Refund
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Collected" value={money(sum("succeeded"))} />
        <StatCard label="Pending" value={money(sum("pending"))} />
        <StatCard label="Refunded" value={money(sum("refunded"))} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {/* STRIPE: in production this table should read from your /payments collection, kept in sync by Stripe webhooks */}
      <DataTable columns={columns} rows={payments} />
    </div>
  );
}
