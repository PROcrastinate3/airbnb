import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import PasswordInput from "../components/PasswordInput.jsx";

const DEMO = [
  { label: "Guest", email: "guest@staybnb.com", password: "guest123" },
  { label: "Host", email: "host@staybnb.com", password: "host123" },
  { label: "Admin", email: "admin@staybnb.com", password: "admin123" },
];

const homeFor = (role) =>
  role === "admin" ? "/admin" : role === "host" ? "/host" : "/";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e, creds = form) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await login(creds.email, creds.password);
      navigate(from || homeFor(u.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">
          Log in to book stays, manage listings, or administer the platform.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <PasswordInput
              id="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          New here?{" "}
          <Link
            to="/register"
            state={{ from }}
            className="font-semibold underline"
          >
            Create an account
          </Link>
        </p>

        <div className="mt-8 rounded-xl border border-dashed border-gray-300 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Demo accounts (mock data)
          </p>
          <div className="flex gap-2">
            {DEMO.map((d) => (
              <button
                key={d.label}
                className="btn-outline flex-1 px-3 py-2 text-sm"
                onClick={() => submit(null, d)}
                disabled={busy}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
