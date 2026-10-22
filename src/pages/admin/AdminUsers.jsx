import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  DataTable,
  Modal,
  Spinner,
  StatusBadge,
} from "../../components/ui.jsx";
import {
  getAllUsers,
  setUserRole,
  setUserStatus,
  updateUserDetails,
} from "../../services/adminService.js";
import { fmtDate } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

export default function AdminUsers() {
  const { user: me } = useAuth();
  const { data: users, loading, reload } = useAsync(() => getAllUsers(), []);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  if (loading) return <Spinner />;

  const run = async (fn) => {
    setError("");
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const rows = users.filter(
    (u) =>
      (role === "all" || u.role === role) &&
      (!q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())),
  );

  const columns = [
    {
      key: "name",
      header: "User",
      render: (u) => (
        <div className="flex items-center gap-2">
          <img
            src={u.avatar}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
          <div>
            <p className="font-medium">{u.name}</p>
            <p className="text-xs text-gray-500">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (u) =>
        u.role === "admin" || u.id === me.id ? (
          <span className="capitalize">{u.role}</span>
        ) : (
          <select
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
            value={u.role}
            onChange={(e) => run(() => setUserRole(u.id, e.target.value))}
          >
            <option value="guest">Guest</option>
            <option value="host">Host</option>
          </select>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => <StatusBadge status={u.status} />,
    },
    { key: "createdAt", header: "Joined", render: (u) => fmtDate(u.createdAt) },
    {
      key: "actions",
      header: "",
      render: (u) => (
        <div className="flex gap-1">
          <button
            className="btn-ghost text-xs"
            onClick={() =>
              setEditing({
                id: u.id,
                name: u.name,
                phone: u.phone || "",
                bio: u.bio || "",
              })
            }
          >
            Edit
          </button>
          {u.role === "admin" ? null : u.status === "active" ? (
            <button
              className="btn-ghost text-xs text-red-600"
              onClick={() => run(() => setUserStatus(u.id, "suspended"))}
            >
              Suspend
            </button>
          ) : (
            <button
              className="btn-ghost text-xs"
              onClick={() => run(() => setUserStatus(u.id, "active"))}
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
      <h1 className="mb-6 text-2xl font-semibold">Users</h1>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs py-2"
          placeholder="Search name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input w-40 py-2"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="all">All roles</option>
          <option value="guest">Guests</option>
          <option value="host">Hosts</option>
          <option value="admin">Admins</option>
        </select>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <DataTable columns={columns} rows={rows} />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit user"
      >
        {editing && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await updateUserDetails(editing.id, editing);
                setEditing(null);
              });
            }}
          >
            <div>
              <label className="label" htmlFor="eu-name">
                Name
              </label>
              <input
                id="eu-name"
                className="input"
                required
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="eu-phone">
                Phone
              </label>
              <input
                id="eu-phone"
                className="input"
                value={editing.phone}
                onChange={(e) =>
                  setEditing({ ...editing, phone: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="eu-bio">
                Bio
              </label>
              <textarea
                id="eu-bio"
                rows={3}
                className="input"
                value={editing.bio}
                onChange={(e) =>
                  setEditing({ ...editing, bio: e.target.value })
                }
              />
            </div>
            <button className="btn-primary">Save changes</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
