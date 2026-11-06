import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";

const assertHost = (hostId) => {
  if (!auth.currentUser || auth.currentUser.uid !== hostId)
    throw new Error("You must be logged in as this host.");
};

const getHostData = async (hostId) => {
  assertHost(hostId);
  const [listingsSnap, bookingsSnap] = await Promise.all([
    getDocs(query(collection(db, "listings"), where("hostId", "==", hostId))),
    getDocs(query(collection(db, "bookings"), where("hostId", "==", hostId))),
  ]);
  return {
    listings: listingsSnap.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    })),
    bookings: bookingsSnap.docs
      .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
      .filter((booking) => booking.status !== "pending_payment"),
  };
};

export async function getHostStats(hostId) {
  const { listings, bookings } = await getHostData(hostId);
  const paid = bookings.filter((booking) =>
    ["confirmed", "completed"].includes(booking.status),
  );
  const amountEarned = (booking) =>
    (booking.subtotal || 0) + (booking.cleaningFee || 0);
  const earnings = paid.reduce((sum, booking) => sum + amountEarned(booking), 0);
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = paid
    .filter((booking) => booking.checkIn?.startsWith(month))
    .reduce((sum, booking) => sum + amountEarned(booking), 0);

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleString("en", { month: "short" }),
      value: 0,
    };
  });
  paid.forEach((booking) => {
    const monthEntry = months.find((entry) =>
      booking.checkIn?.startsWith(entry.key),
    );
    if (monthEntry) monthEntry.value += amountEarned(booking);
  });

  return {
    totalListings: listings.length,
    activeListings: listings.filter((listing) => listing.status === "published")
      .length,
    totalBookings: bookings.length,
    pendingRequests: bookings.filter((booking) => booking.status === "pending")
      .length,
    upcoming: bookings.filter(
      (booking) =>
        booking.status === "confirmed" &&
        new Date(booking.checkIn) >= new Date(),
    ).length,
    earnings,
    thisMonth,
    months,
    avgRating: listings.length
      ? listings.reduce((sum, listing) => sum + (listing.rating || 0), 0) /
        listings.length
      : 0,
  };
}

export async function getHostPayouts(hostId) {
  const { bookings } = await getHostData(hostId);
  const listingIds = [
    ...new Set(bookings.map((booking) => booking.listingId).filter(Boolean)),
  ];
  const listingsById = new Map(
    await Promise.all(
      listingIds.map(async (listingId) => {
        const snapshot = await getDoc(doc(db, "listings", listingId));
        return [
          listingId,
          snapshot.exists() ? snapshot.data() : null,
        ];
      }),
    ),
  );

  return Promise.all(
    bookings
      .filter((booking) =>
        ["confirmed", "completed", "cancelled"].includes(booking.status),
      )
      .map(async (booking) => {
        let guestName = booking.guestSnapshot?.name ?? booking.guestName;
        if (!guestName && booking.guestId) {
          const guestSnapshot = await getDoc(
            doc(db, "publicProfiles", booking.guestId),
          );
          if (guestSnapshot.exists()) guestName = guestSnapshot.data().name;
        }

        const listing =
          booking.listingSnapshot ?? listingsById.get(booking.listingId);
        return {
          bookingId: booking.id,
          guest: guestName,
          listing: listing?.title,
          checkIn: booking.checkIn,
          amount: Number(
            ((booking.subtotal || 0) + (booking.cleaningFee || 0)).toFixed(2),
          ),
          status:
            booking.status === "completed"
              ? "paid"
              : booking.status === "cancelled"
                ? "refunded"
                : "scheduled",
        };
      }),
  );
}
