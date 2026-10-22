import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import NotificationBell from "./NotificationBell.jsx";

export default function Navbar() {
  const { user, isHost, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="container-page flex h-20 items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-brand-500"
        >
          <span aria-hidden>⌂</span> NAME?
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/search" className="btn-ghost">
            Explore
          </NavLink>
          {user ? (
            isHost ? (
              <NavLink to="/host" className="btn-ghost">
                Host dashboard
              </NavLink>
            ) : (
              <NavLink to="/become-a-host" className="btn-ghost">
                Become a host
              </NavLink>
            )
          ) : (
            <NavLink to="/become-a-host" className="btn-ghost">
              NAME? your home
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-3 rounded-full border border-gray-300 py-1.5 pl-4 pr-2 shadow-sm transition hover:shadow-search"
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span className="text-lg leading-none">☰</span>
              {user ? (
                <img
                  src={user.avatar}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-500 text-white">
                  ●
                </span>
              )}
            </button>

            {open && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setOpen(false)}
                />
                <div
                  className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white py-2 text-sm shadow-card"
                  role="menu"
                >
                  {user ? (
                    <>
                      <div className="border-b border-gray-100 px-4 pb-2">
                        <p className="font-semibold">{user.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          {user.email}
                        </p>
                      </div>
                      <NavLink
                        to="/search"
                        className="block w-full px-4 py-2.5 text-left hover:bg-gray-50"
                        onClick={() => setOpen(false)}
                      >
                        Explore
                      </NavLink>
                      <MenuItem onClick={() => go("/trips")}>Trips</MenuItem>
                      <MenuItem onClick={() => go("/wishlist")}>
                        Wishlist
                      </MenuItem>
                      <MenuItem onClick={() => go("/notifications")}>
                        Notifications
                      </MenuItem>
                      <MenuItem onClick={() => go("/profile")}>
                        Account
                      </MenuItem>
                      <div className="my-1 border-t border-gray-100" />
                      {isHost ? (
                        <MenuItem onClick={() => go("/host")}>
                          Host dashboard
                        </MenuItem>
                      ) : (
                        <MenuItem onClick={() => go("/become-a-host")}>
                          Become a host
                        </MenuItem>
                      )}
                      {isAdmin && (
                        <MenuItem onClick={() => go("/admin")}>
                          Admin panel
                        </MenuItem>
                      )}
                      <div className="my-1 border-t border-gray-100" />
                      <MenuItem
                        onClick={async () => {
                          setOpen(false);
                          await logout();
                          navigate("/");
                        }}
                      >
                        Log out
                      </MenuItem>
                    </>
                  ) : (
                    <>
                      <MenuItem onClick={() => go("/login")} bold>
                        Log in
                      </MenuItem>
                      <MenuItem onClick={() => go("/register")}>
                        Sign up
                      </MenuItem>
                      <div className="my-1 border-t border-gray-100" />
                      <MenuItem onClick={() => go("/become-a-host")}>
                        NAME your home
                      </MenuItem>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuItem({ children, onClick, bold }) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className={`block w-full px-4 py-2.5 text-left hover:bg-gray-50 ${bold ? "font-semibold" : ""}`}
    >
      {children}
    </button>
  );
}
