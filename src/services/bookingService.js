// FIREBASE: Firestore collection 'bookings'
//   createBooking -> addDoc(collection(db,'bookings'), {...})   (do this in a Cloud Function
//                    in production so prices are computed server-side, not trusted from the client)
//   queries       -> query(collection(db,'bookings'), where('guestId','==',uid))
//   updateBookingStatus -> Cloud Function that re-checks who is allowed to make each change
import { getDb, save, delay, genId, clone } from "./db.js";
import { getServiceFeeRate } from "./settingsService.js";
import { pushNotification } from "./notificationService.js";
import {
  ACTIVE_STATUSES,
  blockedToRanges,
  isRangeFree,
  refundFor,
  todayStr,
  unavailableRanges,
  withListingDefaults,
} from "./rules.js";

export { CANCELLATION_POLICIES, refundFor } from "./rules.js";

export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(
    0,
    Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000),
  );
}

// nightly rate x nights + cleaning fee + service fee (rate is set by the admin in Settings)
export function calculatePricing(listing, nights) {
  const subtotal = listing.pricePerNight * nights;
  const cleaningFee = nights > 0 ? listing.cleaningFee || 0 : 0;
  const serviceFee = Number((subtotal * getServiceFeeRate()).toFixed(2));
  const total = Number((subtotal + cleaningFee + serviceFee).toFixed(2));
  return { subtotal, cleaningFee, serviceFee, total };
}

// Booked ranges + dates the host blocked manually. Used by the booking widget and search.
export async function getUnavailableRanges(listingId) {
  await delay(80);
  return unavailableRanges(getDb(), listingId);
}

export async function isAvailable(listingId, checkIn, checkOut) {
  await delay(40);
  return isRangeFree(getDb(), listingId, checkIn, checkOut);
}

const enrich = (b) => {
  const db = getDb();
  const listing = db.listings.find((l) => l.id === b.listingId);
  const guest = db.users.find((u) => u.id === b.guestId);
  const host = db.users.find((u) => u.id === b.hostId);
  const payment = db.payments.find((p) => p.id === b.paymentId);
  return {
    ...b,
    listing: listing
      ? {
          id: listing.id,
          title: listing.title,
          location: listing.location,
          images: listing.images,
          street: listing.street,
          neighborhood: listing.neighborhood,
          city: listing.city,
          province: listing.province,
          postalCode: listing.postalCode,
          country: listing.country,
          landmark: listing.landmark,
          ...(({
            houseRules,
            checkInTime,
            checkOutTime,
            cancellationPolicy,
            instantBook,
          }) => ({
            houseRules,
            checkInTime,
            checkOutTime,
            cancellationPolicy,
            instantBook,
          }))(withListingDefaults(listing)),
        }
      : null,
    guest: guest
      ? {
          id: guest.id,
          name: guest.name,
          avatar: guest.avatar,
          email: guest.email,
          phone: guest.phone,
          createdAt: guest.createdAt,
        }
      : null,
    host: host ? { id: host.id, name: host.name } : null,
    payment: payment
      ? {
          status: payment.status,
          method: payment.method,
          brand: payment.brand,
          last4: payment.last4,
        }
      : null,
  };
};

export async function createBooking({
  listingId,
  guestId,
  checkIn,
  checkOut,
  guests,
}) {
  await delay();
  const db = getDb();
  const listing = db.listings.find((l) => l.id === listingId);
  if (!listing || listing.status !== "published")
    throw new Error("This listing is not available for booking.");
  if (listing.hostId === guestId)
    throw new Error("You cannot book your own listing.");
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw new Error("Please choose valid dates.");
  if (checkIn < todayStr()) throw new Error("Check-in cannot be in the past.");
  if (!guests || guests < 1) throw new Error("Add at least one guest.");
  if (guests > listing.maxGuests)
    throw new Error(`This place allows up to ${listing.maxGuests} guests.`);
  // double-booking prevention: re-checked here even though the UI also blocks these dates
  if (!isRangeFree(db, listingId, checkIn, checkOut))
    throw new Error("Those dates are no longer available.");
  const pricing = calculatePricing(listing, nights);
  const booking = {
    id: genId("b"),
    listingId,
    guestId,
    hostId: listing.hostId,
    checkIn,
    checkOut,
    guests,
    nights,
    ...pricing,
    status: "pending_payment",
    createdAt: new Date().toISOString(),
    paymentId: null,
  };
  db.bookings.unshift(booking);
  save();
  return clone(booking);
}

export async function getBooking(id) {
  await delay(100);
  const b = getDb().bookings.find((x) => x.id === id);
  return b ? clone(enrich(b)) : null;
}

export async function getGuestBookings(guestId) {
  await delay();
  return clone(
    getDb()
      .bookings.filter(
        (b) => b.guestId === guestId && b.status !== "pending_payment",
      )
      .map(enrich)
      .sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn)),
  );
}

export async function getHostBookings(hostId) {
  await delay();
  return clone(
    getDb()
      .bookings.filter(
        (b) => b.hostId === hostId && b.status !== "pending_payment",
      )
      .map(enrich)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  );
}

// How much the guest would get back if they cancelled right now (for the confirm dialog).
export async function getCancellationPreview(bookingId) {
  const b = getDb().bookings.find((x) => x.id === bookingId);
  if (!b) throw new Error("Booking not found.");
  const listing = getDb().listings.find((l) => l.id === b.listingId);
  return refundFor(b, withListingDefaults(listing), { byGuest: true });
}

