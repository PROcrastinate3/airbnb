import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { Spinner, EmptyState } from "../../components/ui.jsx";
import { getListing } from "../../services/listingService.js";
import {
  CANCELLATION_POLICIES,
  calculatePricing,
  createBooking,
  nightsBetween,
} from "../../services/bookingService.js";
import {
  confirmPayment,
  createPaymentIntent,
} from "../../services/paymentService.js";
import { areaLine, fmtDate, money } from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

const formatCard = (v) =>
  v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
const formatExpiry = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const listingId = params.get("listingId");
  const checkIn = params.get("checkIn");
  const checkOut = params.get("checkOut");
  const guests = Number(params.get("guests") || 1);
  const nights = nightsBetween(checkIn, checkOut);

  const { data: listing, loading } = useAsync(
    () => getListing(listingId),
    [listingId],
  );
  const pricing = useMemo(
    () => (listing ? calculatePricing(listing, nights) : null),
    [listing, nights],
  );

  const [card, setCard] = useState({
    name: user?.name || "",
    number: "",
    expiry: "",
    cvc: "",
  });
  const [method, setMethod] = useState("card");
  const [bookingId, setBookingId] = useState(null); // reused if the first payment attempt fails
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (loading) return <Spinner className="min-h-[60vh] items-center" />;
  if (!listing || nights < 1)
    return (
      <div className="container-page py-20">
        <EmptyState
          title="Something's missing from your reservation"
          text="Pick your dates again to continue."
          action={
            <Link to="/search" className="btn-primary">
              Browse stays
            </Link>
          }
        />
      </div>
    );

  const pay = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // 1. Create the booking (status: pending_payment)
      let id = bookingId;
      if (!id) {
        const booking = await createBooking({
          listingId,
          guestId: user.id,
          checkIn,
          checkOut,
          guests,
        });
        id = booking.id;
        setBookingId(id);
      }
      // 2. Ask the backend for a Stripe PaymentIntent  (STRIPE: replace with real endpoint)
      if (!clientSecret) {
        const intent = await createPaymentIntent(id);
        setClientSecret(intent.clientSecret);
      }
      // 3. Confirm payment (STRIPE: stripe.confirmPayment({ elements, clientSecret, ... }))
      await confirmPayment({ bookingId: id, card });
      navigate(`/booking/${id}/confirmation`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const set =
    (k, fmt = (v) => v) =>
    (e) =>
      setCard({ ...card, [k]: fmt(e.target.value) });

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-full p-2 text-lg hover:bg-gray-100"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="text-2xl font-semibold sm:text-3xl">Confirm and pay</h1>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_420px]">
        <form onSubmit={pay} className="space-y-8">
          <section>
            <h2 className="mb-3 text-xl font-semibold">Your trip</h2>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Dates:</span>{" "}
                {fmtDate(checkIn, { month: "short", day: "numeric" })} –{" "}
                {fmtDate(checkOut)} ({nights} night{nights > 1 ? "s" : ""})
              </p>
              <p>
                <span className="font-medium">Guests:</span> {guests} guest
                {guests > 1 ? "s" : ""}
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Pay with</h2>
            <div className="mb-4 flex gap-3">
              {[
                { id: "card", label: "Credit or debit card" },
                { id: "wallet", label: " Digital wallet" },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium ${method === m.id ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-300"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {method === "card" ? (
              <div className="space-y-4 rounded-xl border border-gray-200 p-5">
                {/* STRIPE: replace this block with <PaymentElement /> from @stripe/react-stripe-js */}
                <div>
                  <label className="label" htmlFor="cardName">
                    Name on card
                  </label>
                  <input
                    id="cardName"
                    className="input"
                    autoComplete="cc-name"
                    value={card.name}
                    onChange={set("name")}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="cardNumber">
                    Card number
                  </label>
                  <input
                    id="cardNumber"
                    className="input"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="4242 4242 4242 4242"
                    value={card.number}
                    onChange={set("number", formatCard)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="exp">
                      Expiry
                    </label>
                    <input
                      id="exp"
                      className="input"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM/YY"
                      value={card.expiry}
                      onChange={set("expiry", formatExpiry)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="cvc">
                      CVC
                    </label>
                    <input
                      id="cvc"
                      className="input"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="123"
                      maxLength={4}
                      value={card.cvc}
                      onChange={set("cvc", (v) => v.replace(/\D/g, ""))}
                      required
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 p-5 text-sm text-gray-600">
                Apple Pay / Google Pay will appear here via Stripe's Payment
                Request / Express Checkout Element. Use card for now.
              </div>
            )}
          </section>

          <section className="text-xs text-gray-500">
            By selecting the button below, I agree to the house rules,
            cancellation policy, and that Staybnb can charge my payment method.
          </section>

          {error && (
            <p
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            className="btn-primary w-full sm:w-auto sm:px-12"
            disabled={busy || method !== "card"}
          >
            {busy
              ? "Processing payment…"
              : `${listing.instantBook ? "Confirm and pay" : "Request to book ·"} ${money(pricing.total)}`}
          </button>
          <p className="text-xs text-gray-500">
            Payments are secured by Stripe.
          </p>
        </form>

        {/* Summary */}
        <aside>
          <div className="sticky top-28 rounded-2xl border border-gray-200 p-6 shadow-card">
            <div className="flex gap-4 border-b border-gray-200 pb-5">
              <img
                src={listing.images[0]}
                alt=""
                className="h-24 w-28 rounded-xl object-cover"
              />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{listing.propertyType}</p>
                <p className="font-medium leading-snug">{listing.title}</p>
                <p className="mt-1 text-xs text-gray-500">
                  📍 {areaLine(listing)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  ★ {listing.rating.toFixed(2)} ({listing.reviewCount})
                </p>
              </div>
            </div>
            <p className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              {listing.instantBook
                ? "Instant booking: confirmed as soon as payment succeeds."
                : "Request to book: your host has to accept before the stay is confirmed. You get a full refund if declined."}
              <br />
              <b>
                {
                  (
                    CANCELLATION_POLICIES[listing.cancellationPolicy] ||
                    CANCELLATION_POLICIES.moderate
                  ).label
                }{" "}
                cancellation:
              </b>{" "}
              {
                (
                  CANCELLATION_POLICIES[listing.cancellationPolicy] ||
                  CANCELLATION_POLICIES.moderate
                ).desc
              }
            </p>
            <h3 className="mt-5 text-lg font-semibold">Price details</h3>
            <div className="mt-3 space-y-2 text-sm">
              <Row
                label={`${money(listing.pricePerNight)} × ${nights} nights`}
                value={money(pricing.subtotal)}
              />
              <Row label="Cleaning fee" value={money(pricing.cleaningFee)} />
              <Row
                label="Staybnb service fee"
                value={money(pricing.serviceFee)}
              />
              <div className="border-t border-gray-200 pt-3">
                <Row label="Total (PHP)" value={money(pricing.total)} bold />
              </div>
            </div>
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
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
