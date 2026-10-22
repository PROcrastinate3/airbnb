import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { Spinner } from "../../components/ui.jsx";
import { AMENITIES, PROPERTY_TYPES } from "../../data/constants.js";
import { getCategories } from "../../services/settingsService.js";
import { uploadImage } from "../../services/storageService.js";
import { CANCELLATION_POLICIES } from "../../services/bookingService.js";
import { DEFAULT_RULES } from "../../services/rules.js";
import {
  createListing,
  getListing,
  updateListing,
} from "../../services/listingService.js";

const EMPTY = {
  title: "",
  description: "",
  location: "",
  street: "",
  neighborhood: "",
  city: "",
  province: "",
  postalCode: "",
  landmark: "",
  country: "Philippines",
  category: "city",
  propertyType: "House",
  pricePerNight: 100,
  cleaningFee: 20,
  maxGuests: 2,
  bedrooms: 1,
  beds: 1,
  baths: 1,
  amenities: ["Wifi"],
  images: [],
  houseRules: DEFAULT_RULES,
  checkInTime: "14:00",
  checkOutTime: "11:00",
  cancellationPolicy: "moderate",
  instantBook: true,
};

const HOURS = Array.from(
  { length: 24 },
  (_, h) => `${String(h).padStart(2, "0")}:00`,
);
const hourLabel = (v) => {
  const h = Number(v.slice(0, 2));
  return `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;
};

export default function ListingForm() {
  const { id } = useParams();
  const editing = !!id;
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const CATEGORIES = getCategories();
  const [form, setForm] = useState(EMPTY);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    getListing(id).then((l) => {
      if (!l || (l.hostId !== user.id && !isAdmin))
        return navigate("/host/listings", { replace: true });
      const { host, reviews, ...rest } = l;
      setForm(rest);
      setLoading(false);
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Spinner />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleAmenity = (a) =>
    setForm({
      ...form,
      amenities: form.amenities.includes(a)
        ? form.amenities.filter((x) => x !== a)
        : [...form.amenities, a],
    });

  const addImage = () => {
    const url = imageUrl.trim();
    if (!/^https?:\/\//i.test(url))
      return setError("Enter a valid image URL (https://…).");
    setError("");
    setForm({ ...form, images: [...form.images, url] });
    setImageUrl("");
  };

  // Uploads go through storageService (Firebase Storage later); form.images only ever holds URLs.
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const url = await uploadImage(file, "listings");
      setForm((f) => ({ ...f, images: [...f.images, url] }));
    } catch (err) {
      setError(err.message);
    }
    e.target.value = "";
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.images.length === 0) return setError("Add at least one photo.");
    setBusy(true);
    setError("");
    try {
      // short label shown on cards, e.g. "Brgy. Catangnan, General Luna"
      const location =
        [form.neighborhood, form.city].filter(Boolean).join(", ") || form.city;
      const payload = {
        ...form,
        location,
      };
      if (editing) await updateListing(id, payload, user);
      else await createListing(user.id, payload);
      navigate("/host/listings");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">
        {editing ? "Edit listing" : "Create a new listing"}
      </h1>

      <section className="card space-y-4">
        <h2 className="font-semibold">Basics</h2>
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            required
            value={form.title}
            onChange={set("title")}
            placeholder="Cozy cabin near the lake"
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input"
            rows={5}
            required
            value={form.description}
            onChange={set("description")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Property type</label>
            <select
              className="input"
              value={form.propertyType}
              onChange={set("propertyType")}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={set("category")}
            >
              {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Location</h2>
        <p className="text-sm text-gray-500">
          Guests see the street, area and map pin so they know exactly where the
          place is.
        </p>
        <div>
          <label className="label">Street address</label>
          <input
            className="input"
            required
            value={form.street}
            onChange={set("street")}
            placeholder="e.g. 12 Tourism Road"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Barangay / neighbourhood</label>
            <input
              className="input"
              value={form.neighborhood}
              onChange={set("neighborhood")}
              placeholder="e.g. Brgy. Catangnan"
            />
          </div>
          <div>
            <label className="label">City / municipality</label>
            <input
              className="input"
              required
              value={form.city}
              onChange={set("city")}
              placeholder="e.g. General Luna"
            />
          </div>
          <div>
            <label className="label">Province / state</label>
            <input
              className="input"
              required
              value={form.province}
              onChange={set("province")}
              placeholder="e.g. Surigao del Norte"
            />
          </div>
          <div>
            <label className="label">Postal code</label>
            <input
              className="input"
              value={form.postalCode}
              onChange={set("postalCode")}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Country</label>
            <input
              className="input"
              required
              value={form.country}
              onChange={set("country")}
            />
          </div>
        </div>
        <div>
          <label className="label">Nearby landmark (optional)</label>
          <input
            className="input"
            value={form.landmark}
            onChange={set("landmark")}
            placeholder="e.g. 5 min walk to Cloud 9 boardwalk"
          />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Capacity & pricing</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["maxGuests", "Guests"],
            ["bedrooms", "Bedrooms"],
            ["beds", "Beds"],
            ["baths", "Baths"],
          ].map(([k, l]) => (
            <div key={k}>
              <label className="label">{l}</label>
              <input
                type="number"
                min="1"
                required
                className="input"
                value={form[k]}
                onChange={set(k)}
              />
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Price per night (USD)</label>
            <input
              type="number"
              min="1"
              required
              className="input"
              value={form.pricePerNight}
              onChange={set("pricePerNight")}
            />
          </div>
          <div>
            <label className="label">Cleaning fee (USD)</label>
            <input
              type="number"
              min="0"
              className="input"
              value={form.cleaningFee}
              onChange={set("cleaningFee")}
            />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">House rules & booking</h2>
        <div>
          <label className="label">House rules (one per line)</label>
          <textarea
            rows={4}
            className="input"
            value={(form.houseRules || []).join("\n")}
            onChange={(e) =>
              setForm({ ...form, houseRules: e.target.value.split("\n") })
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Check-in from</label>
            <select
              className="input"
              value={form.checkInTime}
              onChange={set("checkInTime")}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Checkout before</label>
            <select
              className="input"
              value={form.checkOutTime}
              onChange={set("checkOutTime")}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Cancellation policy</label>
          <select
            className="input"
            value={form.cancellationPolicy}
            onChange={set("cancellationPolicy")}
          >
            {Object.entries(CANCELLATION_POLICIES).map(([k, p]) => (
              <option key={k} value={k}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {CANCELLATION_POLICIES[form.cancellationPolicy]?.desc}
          </p>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-brand-500"
            checked={form.instantBook !== false}
            onChange={(e) =>
              setForm({ ...form, instantBook: e.target.checked })
            }
          />
          <span>
            <b>Instant book</b> — guests are confirmed right after paying. Turn
            this off to review and accept each request yourself.
          </span>
        </label>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Amenities</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AMENITIES.map((a) => (
            <label
              key={a}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={form.amenities.includes(a)}
                onChange={() => toggleAmenity(a)}
                className="h-4 w-4 accent-brand-500"
              />
              {a}
            </label>
          ))}
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Photos</h2>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Paste an image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          <button
            type="button"
            className="btn-outline whitespace-nowrap"
            onClick={addImage}
          >
            Add
          </button>
        </div>
        <div>
          <label className="label">…or upload a file</label>
          <input
            type="file"
            accept="image/*"
            onChange={onFile}
            className="text-sm"
          />
        </div>
        {form.images.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {form.images.map((src, i) => (
              <div key={i} className="group relative">
                <img
                  src={src}
                  alt=""
                  className="aspect-[4/3] w-full rounded-lg object-cover"
                />
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded bg-white px-2 py-0.5 text-xs font-semibold">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      images: form.images.filter((_, x) => x !== i),
                    })
                  }
                  className="absolute right-2 top-2 h-6 w-6 rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
      {!editing && (
        <p className="text-xs text-gray-500">
          New listings are reviewed by our team before they go live.
        </p>
      )}

      <div className="flex gap-3">
        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Submit for review"}
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => navigate("/host/listings")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
