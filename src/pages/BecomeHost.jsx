import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fmtDate } from "../utils/format.js";

const STEPS = [
  {
    n: "1",
    t: "Apply to host",
    d: "Tell us about you and your place. It only takes a minute.",
  },
  {
    n: "2",
    t: "Get approved",
    d: "Our team reviews every host application before you can list.",
  },
  {
    n: "3",
    t: "Publish your listing",
    d: "Add photos, set your price and house rules. We review the listing, then you are live.",
  },
];

export default function BecomeHost() {
  const { user, isHost, applyAsHost, refreshUser } = useAuth();
  const navigate = useNavigate();
  const app = user?.hostApplication;
  const [form, setForm] = useState({
    businessName: app?.businessName || "",
    phone: user?.phone || "",
    about: app?.about || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // pick up an admin decision without needing a full page reload
  useEffect(() => {
    if (user) refreshUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await applyAsHost(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold sm:text-5xl">
          It's easy to get started on NAME?
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Turn your spare room or second home into income.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="card">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-600">
              {s.n}
            </span>
            <h3 className="mt-4 font-semibold">{s.t}</h3>
            <p className="mt-1 text-sm text-gray-600">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-xl">
        {!user ? (
          <div className="flex justify-center gap-3">
            <button
              className="btn-primary"
              onClick={() =>
                navigate("/register", { state: { from: "/become-a-host" } })
              }
            >
              Create an account to apply
            </button>
            <Link
              to="/login"
              state={{ from: "/become-a-host" }}
              className="btn-outline"
            >
              Log in
            </Link>
          </div>
        ) : isHost ? (
          <div className="flex justify-center gap-3">
            <Link to="/host/listings/new" className="btn-primary">
              Create a listing
            </Link>
            <Link to="/host" className="btn-outline">
              Go to host dashboard
            </Link>
          </div>
        ) : app?.status === "pending" ? (
          <div className="card border-amber-200 bg-amber-50 text-center">
            <p className="text-lg font-semibold">Application under review</p>
            <p className="mt-1 text-sm text-gray-700">
              Submitted {fmtDate(app.submittedAt)} for <b>{app.businessName}</b>
              . We will notify you as soon as an admin has reviewed it.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-4">
            {app?.status === "rejected" && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                Your last application was declined
                {app.note ? `: ${app.note}` : "."} You can update it and apply
                again.
              </p>
            )}
            {app?.status === "deactivated" && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                Your host account was deactivated by an administrator. You may
                submit a new application.
              </p>
            )}
            <h2 className="text-lg font-semibold">Host application</h2>
            <div>
              <label className="label" htmlFor="bn">
                Host or business name
              </label>
              <input
                id="bn"
                className="input"
                required
                value={form.businessName}
                onChange={set("businessName")}
              />
            </div>
            <div>
              <label className="label" htmlFor="ph">
                Phone
              </label>
              <input
                id="ph"
                className="input"
                value={form.phone}
                onChange={set("phone")}
              />
            </div>
            <div>
              <label className="label" htmlFor="ab">
                About your property
              </label>
              <textarea
                id="ab"
                rows={4}
                className="input"
                required
                value={form.about}
                onChange={set("about")}
                placeholder="Where is it, what kind of place, how many guests?"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Submitting…" : "Submit application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
