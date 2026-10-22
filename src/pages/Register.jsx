import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import PasswordInput from "../components/PasswordInput.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "guest",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await register(form);
      navigate(u.wantsHost ? "/become-a-host" : from || "/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              required
              className="input"
              value={form.name}
              onChange={set("name")}
            />
          </div>
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
              onChange={set("email")}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <PasswordInput
              id="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
            />
            <p className="mt-1 text-xs text-gray-500">At least 6 characters.</p>
          </div>
          <fieldset>
            <legend className="label">I want to</legend>
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: "guest", t: "Book stays", d: "Travel & explore" },
                { v: "host", t: "Host a home", d: "List & earn" },
              ].map((o) => (
                <label
                  key={o.v}
                  className={`cursor-pointer rounded-xl border p-3 text-sm transition ${form.role === o.v ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-300"}`}
                >
                  <input
                    type="radio"
                    name="role"
                    className="sr-only"
                    checked={form.role === o.v}
                    onChange={() => setForm({ ...form, role: o.v })}
                  />
                  <span className="block font-semibold">{o.t}</span>
                  <span className="text-gray-500">{o.d}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Creating account…" : "Sign up"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            to="/login"
            state={{ from }}
            className="font-semibold underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
