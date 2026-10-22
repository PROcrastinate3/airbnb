// ============================================================================
// paymentService.js — STRIPE INTEGRATION POINT
//
// Today: simulates a Stripe payment so the full checkout flow can be tested.
// Test cards:   4242 4242 4242 4242 -> succeeds
//               4000 0000 0000 0002 -> declined
//
// Going live with Stripe (recommended flow):
//  1. Backend (Cloud Function / Express): POST /create-payment-intent
//        const intent = await stripe.paymentIntents.create({ amount: Math.round(total*100), currency:'usd',
//                          metadata:{ bookingId } });  return { clientSecret: intent.client_secret };
//  2. Replace createPaymentIntent() below with a fetch() to that endpoint.
//  3. In pages/guest/Checkout.jsx swap the mock card inputs for Stripe's <PaymentElement/>
//        (npm i @stripe/stripe-js @stripe/react-stripe-js) and call stripe.confirmPayment().
//  4. Add a Stripe webhook (payment_intent.succeeded) that writes the /payments doc and flips
//     the booking to 'confirmed'. Then confirmPayment() below becomes unnecessary on the client.
// ============================================================================
import { getDb, save, delay, genId, clone } from "./db.js";
import { pushNotification } from "./notificationService.js";

export async function createPaymentIntent(bookingId) {
  await delay(300);
  const booking = getDb().bookings.find((b) => b.id === bookingId);
  if (!booking) throw new Error("Booking not found.");
  return {
    clientSecret: `pi_mock_${bookingId}_secret_${Math.random().toString(36).slice(2, 8)}`,
    amount: booking.total,
    currency: "USD",
  };
}

function detectBrand(num) {
  if (/^4/.test(num)) return "Visa";
  if (/^5[1-5]/.test(num)) return "Mastercard";
  if (/^3[47]/.test(num)) return "Amex";
  return "Card";
}

export function validateCard({ number, expiry, cvc, name }) {
  const digits = (number || "").replace(/\s+/g, "");
  if (!name?.trim()) return "Enter the name on the card.";
  if (!/^\d{13,19}$/.test(digits)) return "Enter a valid card number.";
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry || "");
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12)
    return "Enter a valid expiry (MM/YY).";
  const exp = new Date(2000 + Number(m[2]), Number(m[1]), 0, 23, 59);
  if (exp < new Date()) return "This card has expired.";
  if (!/^\d{3,4}$/.test(cvc || "")) return "Enter a valid CVC.";
  return null;
}

export async function confirmPayment({ bookingId, card }) {
  await delay(900);
  const db = getDb();
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new Error("Booking not found.");
  const err = validateCard(card);
  if (err) throw new Error(err);
  const digits = card.number.replace(/\s+/g, "");
  if (digits === "4000000000000002") throw new Error("Your card was declined.");

  const payment = {
    id: genId("p"),
    bookingId,
    guestId: booking.guestId,
    hostId: booking.hostId,
    amount: booking.total,
    currency: "USD",
    status: "succeeded",
    method: "card",
    last4: digits.slice(-4),
    brand: detectBrand(digits),
    stripePaymentIntentId: genId("pi_mock"),
    createdAt: new Date().toISOString(),
  };
  db.payments.unshift(payment);
  booking.paymentId = payment.id;
  // Instant-book listings are confirmed right away; otherwise the host must accept the request first.
  const listing = db.listings.find((l) => l.id === booking.listingId);
  const instant = listing?.instantBook !== false;
  booking.status = instant ? "confirmed" : "pending";
  const guestName =
    db.users.find((u) => u.id === booking.guestId)?.name || "A guest";
  const title = listing?.title || "your stay";
  pushNotification(
    booking.guestId,
    instant
      ? {
          type: "booking",
          title: "Booking confirmed",
          message: `Your stay at ${title} is confirmed for ${booking.checkIn}.`,
          link: `/booking/${booking.id}/confirmation`,
        }
      : {
          type: "booking",
          title: "Request sent",
          message: `Your request for ${title} was sent. You will be notified when the host responds.`,
          link: `/booking/${booking.id}/confirmation`,
        },
  );
  pushNotification(
    booking.hostId,
    instant
      ? {
          type: "booking",
          title: "New booking",
          message: `${guestName} booked ${title} for ${booking.checkIn} – ${booking.checkOut}.`,
          link: "/host/reservations",
        }
      : {
          type: "booking",
          title: "New booking request",
          message: `${guestName} wants to book ${title} for ${booking.checkIn} – ${booking.checkOut}. Accept or decline.`,
          link: "/host/reservations",
        },
  );
  save();
  return { payment: clone(payment), booking: clone(booking) };
}

export async function getPaymentsForUser(userId) {
  await delay();
  return clone(getDb().payments.filter((p) => p.guestId === userId));
}
