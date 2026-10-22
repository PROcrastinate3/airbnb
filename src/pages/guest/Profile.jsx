import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { changePassword } from "../../services/authService.js";
import { resetDemoData } from "../../services/devService.js";
import { uploadImage } from "../../services/storageService.js";
import PasswordInput from "../../components/PasswordInput.jsx";

export default function Profile() {
  const { user, updateUser, isHost, isAdmin } = useAuth();
  const showBusiness = isHost && !isAdmin && user.hostApplication;
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || "",
    bio: user.bio || "",
    avatar: user.avatar || "",
    businessName: user.hostApplication?.businessName || "",
  });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateUser(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // storageService returns a URL (Firebase Storage download URL in production) — never raw image bytes.
  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file, "avatars");
      setForm((f) => ({ ...f, avatar: url }));
    } catch (err) {
      setError(err.message);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ type: "", text: "" });
    if (pw.next !== pw.confirm)
      return setPwMsg({ type: "error", text: "New passwords do not match." });
    try {
      await changePassword(user.id, pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ type: "ok", text: "Password updated ✓" });
    } catch (err) {
      setPwMsg({ type: "error", text: err.message });
    }
  };

  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="text-3xl font-semibold">
        {showBusiness ? "Host profile" : "Account"}
      </h1>
      <div className="mt-6 flex items-center gap-4">
        <img
          src={form.avatar}
          alt=""
          className="h-20 w-20 rounded-full object-cover"
        />
        <div>
          <p className="text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-gray-500">
            {user.email} · <span className="capitalize">{user.role}</span>
          </p>
        </div>
      </div>

      <form onSubmit={save} className="card mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            className="input"
            required
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
            className="input bg-gray-50"
            value={user.email}
            disabled
          />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            className="input"
            value={form.phone}
            onChange={set("phone")}
          />
        </div>
        {showBusiness && (
          <div>
            <label className="label" htmlFor="biz">
              Business / host name
            </label>
            <input
              id="biz"
              className="input"
              value={form.businessName}
              onChange={set("businessName")}
            />
          </div>
        )}
        <div>
          <label className="label" htmlFor="bio">
            About you
          </label>
          <textarea
            id="bio"
            rows={4}
            className="input"
            value={form.bio}
            onChange={set("bio")}
          />
        </div>
        <div>
          <label className="label" htmlFor="avatar">
            Profile photo
          </label>
          <input
            id="avatar"
            className="input"
            placeholder="Paste an image URL"
            value={form.avatar.startsWith("data:") ? "" : form.avatar}
            onChange={set("avatar")}
          />
          <input
            type="file"
            accept="image/*"
            onChange={onPhoto}
            className="mt-2 block text-sm"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </form>

      <form onSubmit={savePassword} className="card mt-6 space-y-4">
        <h2 className="font-semibold">Change password</h2>
        <PasswordInput
          placeholder="Current password"
          autoComplete="current-password"
          required
          value={pw.current}
          onChange={(e) => setPw({ ...pw, current: e.target.value })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordInput
            placeholder="New password"
            autoComplete="new-password"
            required
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
          <PasswordInput
            placeholder="Confirm new password"
            autoComplete="new-password"
            required
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          />
        </div>
        {pwMsg.text && (
          <p
            className={`text-sm ${pwMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}
          >
            {pwMsg.text}
          </p>
        )}
        <button className="btn-outline">Update password</button>
      </form>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/trips" className="btn-outline">
          My trips
        </Link>
        <Link to="/wishlist" className="btn-outline">
          Wishlist
        </Link>
        <Link to="/notifications" className="btn-outline">
          Notifications
        </Link>
        {isHost && (
          <Link to="/host" className="btn-outline">
            Host dashboard
          </Link>
        )}
        {isAdmin && (
          <Link to="/admin" className="btn-outline">
            Admin panel
          </Link>
        )}
      </div>

      <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-4 text-sm">
        <p className="font-medium">Developer tools</p>
        <p className="mt-1 text-gray-500">
          Reset all mock data (users, listings, bookings) back to the original
          seed.
        </p>
        <button
          className="btn-ghost mt-2 text-red-600"
          onClick={async () => {
            if (window.confirm("Reset all mock data and log out?")) {
              await resetDemoData();
              window.location.href = "/";
            }
          }}
        >
          Reset demo data
        </button>
      </div>
    </div>
  );
}
