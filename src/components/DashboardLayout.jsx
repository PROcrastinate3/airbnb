import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import NotificationBell from "./NotificationBell.jsx";
import {
  LayoutDashboard,
  Home,
  CalendarDays,
  CalendarCheck,
  Star,
  Wallet,
  User,
  Users,
  Briefcase,
  CreditCard,
  TrendingUp,
  Settings,
} from "lucide-react";

// Shared sidebar shell used by both the Host and Admin sections.
export default function DashboardLayout({ title, accent = "brand", links }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? "bg-brand-50 text-brand-600"
        : "text-gray-600 hover:bg-gray-100"
    }`;

  const sidebar = (
    <nav className="flex h-full flex-col">
      <Link
        to="/"
        className="mb-1 px-3 text-2xl font-extrabold tracking-tight text-brand-500"
      >
        ⌂ NAME?
      </Link>
      <p className="mb-6 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </p>
      <div className="space-y-1">
        {links.map((l) => {
          const Icon = l.icon;

          return (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={linkCls}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} aria-hidden className="shrink-0" /> {l.label}
            </NavLink>
          );
        })}
      </div>
      <div className="mt-auto space-y-1 border-t border-gray-200 pt-4">
        <Link
          to="/"
          className="block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          ← Back to NAME?
        </Link>
        <button
          onClick={async () => {
            await logout();
            navigate("/");
          }}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100"
        >
          Log out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-gray-200 bg-white p-4 lg:block">
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white p-4">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-8">
          <button
            className="rounded-lg p-2 text-xl hover:bg-gray-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="hidden text-sm text-gray-500 lg:block">
            Signed in as{" "}
            <span className="font-medium text-gray-900">{user?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <img
              src={user?.avatar}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          </div>
        </header>
        <main className="p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export const hostLinks = [
  { to: "/host", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/host/listings", label: "My listings", icon: Home },
  { to: "/host/reservations", label: "Reservations", icon: CalendarDays },
  { to: "/host/calendar", label: "Availability", icon: CalendarCheck },
  { to: "/host/reviews", label: "Reviews", icon: Star },
  { to: "/host/earnings", label: "Earnings", icon: Wallet },
  { to: "/profile", label: "My profile", icon: User },
];

export const adminLinks = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/hosts", label: "Hosts", icon: Briefcase },
  { to: "/admin/listings", label: "Listings", icon: Home },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/analytics", label: "Analytics", icon: TrendingUp },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];
