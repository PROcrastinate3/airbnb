import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { EmptyState, Spinner } from "../components/ui.jsx";
import { ICONS } from "../components/NotificationBell.jsx";
import {
  deleteNotification,
  getNotifications,
  markAllRead,
  markRead,
} from "../services/notificationService.js";
import { timeAgo } from "../utils/format.js";
import { useAsync } from "../hooks/useAsync.js";
import { X } from "lucide-react";

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    data: items,
    loading,
    reload,
  } = useAsync(() => getNotifications(user.id), [user.id]);

  const open = async (n) => {
    await markRead(n.id);
    if (n.link) navigate(n.link);
    else reload();
  };

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Notifications</h1>
        {(items || []).some((n) => !n.read) && (
          <button
            className="btn-ghost underline"
            onClick={async () => {
              await markAllRead(user.id);
              reload();
            }}
          >
            Mark all as read
          </button>
        )}
      </div>
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No notifications yet"
            text="Booking confirmations, cancellations and other updates will show up here."
          />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? ICONS.info;

            return (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-4 py-4 ${n.read ? "bg-white" : "bg-brand-50/50"}`}
              >
                <span className="mt-0.5 shrink-0 text-gray-500" aria-hidden>
                  <Icon size={22} />
                </span>
                <button
                  onClick={() => open(n)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="font-medium">
                    {n.title}{" "}
                    {!n.read && (
                      <span className="ml-1 inline-block h-2 w-2 rounded-full bg-brand-500 align-middle" />
                    )}
                  </p>
                  <p className="text-sm text-gray-600">{n.message}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {timeAgo(n.createdAt)}
                  </p>
                </button>
                <button
                  className="btn-ghost text-xs text-gray-500"
                  onClick={async () => {
                    await deleteNotification(n.id);
                    reload();
                  }}
                  aria-label="Delete notification"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
