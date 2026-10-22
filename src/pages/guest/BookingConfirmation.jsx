import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { EmptyState, Spinner, StatusBadge } from "../../components/ui.jsx";
import {
  CANCELLATION_POLICIES,
  getBooking,
} from "../../services/bookingService.js";
import {
  areaLine,
  fmtDate,
  fmtTime,
  fullAddress,
  money,
} from "../../utils/format.js";
import { useAsync } from "../../hooks/useAsync.js";

const HEADINGS = {
  confirmed: [
    "✓",
    "bg-green-100 text-green-600",
    "Your booking is confirmed!",
    "A confirmation has been sent to",
  ],
  pending: [
    "⏳",
    "bg-amber-100 text-amber-600",
    "Request sent — waiting for your host",
    "We will notify you at",
  ],
  completed: [
    "✓",
    "bg-gray-100 text-gray-600",
    "Stay completed",
    "Your receipt was sent to",
  ],
  cancelled: [
    "✕",
    "bg-red-100 text-red-600",
    "This reservation was cancelled",
    "Details were sent to",
  ],
};

export default function BookingConfirmation() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: booking, loading } = useAsync(() => getBooking(id), [id]);

  if (loading) return <Spinner className="min-h-[60vh] items-center" />;
  if (!booking || booking.guestId !== user.id)
    return (
      <div className="container-page py-20">
        <EmptyState
          title="Booking not found"
          action={
            <Link to="/trips" className="btn-primary">
              Go to trips
            </Link>
          }
        />
      </div>
    );

  const [icon, tone, title, sub] =
    HEADINGS[booking.status] || HEADINGS.confirmed;
  const l = booking.listing;
  const policy =
    CANCELLATION_POLICIES[l?.cancellationPolicy] ||
    CANCELLATION_POLICIES.moderate;

  return (
    <div className="container-page max-w-2xl py-14">
      <div className="text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${tone}`}
        >
          {icon}
        </div>
        <h1 className="mt-5 text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-gray-600">
          {sub} {user.email}.
        </p>
      </div>

      <div className="card mt-10 space-y-4">
        <div className="flex gap-4">
          <img
            src={l?.images?.[0]}
            alt=""
            className="h-24 w-28 rounded-xl object-cover"
          />
          <div>
            <p className="font-semibold">{l?.title}</p>
            <p className="text-sm text-gray-500">{areaLine(l)}</p>
            <div className="mt-2 flex gap-2">
              <StatusBadge status={booking.status} />
              {booking.payment && (
                <StatusBadge status={booking.payment.status} />
              )}
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4 text-sm">
          <div>
            <dt className="text-gray-500">Check-in</dt>
            <dd className="font-medium">
              {fmtDate(booking.checkIn)} · {fmtTime(l?.checkInTime)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Checkout</dt>
            <dd className="font-medium">
              {fmtDate(booking.checkOut)} · {fmtTime(l?.checkOutTime)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Guests</dt>
            <dd className="font-medium">{booking.guests}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Booking code</dt>
            <dd className="font-mono font-medium uppercase">
              {booking.id.replace("b_", "")}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Hosted by</dt>
            <dd className="font-medium">{booking.host?.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Payment</dt>
            <dd className="font-medium">
              {money(booking.total)}
              {booking.payment && (
                <span className="font-normal text-gray-500">
                  {" "}
                  · {booking.payment.brand} •••• {booking.payment.last4}
                </span>
              )}
            </dd>
          </div>
          {booking.status === "cancelled" && (
            <div className="col-span-2">
              <dt className="text-gray-500">Refund</dt>
              <dd className="font-medium">
                {money(booking.refundAmount || 0)}
                {booking.cancelledBy
                  ? ` · cancelled by ${booking.cancelledBy}`
                  : ""}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="card mt-6">
        <h2 className="mb-3 font-semibold">Where you're staying</h2>
        <p className="font-medium">{fullAddress(l)}</p>
      </div>

      <div className="card mt-6 space-y-3 text-sm">
        <h2 className="font-semibold">House rules</h2>
        <ul className="list-disc space-y-1 pl-5 text-gray-700">
          {(l?.houseRules || []).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="border-t border-gray-100 pt-3">
          <b>{policy.label} cancellation.</b>{" "}
          <span className="text-gray-600">{policy.desc}</span>
        </p>
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link to="/trips" className="btn-primary">
          View my trips
        </Link>
        <Link to="/" className="btn-outline">
          Keep exploring
        </Link>
      </div>
    </div>
  );
}
