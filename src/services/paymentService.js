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
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";

export async function createPaymentIntent(bookingId) {
  const bookingSnap = await getDoc(doc(db, "bookings", bookingId));
  if (!bookingSnap.exists()) throw new Error("Booking not found.");
  const booking = bookingSnap.data();
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
  const err = validateCard(card);
  if (err) throw new Error(err);
  const digits = card.number.replace(/\s+/g, "");
  if (digits === "4000000000000002") throw new Error("Your card was declined.");
  if (!auth.currentUser) throw new Error("You must be logged in.");

  const bookingRef = doc(db, "bookings", bookingId);
  const paymentRef = doc(collection(db, "payments"));
  return runTransaction(db, async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists()) throw new Error("Booking not found.");
    const booking = { id: bookingSnap.id, ...bookingSnap.data() };
    if (booking.guestId !== auth.currentUser.uid)
      throw new Error("You are not allowed to pay for this reservation.");
    if (booking.status !== "pending_payment")
      throw new Error("This reservation is no longer awaiting payment.");
    const listingRef = doc(db, "listings", booking.listingId);
    const listingSnap = booking.listingSnapshot
      ? null
      : await transaction.get(listingRef);

    const listing =
      booking.listingSnapshot ||
      (listingSnap?.exists() ? listingSnap.data() : null);
    const instant = listing?.instantBook !== false;
    const payment = {
      id: paymentRef.id,
      bookingId,
      guestId: booking.guestId,
      hostId: booking.hostId,
      amount: booking.total,
      currency: "USD",
      status: "succeeded",
      method: "card",
      last4: digits.slice(-4),
      brand: detectBrand(digits),
      stripePaymentIntentId: `pi_mock_${bookingId}`,
      createdAt: new Date().toISOString(),
    };
    const updatedBooking = {
      ...booking,
      paymentId: payment.id,
      status: instant ? "confirmed" : "pending",
    };
    transaction.set(paymentRef, payment);
    transaction.update(bookingRef, {
      paymentId: payment.id,
      status: updatedBooking.status,
    });
    return { payment, booking: updatedBooking };
  });
}

export async function getPaymentsForUser(userId) {
  const snapshot = await getDocs(
    query(collection(db, "payments"), where("guestId", "==", userId)),
  );
  return snapshot.docs.map((paymentSnap) => ({
    id: paymentSnap.id,
    ...paymentSnap.data(),
  }));
}
