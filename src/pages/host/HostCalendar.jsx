import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { EmptyState, Spinner } from "../../components/ui.jsx";
import { getHostListings } from "../../services/listingService.js";
import {
  getCalendarData,
  setBlockedDates,
} from "../../services/bookingService.js";
import { todayISO } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

const pad = (n) => String(n).padStart(2, "0");
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Availability calendar: shows reserved nights and lets the host block / unblock dates.
export default function HostCalendar() {
  const { user } = useAuth();
  const { data: listings, loading } = useAsync(
    () => getHostListings(user.id),
    [user.id],
  );
  const [listingId, setListingId] = useState("");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [cal, setCal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (listings?.length && !listingId) setListingId(listings[0].id);
  }, [listings, listingId]);

  const load = async (id = listingId) => {
    if (!id) return;
    setCal(await getCalendarData(id, user));
  };
  useEffect(() => {
    load();
  }, [listingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayISO();
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
    const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    return [
      ...Array(first.getUTCDay()).fill(null),
      ...Array.from(
        { length: days },
        (_, i) => `${cursor.y}-${pad(cursor.m + 1)}-${pad(i + 1)}`,
      ),
    ];
  }, [cursor]);

  const bookingFor = (iso) =>
    cal?.bookings.find((b) => iso >= b.checkIn && iso < b.checkOut);

  const toggle = async (iso) => {
    setError("");
    setBusy(true);
    try {
      const isBlocked = cal.blockedDates.includes(iso);
      await setBlockedDates(listingId, [iso], !isBlocked, user);
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const blockRange = async (block) => {
    const monthDays = cells.filter((c) => c && c >= today && !bookingFor(c));
    setBusy(true);
    await setBlockedDates(listingId, monthDays, block, user);
    await load();
    setBusy(false);
  };

  const move = (delta) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  if (loading) return <Spinner />;
  if (!listings?.length)
    return (
      <EmptyState
        title="No listings yet"
        text="Create a listing to manage its availability."
        action={
          <Link to="/host/listings/new" className="btn-primary">
            Create listing
          </Link>
        }
      />
    );

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Availability</h1>
          <p className="text-sm text-gray-500">
            Click a free date to block it, or a blocked date to open it again.
            Reserved nights can't be changed here.
          </p>
        </div>
        <select
          className="input w-72 py-2"
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
          aria-label="Listing"
        >
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <button
            className="btn-ghost"
            onClick={() => move(-1)}
            aria-label="Previous month"
          >
            ←
          </button>
          <h2 className="font-semibold">{monthLabel}</h2>
          <button
            className="btn-ghost"
            onClick={() => move(1)}
            aria-label="Next month"
          >
            →
          </button>
        </div>

        {!cal ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((iso, i) => {
                if (!iso) return <div key={`e${i}`} />;
                const b = bookingFor(iso);
                const blocked = cal.blockedDates.includes(iso);
                const past = iso < today;
                let cls = "border-gray-200 bg-white hover:border-gray-900";
                let label = "";
                if (past) cls = "border-transparent bg-gray-50 text-gray-300";
                else if (b) {
                  cls =
                    b.status === "pending"
                      ? "border-amber-300 bg-amber-100 text-amber-900"
                      : "border-green-300 bg-green-100 text-green-900";
                  label = b.guestName?.split(" ")[0];
                } else if (blocked) {
                  cls =
                    "border-gray-400 bg-gray-300 text-gray-700 line-through";
                  label = "Blocked";
                }
                return (
                  <button
                    key={iso}
                    disabled={past || !!b || busy}
                    onClick={() => toggle(iso)}
                    title={
                      b
                        ? `${b.guestName} · ${b.status}`
                        : blocked
                          ? "Blocked — click to open"
                          : "Click to block"
                    }
                    className={`flex h-16 flex-col items-center justify-start rounded-lg border p-1 text-sm transition disabled:cursor-default ${cls}`}
                  >
                    <span className="font-medium">{Number(iso.slice(8))}</span>
                    {label && (
                      <span className="w-full truncate text-[10px] leading-tight">
                        {label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-gray-600">
          <Legend cls="border-gray-200 bg-white" text="Available" />
          <Legend
            cls="border-green-300 bg-green-100"
            text="Reserved (confirmed)"
          />
          <Legend
            cls="border-amber-300 bg-amber-100"
            text="Reserved (pending request)"
          />
          <Legend cls="border-gray-400 bg-gray-300" text="Blocked by you" />
          <span className="ml-auto flex gap-2">
            <button
              className="btn-ghost text-xs"
              disabled={busy || !cal}
              onClick={() => blockRange(true)}
            >
              Block rest of month
            </button>
            <button
              className="btn-ghost text-xs"
              disabled={busy || !cal}
              onClick={() => blockRange(false)}
            >
              Unblock month
            </button>
          </span>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      {cal && cal.bookings.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Reserved stays</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {[...cal.bookings]
              .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
              .map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between py-2"
                >
                  <span>{b.guestName}</span>
                  <span className="text-gray-500">
                    {b.checkIn} → {b.checkOut}
                  </span>
                  <span className="capitalize text-gray-600">{b.status}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Legend({ cls, text }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-4 w-4 rounded border ${cls}`} /> {text}
    </span>
  );
}
