import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  markAllRead,
  markRead,
  subscribeNotifications,
} from "../services/notificationService.js";
import { timeAgo } from "../utils/format.js";

import {
  CalendarDays,
  Star,
  Home,
  Briefcase,
  ShieldCheck,
  Bell,
} from "lucide-react";

export const ICONS = {
  booking: CalendarDays,
  review: Star,
  listing: Home,
  host: Briefcase,
  admin: ShieldCheck,
  info: Bell,
};

// Live data comes from notificationService.subscribeNotifications (polling locally, onSnapshot on Firebase).
export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user) return undefined;
    return subscribeNotifications(user.id, ({ count, items }) => {
      setCount(count);
      setItems(items.slice(0, 6));
    });
  }, [user]);

  if (!user) return null;

  const openItem = async (n) => {
    await markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-xl hover:bg-gray-100"
        aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}
      >
        <Bell />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <p className="font-semibold">Notifications</p>
              {count > 0 && (
                <button
                  className="text-xs underline"
                  onClick={async () => {
                    await markAllRead(user.id);
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {items.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-gray-500">
                  You're all caught up.
                </li>
              )}
              {items.map((n) => {
                const Icon = ICONS[n.type] ?? ICONS.info;

                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openItem(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left text-sm hover:bg-gray-50 ${n.read ? "" : "bg-brand-50/50"}`}
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 shrink-0 text-gray-500"
                      >
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">{n.title}</span>
                        <span className="block text-xs text-gray-600">
                          {n.message}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-gray-400">
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block border-t border-gray-100 px-4 py-3 text-center text-sm font-medium hover:bg-gray-50"
            >
              View all
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
