import { useState } from "react";
import {
  DataTable,
  Modal,
  Spinner,
  StatusBadge,
} from "../../components/ui.jsx";
import {
  getHostAccounts,
  reviewHostApplication,
  setHostActive,
} from "../../services/adminService.js";
import { fmtDate } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

const TABS = [
  ["pending", "Applications"],
  ["approved", "Active hosts"],
  ["rejected", "Rejected"],
  ["deactivated", "Deactivated"],
];

export default function AdminHosts() {
  const {
    data: hosts,
    loading,
    reload,
  } = useAsync(() => getHostAccounts(), []);
  const [tab, setTab] = useState("pending");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState("");
  const [view, setView] = useState(null);

  if (loading) return <Spinner />;

  const run = async (id, fn) => {
    setBusy(id);
    setError("");
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e.message);
    }
    setBusy(null);
  };

  const rows = hosts.filter((h) => h.application.status === tab);
  const counts = Object.fromEntries(
    TABS.map(([k]) => [
      k,
      hosts.filter((h) => h.application.status === k).length,
    ]),
  );

  const columns = [
    {
      key: "name",
      header: "Host",
      render: (h) => (
        <button
          className="flex items-center gap-2 text-left hover:underline"
          onClick={() => setView(h)}
        >
          <img
            src={h.avatar}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
          <div>
            <p className="font-medium">{h.name}</p>
            <p className="text-xs text-gray-500">{h.email}</p>
          </div>
        </button>
      ),
    },
    {
      key: "biz",
      header: "Business",
      render: (h) => h.application.businessName || "—",
    },
    {
      key: "submitted",
      header: "Applied",
      render: (h) => fmtDate(h.application.submittedAt || h.createdAt),
    },
    { key: "listings", header: "Listings", render: (h) => h.listingCount },
    { key: "bookings", header: "Bookings", render: (h) => h.bookingCount },
    {
      key: "status",
      header: "Status",
      render: (h) => <StatusBadge status={h.application.status} />,
    },
    {
      key: "actions",
      header: "",
      render: (h) => (
        <div className="flex gap-1">
          {h.application.status === "pending" && (
            <>
              <button
                className="btn-primary px-3 py-1.5 text-xs"
                disabled={busy === h.id}
                onClick={() =>
                  run(h.id, () => reviewHostApplication(h.id, "approved"))
                }
              >
                Approve
              </button>
              <button
                className="btn-outline px-3 py-1.5 text-xs"
                disabled={busy === h.id}
                onClick={() => {
                  setRejecting(h);
                  setNote("");
                }}
              >
                Reject
              </button>
            </>
          )}
          {h.application.status === "approved" && (
            <button
              className="btn-ghost text-xs text-red-600"
              disabled={busy === h.id}
              onClick={() =>
                window.confirm(
                  `Deactivate ${h.name}? Their published listings will be hidden.`,
                ) && run(h.id, () => setHostActive(h.id, false))
              }
            >
              Deactivate
            </button>
          )}
          {["deactivated", "rejected"].includes(h.application.status) && (
            <button
              className="btn-ghost text-xs"
              disabled={busy === h.id}
              onClick={() => run(h.id, () => setHostActive(h.id, true))}
            >
              Reactivate
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Hosts</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full border px-4 py-1.5 text-sm ${tab === k ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 hover:border-gray-900"}`}
          >
            {label} ({counts[k]})
          </button>
        ))}
      </div>
      {error && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <DataTable columns={columns} rows={rows} empty="Nobody in this list." />

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.name || ""}`}
      >
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">
            Optionally tell the applicant why. They can edit and apply again.
          </p>
          <textarea
            rows={3}
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason (optional)"
          />
          <button
            className="btn-primary"
            onClick={() =>
              run(rejecting.id, async () => {
                await reviewHostApplication(rejecting.id, "rejected", note);
                setRejecting(null);
              })
            }
          >
            Reject application
          </button>
        </div>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title="Host details">
        {view && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium">{view.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Business name</dt>
              <dd className="font-medium">
                {view.application.businessName || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium">{view.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">About their property</dt>
              <dd>{view.application.about || "—"}</dd>
            </div>
            {view.application.note && (
              <div>
                <dt className="text-gray-500">Decision note</dt>
                <dd>{view.application.note}</dd>
              </div>
            )}
          </dl>
        )}
      </Modal>
    </div>
  );
}
