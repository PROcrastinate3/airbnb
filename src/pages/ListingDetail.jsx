import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Spinner, Stars, Modal, EmptyState } from "../components/ui.jsx";
import ReviewForm from "../components/ReviewForm.jsx";
import {
  getListing,
  getReviewEligibility,
} from "../services/listingService.js";
import {
  CANCELLATION_POLICIES,
  calculatePricing,
  getUnavailableRanges,
  nightsBetween,
} from "../services/bookingService.js";
import {
  addDaysISO,
  areaLine,
  fmtDate,
  fmtTime,
  fullAddress,
  money,
  todayISO,
} from "../utils/format.js";
import { useAsync } from "../hooks/useAsync.js";

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, wishlist, toggleFavorite } = useAuth();
  const {
    data: listing,
    loading,
    reload,
  } = useAsync(() => getListing(id), [id]);
  const { data: blocked } = useAsync(() => getUnavailableRanges(id), [id]);
  const { data: eligibility, reload: reloadEligibility } = useAsync(
    () => getReviewEligibility(user?.id, id),
    [id, user?.id],
  );

  // dates / guests chosen on the search page carry over here
  const [params] = useSearchParams();
  const [checkIn, setCheckIn] = useState(params.get("checkIn") || "");
  const [checkOut, setCheckOut] = useState(params.get("checkOut") || "");
  const [guests, setGuests] = useState(Number(params.get("guests")) || 1);
  const [gallery, setGallery] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const nights = nightsBetween(checkIn, checkOut);
  const pricing = useMemo(
    () => (listing && nights > 0 ? calculatePricing(listing, nights) : null),
    [listing, nights],
  );

  if (loading) return <Spinner className="min-h-[60vh] items-center" />;
  if (!listing)
    return (
      <div className="container-page py-20">
        <EmptyState
          title="Listing not found"
          action={
            <Link to="/search" className="btn-primary">
              Browse stays
            </Link>
          }
        />
      </div>
    );

  const liked = wishlist.includes(listing.id);
  const policy =
    CANCELLATION_POLICIES[listing.cancellationPolicy] ||
    CANCELLATION_POLICIES.moderate;
  const overlaps = (blocked || []).some(
    (r) =>
      checkIn &&
      checkOut &&
      new Date(checkIn) < new Date(r.checkOut) &&
      new Date(checkOut) > new Date(r.checkIn),
  );

  const reserve = () => {
    setError("");
    if (!checkIn || !checkOut || nights < 1)
      return setError("Select your check-in and check-out dates.");
    if (overlaps) return setError("Those dates are not available.");
    if (guests > listing.maxGuests)
      return setError(`Maximum ${listing.maxGuests} guests.`);
    const qs = new URLSearchParams({
      listingId: listing.id,
      checkIn,
      checkOut,
      guests,
    });
    if (!user)
      return navigate("/login", { state: { from: `/checkout?${qs}` } });
    navigate(`/checkout?${qs}`);
  };

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-semibold sm:text-3xl">{listing.title}</h1>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Stars value={listing.rating} />
          <span className="text-gray-500">
            · {listing.reviewCount} reviews · {areaLine(listing)}
          </span>
        </div>
        <button
          onClick={() =>
            user ? toggleFavorite(listing.id) : navigate("/login")
          }
          className="btn-ghost underline"
        >
          {liked ? "♥ Saved" : "♡ Save"}
        </button>
      </div>

      {/* Gallery */}
      <div className="relative mt-6 grid gap-2 overflow-hidden rounded-2xl md:h-[420px] md:grid-cols-4 md:grid-rows-2">
        {listing.images.slice(0, 5).map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${listing.title} ${i + 1}`}
            className={`h-full w-full cursor-pointer object-cover transition hover:brightness-90 ${
              i === 0
                ? "h-64 md:col-span-2 md:row-span-2 md:h-full"
                : "hidden md:block"
            }`}
            onClick={() => setGallery(true)}
          />
        ))}
        <button
          onClick={() => setGallery(true)}
          className="absolute bottom-4 right-4 rounded-lg border border-gray-900 bg-white px-4 py-2 text-sm font-semibold"
        >
          Show all photos
        </button>
      </div>

      <Modal open={gallery} onClose={() => setGallery(false)} title="Photos">
        <div className="space-y-3">
          {listing.images.map((src) => (
            <img key={src} src={src} alt="" className="w-full rounded-xl" />
          ))}
        </div>
      </Modal>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
        {/* Details */}
        <div>
          <div className="flex items-center justify-between border-b border-gray-200 pb-6">
            <div>
              <h2 className="text-xl font-semibold">
                {listing.propertyType} hosted by {listing.host?.name}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {listing.maxGuests} guests · {listing.bedrooms} bedrooms ·{" "}
                {listing.beds} beds · {listing.baths} baths
              </p>
            </div>
            <img
              src={listing.host?.avatar}
              alt={listing.host?.name}
              className="h-14 w-14 rounded-full object-cover"
            />
          </div>

          <p className="border-b border-gray-200 py-6 leading-relaxed text-gray-700">
            {listing.description}
          </p>

          <div className="border-b border-gray-200 py-6">
            <h3 className="mb-4 text-xl font-semibold">
              What this place offers
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {listing.amenities.map((a) => (
                <li key={a} className="flex items-center gap-3 text-gray-700">
                  <span className="text-brand-500">✓</span> {a}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-b border-gray-200 py-6">
            <h3 className="mb-3 text-xl font-semibold">Meet your host</h3>
            <div className="flex items-center gap-4">
              <img
                src={listing.host?.avatar}
                alt=""
                className="h-16 w-16 rounded-full object-cover"
              />
              <div>
                <p className="font-semibold">{listing.host?.name}</p>
                <p className="text-sm text-gray-500">
                  Hosting since{" "}
                  {fmtDate(listing.host?.createdAt, {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
            {listing.host?.bio && (
              <p className="mt-3 text-sm text-gray-700">{listing.host.bio}</p>
            )}
          </div>

          <div className="border-b border-gray-200 py-6">
            <h3 className="mb-4 text-xl font-semibold">Where you'll be</h3>
            <p className="font-medium">{fullAddress(listing)}</p>
          </div>

          <div className="border-b border-gray-200 py-6">
            <h3 className="mb-4 text-xl font-semibold">House rules</h3>
            <p className="text-sm text-gray-700">
              Check-in after <b>{fmtTime(listing.checkInTime)}</b> · Checkout
              before <b>{fmtTime(listing.checkOutTime)}</b> · Max{" "}
              {listing.maxGuests} guests
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {listing.houseRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <h4 className="mb-1 mt-5 font-semibold">
              Cancellation policy · {policy.label}
            </h4>
            <p className="text-sm text-gray-700">{policy.desc}</p>
          </div>

          {/* Reviews */}
          <div className="py-6">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <Stars value={listing.rating} size="text-xl" /> ·{" "}
              {listing.reviews.length} reviews
            </h3>
            {listing.reviews.length === 0 && (
              <p className="text-sm text-gray-500">No reviews yet.</p>
            )}
            <div className="grid gap-6 sm:grid-cols-2">
              {listing.reviews.map((r) => (
                <div key={r.id}>
                  <div className="flex items-center gap-3">
                    <img
                      src={r.guest?.avatar}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-sm font-semibold">{r.guest?.name}</p>
                      <p className="text-xs text-gray-500">
                        {fmtDate(r.createdAt, {
                          month: "long",
                          year: "numeric",
                        })}{" "}
                        · {"★".repeat(r.rating)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{r.comment}</p>
                </div>
              ))}
            </div>

            {eligibility?.eligible && (
              <div className="mt-8">
                <ReviewForm
                  listingId={listing.id}
                  userId={user.id}
                  onDone={() => {
                    reload();
                    reloadEligibility();
                  }}
                />
              </div>
            )}
            {user &&
              eligibility &&
              !eligibility.eligible &&
              user.id !== listing.hostId && (
                <p className="mt-6 text-sm text-gray-500">
                  {eligibility.reason === "already"
                    ? "Thanks — you already reviewed this stay."
                    : "Only guests who have completed a stay here can leave a review."}
                </p>
              )}
          </div>
        </div>

        {/* Booking widget */}
        <aside>
          <div className="sticky top-28 rounded-2xl border border-gray-200 p-6 shadow-card">
            <p className="text-2xl font-semibold">
              {money(listing.pricePerNight)}{" "}
              <span className="text-base font-normal text-gray-600">night</span>
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-400">
              <div className="grid grid-cols-2 divide-x divide-gray-400">
                <label className="p-3">
                  <span className="block text-[10px] font-bold uppercase">
                    Check-in
                  </span>
                  <input
                    type="date"
                    min={todayISO()}
                    value={checkIn}
                    onChange={(e) => {
                      setCheckIn(e.target.value);
                      if (checkOut && checkOut <= e.target.value)
                        setCheckOut("");
                    }}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </label>
                <label className="p-3">
                  <span className="block text-[10px] font-bold uppercase">
                    Checkout
                  </span>
                  <input
                    type="date"
                    min={checkIn ? addDaysISO(checkIn, 1) : todayISO()}
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </label>
              </div>
              <label className="block border-t border-gray-400 p-3">
                <span className="block text-[10px] font-bold uppercase">
                  Guests
                </span>
                <select
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className="w-full bg-transparent text-sm outline-none"
                >
                  {Array.from(
                    { length: listing.maxGuests },
                    (_, i) => i + 1,
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n} guest{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {(blocked || []).length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Unavailable:{" "}
                {blocked
                  .map(
                    (r) =>
                      `${fmtDate(r.checkIn, { month: "short", day: "numeric" })}–${fmtDate(r.checkOut, { month: "short", day: "numeric" })}`,
                  )
                  .join(", ")}
              </p>
            )}

            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            {overlaps && !error && (
              <p className="mt-3 text-sm text-red-600">
                Those dates are not available.
              </p>
            )}

            <button
              onClick={reserve}
              className="btn-primary mt-4 w-full"
              disabled={overlaps}
            >
              {listing.instantBook ? "Reserve" : "Request to book"}
            </button>
            <p className="mt-2 text-center text-xs text-gray-500">
              {listing.instantBook
                ? "You won't be charged yet"
                : "The host must accept your request. Refunded in full if declined."}
            </p>

            {pricing && (
              <div className="mt-5 space-y-2 text-sm">
                <Row
                  label={`${money(listing.pricePerNight)} × ${nights} night${nights > 1 ? "s" : ""}`}
                  value={money(pricing.subtotal)}
                />
                <Row label="Cleaning fee" value={money(pricing.cleaningFee)} />
                <Row
                  label="Staybnb service fee"
                  value={money(pricing.serviceFee)}
                />
                <div className="border-t border-gray-200 pt-3">
                  <Row
                    label="Total before taxes"
                    value={money(pricing.total)}
                    bold
                  />
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div
      className={`flex justify-between ${bold ? "font-semibold" : "text-gray-700"}`}
    >
      <span className={bold ? "" : "underline decoration-gray-300"}>
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}
