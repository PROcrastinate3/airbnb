import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDaysISO, todayISO } from "../utils/format.js";
import { Search } from "lucide-react";

export default function SearchBar({ initial = {}, compact = false }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(initial.q || "");
  const [checkIn, setCheckIn] = useState(initial.checkIn || "");
  const [checkOut, setCheckOut] = useState(initial.checkOut || "");
  const [guests, setGuests] = useState(initial.guests || "");

  const submit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (guests) params.set("guests", guests);
    navigate(`/search?${params.toString()}`);
  };

  const field = "flex flex-1 flex-col px-5 py-3 text-left";
  const lbl = "text-xs font-semibold";
  const inp =
    "bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400";

  return (
    <form
      onSubmit={submit}
      className={`mx-auto flex w-full flex-col divide-y divide-gray-200 rounded-3xl border border-gray-200 bg-white shadow-search md:flex-row md:items-center md:divide-x md:divide-y-0 md:rounded-full ${
        compact ? "max-w-3xl" : "max-w-4xl"
      }`}
    >
      <label className={`${field} md:flex-[1.5]`}>
        <span className={lbl}>Where</span>
        <input
          className={inp}
          placeholder="Search destinations"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <label className={field}>
        <span className={lbl}>Check in</span>
        <input
          type="date"
          className={inp}
          min={todayISO()}
          value={checkIn}
          onChange={(e) => {
            setCheckIn(e.target.value);
            if (checkOut && checkOut <= e.target.value) setCheckOut("");
          }}
        />
      </label>
      <label className={field}>
        <span className={lbl}>Check out</span>
        <input
          type="date"
          className={inp}
          min={checkIn ? addDaysISO(checkIn, 1) : todayISO()}
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
        />
      </label>
      <label className={field}>
        <span className={lbl}>Who</span>
        <input
          type="number"
          min="1"
          className={inp}
          placeholder="Add guests"
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
        />
      </label>
      <div className="p-2">
        <button
          type="submit"
          className="btn-primary w-full rounded-full px-6 py-3 md:w-auto"
          aria-label="Search"
        >
          <Search /> <span className="ml-2 md:hidden">Search</span>
        </button>
      </div>
    </form>
  );
}