// ----------------------------------------------------------------------------
// Status changes. `actor` = the logged-in user ({ id, role }).
// Who may do what:
//   guest (owner of the booking) -> cancel while pending / confirmed
//   host  (owner of the listing) -> accept a pending request, cancel, mark completed after check-in
//   admin                         -> anything
// ----------------------------------------------------------------------------
export async function updateBookingStatus(id, status, actor) {
  await delay();
  const db = getDb();
  const b = db.bookings.find((x) => x.id === id);
  if (!b) throw new Error("Booking not found.");
  if (!actor) throw new Error("You must be logged in.");

  const isAdmin = actor.role === "admin";
  const isGuest = b.guestId === actor.id;
  const isHost = b.hostId === actor.id;
  if (!isAdmin && !isGuest && !isHost)
    throw new Error("You are not allowed to change this reservation.");

  const from = b.status;
  const can =
    isAdmin ||
    (isGuest &&
      status === "cancelled" &&
      ["pending", "confirmed"].includes(from)) ||
    (isHost &&
      ((status === "confirmed" && from === "pending") ||
        (status === "cancelled" && ["pending", "confirmed"].includes(from)) ||
        (status === "completed" && from === "confirmed")));
  if (!can)
    throw new Error(
      `This reservation cannot be changed from "${from}" to "${status}".`,
    );
  if (status === "completed" && !isAdmin && b.checkIn > todayStr())
    throw new Error("A stay can only be completed after check-in.");

  const listing = db.listings.find((l) => l.id === b.listingId);
  const title = listing?.title || "your stay";
  const guestName = db.users.find((u) => u.id === b.guestId)?.name || "A guest";

  if (status === "cancelled") {
    // cancelling frees the dates automatically (cancelled bookings are not "active"),
    // and the payment is refunded according to the cancellation policy
    const byGuest = isGuest && !isAdmin;
    const refund = refundFor(b, withListingDefaults(listing), { byGuest });
    b.cancelledAt = new Date().toISOString();
    b.cancelledBy = isAdmin ? "admin" : isGuest ? "guest" : "host";
    b.refundAmount = refund.amount;
    const p = db.payments.find((x) => x.id === b.paymentId);
    if (p && p.status === "succeeded" && refund.amount > 0) {
      p.status = refund.amount >= p.amount ? "refunded" : "partially_refunded";
      p.refundAmount = refund.amount;
    }
    if (byGuest) {
      pushNotification(b.hostId, {
        type: "booking",
        title: "Reservation cancelled",
        message: `${guestName} cancelled their stay at ${title}.`,
        link: "/host/reservations",
      });
      pushNotification(b.guestId, {
        type: "booking",
        title: "Cancellation confirmed",
        message: `Your stay at ${title} was cancelled. Refund: $${refund.amount.toFixed(2)}.`,
        link: `/booking/${b.id}/confirmation`,
      });
    } else {
      pushNotification(b.guestId, {
        type: "booking",
        title:
          from === "pending" && isHost
            ? "Request declined"
            : "Reservation cancelled",
        message: `Your stay at ${title} was cancelled by the ${b.cancelledBy}. You are refunded $${refund.amount.toFixed(2)}.`,
        link: `/booking/${b.id}/confirmation`,
      });
      if (isAdmin)
        pushNotification(b.hostId, {
          type: "booking",
          title: "Reservation cancelled by admin",
          message: `${guestName}'s stay at ${title} was cancelled.`,
          link: "/host/reservations",
        });
    }
  } else if (status === "confirmed") {
    pushNotification(b.guestId, {
      type: "booking",
      title: "Request accepted",
      message: `Your host accepted your stay at ${title}. See you on ${b.checkIn}!`,
      link: `/booking/${b.id}/confirmation`,
    });
  } else if (status === "completed") {
    pushNotification(b.guestId, {
      type: "review",
      title: "How was your stay?",
      message: `Your stay at ${title} is complete. Tell others about it with a review.`,
      link: "/trips",
    });
  }

  b.status = status;
  save();
  return clone(enrich(b));
}

// ---- Host availability calendar -------------------------------------------------
export async function getCalendarData(listingId, actor) {
  await delay(120);
  const db = getDb();
  const listing = db.listings.find((l) => l.id === listingId);
  if (!listing) throw new Error("Listing not found.");
  if (listing.hostId !== actor?.id && actor?.role !== "admin")
    throw new Error("Not your listing.");
  const bookings = db.bookings
    .filter(
      (b) =>
        b.listingId === listingId &&
        ACTIVE_STATUSES.includes(b.status) &&
        b.status !== "pending_payment",
    )
    .map((b) => ({
      id: b.id,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      status: b.status,
      guestName: db.users.find((u) => u.id === b.guestId)?.name,
    }));
  return clone({ bookings, blockedDates: listing.blockedDates || [] });
}

export async function setBlockedDates(listingId, dates, block, actor) {
  await delay(120);
  const db = getDb();
  const listing = db.listings.find((l) => l.id === listingId);
  if (!listing) throw new Error("Listing not found.");
  if (listing.hostId !== actor?.id && actor?.role !== "admin")
    throw new Error("Not your listing.");
  const set = new Set(listing.blockedDates || []);
  const booked = db.bookings.filter(
    (b) =>
      b.listingId === listingId && ["pending", "confirmed"].includes(b.status),
  );
  for (const d of dates) {
    if (block) {
      if (d < todayStr()) continue;
      if (booked.some((b) => d >= b.checkIn && d < b.checkOut)) continue; // can't block a reserved night
      set.add(d);
    } else set.delete(d);
  }
  listing.blockedDates = [...set].sort();
  save();
  return clone(listing.blockedDates);
}

export { blockedToRanges };
