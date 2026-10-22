// FIREBASE: host stats are best computed with Firestore aggregation queries
// (count(), sum()) or a scheduled Cloud Function writing /stats docs.
import { getDb, delay, clone } from "./db.js";

export async function getHostStats(hostId) {
  await delay();
  const db = getDb();
  const listings = db.listings.filter((l) => l.hostId === hostId);
  const bookings = db.bookings.filter(
    (b) => b.hostId === hostId && b.status !== "pending_payment",
  );
  const paid = bookings.filter((b) =>
    ["confirmed", "completed"].includes(b.status),
  );
  const earnings = paid.reduce((s, b) => s + b.subtotal + b.cleaningFee, 0);
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = paid
    .filter((b) => b.checkIn.startsWith(month))
    .reduce((s, b) => s + b.subtotal + b.cleaningFee, 0);

  // earnings for the last 6 months
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleString("en", { month: "short" }),
      value: 0,
    };
  });
  paid.forEach((b) => {
    const m = months.find((x) => b.checkIn.startsWith(x.key));
    if (m) m.value += b.subtotal + b.cleaningFee;
  });

  return clone({
    totalListings: listings.length,
    activeListings: listings.filter((l) => l.status === "published").length,
    totalBookings: bookings.length,
    pendingRequests: bookings.filter((b) => b.status === "pending").length,
    upcoming: bookings.filter(
      (b) => b.status === "confirmed" && new Date(b.checkIn) >= new Date(),
    ).length,
    earnings,
    thisMonth,
    months,
    avgRating: listings.length
      ? listings.reduce((s, l) => s + l.rating, 0) / listings.length
      : 0,
  });
}

export async function getHostPayouts(hostId) {
  await delay();
  const db = getDb();
  return clone(
    db.bookings
      .filter(
        (b) =>
          b.hostId === hostId &&
          ["confirmed", "completed", "cancelled"].includes(b.status),
      )
      .map((b) => {
        const guest = db.users.find((u) => u.id === b.guestId);
        const listing = db.listings.find((l) => l.id === b.listingId);
        return {
          bookingId: b.id,
          guest: guest?.name,
          listing: listing?.title,
          checkIn: b.checkIn,
          amount: Number((b.subtotal + b.cleaningFee).toFixed(2)),
          status:
            b.status === "completed"
              ? "paid"
              : b.status === "cancelled"
                ? "refunded"
                : "scheduled",
        };
      }),
  );
}
