// Booking data is stored in Firestore. Public availability uses date-only lock documents
// so guests never need access to other guests' booking documents.
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
import { getServiceFeeRate } from "./settingsService.js";
import {
  ACTIVE_STATUSES,
  addDays,
  blockedToRanges,
  rangesOverlap,
  refundFor,
  todayStr,
  withListingDefaults,
} from "./rules.js";

export { CANCELLATION_POLICIES, refundFor } from "./rules.js";

const asISO = (value) =>
  value?.toDate ? value.toDate().toISOString() : value;

const normalizeBooking = (booking) => ({
  ...booking,
  createdAt: asISO(booking.createdAt),
  cancelledAt: asISO(booking.cancelledAt),
});

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
  const [listingSnap, lockSnapshot] = await Promise.all([
    getDoc(doc(db, "listings", listingId)),
    getDocs(collection(db, "listings", listingId, "availability")),
  ]);
  if (!listingSnap.exists()) throw new Error("Listing not found.");
  const bookedRanges = lockSnapshot.docs.map((lock) => {
    const date = lock.data().date || lock.id;
    return { checkIn: date, checkOut: addDays(date, 1) };
  });
  return [
    ...bookedRanges,
    ...blockedToRanges(listingSnap.data().blockedDates),
  ];
}

export async function isAvailable(listingId, checkIn, checkOut) {
  const ranges = await getUnavailableRanges(listingId);
  return !ranges.some((range) =>
    rangesOverlap(checkIn, checkOut, range.checkIn, range.checkOut),
  );
}

const enrich = async (booking) => {
  const b = normalizeBooking(booking);
  const [listingSnap, paymentSnap] = await Promise.all([
    b.listingSnapshot || !b.listingId
      ? null
      : getDoc(doc(db, "listings", b.listingId)),
    b.paymentId ? getDoc(doc(db, "payments", b.paymentId)) : null,
  ]);
  const listing =
    b.listingSnapshot ??
    (listingSnap?.exists()
      ? { id: listingSnap.id, ...listingSnap.data() }
      : null);
  const guest =
    b.guestSnapshot ??
    (b.guestName
      ? {
          id: b.guestId,
          name: b.guestName,
          avatar: b.guestAvatar,
          email: b.guestEmail,
          phone: b.guestPhone,
          createdAt: asISO(b.guestCreatedAt),
        }
      : null);
  const host =
    b.hostSnapshot ??
    (b.hostName ? { id: b.hostId, name: b.hostName } : null);
  const payment = paymentSnap?.exists() ? paymentSnap.data() : null;
  return {
    ...b,
    listing: listing
      ? {
          id: listing.id || b.listingId,
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
          id: guest.id || b.guestId,
          name: guest.name,
          avatar: guest.avatar,
          email: guest.email,
          phone: guest.phone,
          createdAt: guest.createdAt ? asISO(guest.createdAt) : null,
        }
      : null,
    host: host ? { id: host.id || b.hostId, name: host.name } : null,
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
  if (!auth.currentUser || auth.currentUser.uid !== guestId)
    throw new Error("You must be logged in to book this stay.");
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw new Error("Please choose valid dates.");
  if (checkIn < todayStr()) throw new Error("Check-in cannot be in the past.");
  if (!Number.isInteger(guests) || guests < 1)
    throw new Error("Add at least one guest.");

  const listingRef = doc(db, "listings", listingId);
  const bookingRef = doc(collection(db, "bookings"));
  const dates = Array.from({ length: nights }, (_, index) =>
    addDays(checkIn, index),
  );
  const lockRefs = dates.map((date) =>
    doc(db, "listings", listingId, "availability", date),
  );
  const guestSnap = await getDoc(doc(db, "users", guestId));
  const guest = guestSnap.exists() ? guestSnap.data() : {};

  return runTransaction(db, async (transaction) => {
    const [listingSnap, ...lockSnaps] = await Promise.all([
      transaction.get(listingRef),
      ...lockRefs.map((ref) => transaction.get(ref)),
    ]);
    if (!listingSnap.exists() || listingSnap.data().status !== "published")
      throw new Error("This listing is not available for booking.");
    const listing = withListingDefaults({
      id: listingSnap.id,
      ...listingSnap.data(),
    });
    if (listing.hostId === guestId)
      throw new Error("You cannot book your own listing.");
    if (!Number.isFinite(listing.maxGuests) || guests > listing.maxGuests)
      throw new Error(`This place allows up to ${listing.maxGuests} guests.`);
    if (dates.some((date) => listing.blockedDates.includes(date)))
      throw new Error("Those dates are no longer available.");
    if (lockSnaps.some((lock) => lock.exists()))
      throw new Error("Those dates are no longer available.");

    const booking = {
      listingId,
      guestId,
      hostId: listing.hostId,
      checkIn,
      checkOut,
      guests,
      nights,
      ...calculatePricing(listing, nights),
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      paymentId: null,
      listingSnapshot: listing,
      guestSnapshot: {
        id: guestId,
        name: guest.name || auth.currentUser.displayName || "",
        avatar: guest.avatar || auth.currentUser.photoURL || "",
        email: guest.email || auth.currentUser.email || "",
        phone: guest.phone || "",
        createdAt: guest.createdAt ? asISO(guest.createdAt) : null,
      },
      hostSnapshot: listing.hostSnapshot || null,
    };
    transaction.set(bookingRef, booking);
    lockRefs.forEach((ref, index) =>
      transaction.set(ref, {
        listingId,
        date: dates[index],
        bookingId: bookingRef.id,
      }),
    );
    return { id: bookingRef.id, ...booking };
  });
}

export async function getBooking(id) {
  const bookingSnap = await getDoc(doc(db, "bookings", id));
  return bookingSnap.exists()
    ? enrich({ id: bookingSnap.id, ...bookingSnap.data() })
    : null;
}

export async function getGuestBookings(guestId) {
  const snapshot = await getDocs(
    query(collection(db, "bookings"), where("guestId", "==", guestId)),
  );
  const bookings = snapshot.docs
    .map((bookingSnap) => ({ id: bookingSnap.id, ...bookingSnap.data() }))
    .filter((booking) => booking.status !== "pending_payment");
  const enriched = await Promise.all(bookings.map(enrich));
  return enriched.sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn));
}

export async function getHostBookings(hostId) {
  const snapshot = await getDocs(
    query(collection(db, "bookings"), where("hostId", "==", hostId)),
  );
  const bookings = snapshot.docs
    .map((bookingSnap) => ({ id: bookingSnap.id, ...bookingSnap.data() }))
    .filter((booking) => booking.status !== "pending_payment");
  const enriched = await Promise.all(bookings.map(enrich));
  return enriched.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
}

// How much the guest would get back if they cancelled right now (for the confirm dialog).
export async function getCancellationPreview(bookingId) {
  const bookingSnap = await getDoc(doc(db, "bookings", bookingId));
  if (!bookingSnap.exists()) throw new Error("Booking not found.");
  const b = { id: bookingSnap.id, ...bookingSnap.data() };
  const listingSnap = b.listingSnapshot
    ? null
    : await getDoc(doc(db, "listings", b.listingId));
  const listing =
    b.listingSnapshot ??
    (listingSnap?.exists() ? listingSnap.data() : null);
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
  if (!actor) throw new Error("You must be logged in.");
  if (!auth.currentUser || auth.currentUser.uid !== actor.id)
    throw new Error("You must be logged in.");

  const bookingRef = doc(db, "bookings", id);
  const updatedBooking = await runTransaction(db, async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists()) throw new Error("Booking not found.");
    const booking = { id: bookingSnap.id, ...bookingSnap.data() };
    const isAdmin = actor.role === "admin";
    const isGuest = booking.guestId === actor.id;
    const isHost = booking.hostId === actor.id;
    if (!isAdmin && !isGuest && !isHost)
      throw new Error("You are not allowed to change this reservation.");

    const from = booking.status;
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
    if (status === "completed" && !isAdmin && booking.checkIn > todayStr())
      throw new Error("A stay can only be completed after check-in.");

    const updated = { ...booking, status };
    if (status === "cancelled") {
      const listingRef = doc(db, "listings", booking.listingId);
      const paymentRef = booking.paymentId
        ? doc(db, "payments", booking.paymentId)
        : null;
      const listingSnap = booking.listingSnapshot
        ? null
        : await transaction.get(listingRef);
      const paymentSnap = paymentRef
        ? await transaction.get(paymentRef)
        : null;
      const listing =
        booking.listingSnapshot ??
        (listingSnap?.exists() ? listingSnap.data() : null);
      const byGuest = isGuest && !isAdmin;
      const refund = refundFor(booking, withListingDefaults(listing), {
        byGuest,
      });
      updated.cancelledAt = new Date().toISOString();
      updated.cancelledBy = isAdmin ? "admin" : isGuest ? "guest" : "host";
      updated.refundAmount = refund.amount;

      const dates = Array.from(
        { length: nightsBetween(booking.checkIn, booking.checkOut) },
        (_, index) => addDays(booking.checkIn, index),
      );
      const lockRefs = dates.map((date) =>
        doc(db, "listings", booking.listingId, "availability", date),
      );
      const lockSnaps = await Promise.all(
        lockRefs.map((ref) => transaction.get(ref)),
      );
      lockRefs.forEach((ref, index) => {
        if (
          lockSnaps[index].exists() &&
          lockSnaps[index].data().bookingId === id
        )
          transaction.delete(ref);
      });
      if (
        paymentRef &&
        paymentSnap?.exists() &&
        paymentSnap.data().status === "succeeded" &&
        refund.amount > 0
      ) {
        transaction.update(paymentRef, {
          status:
            refund.amount >= paymentSnap.data().amount
              ? "refunded"
              : "partially_refunded",
          refundAmount: refund.amount,
        });
      }
    }

    transaction.update(bookingRef, {
      status: updated.status,
      ...(updated.cancelledAt
        ? {
            cancelledAt: updated.cancelledAt,
            cancelledBy: updated.cancelledBy,
            refundAmount: updated.refundAmount,
          }
        : {}),
    });
    return updated;
  });
  return enrich(updatedBooking);
}

// ---- Host availability calendar -------------------------------------------------
export async function getCalendarData(listingId, actor) {
  const listingSnap = await getDoc(doc(db, "listings", listingId));
  if (!listingSnap.exists()) throw new Error("Listing not found.");
  const listing = { id: listingSnap.id, ...listingSnap.data() };
  if (listing.hostId !== actor?.id && actor?.role !== "admin")
    throw new Error("Not your listing.");
  const constraints =
    actor?.role === "admin"
      ? [where("listingId", "==", listingId)]
      : [where("hostId", "==", actor?.id)];
  const snapshot = await getDocs(
    query(collection(db, "bookings"), ...constraints),
  );
  const bookings = snapshot.docs
    .map((bookingSnap) => ({
      id: bookingSnap.id,
      ...bookingSnap.data(),
    }))
    .filter((booking) => booking.listingId === listingId)
    .filter((booking) => ACTIVE_STATUSES.includes(booking.status))
    .filter((booking) => booking.status !== "pending_payment")
    .map((booking) => ({
      id: booking.id,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      status: booking.status,
      guestName: booking.guestName ?? booking.guestSnapshot?.name,
    }));
  return { bookings, blockedDates: listing.blockedDates || [] };
}

export async function setBlockedDates(listingId, dates, block, actor) {
  if (!actor) throw new Error("You must be logged in.");
  if (!auth.currentUser || auth.currentUser.uid !== actor.id)
    throw new Error("You must be logged in.");
  const listingRef = doc(db, "listings", listingId);
  const dateRefs = dates.map((date) =>
    doc(db, "listings", listingId, "availability", date),
  );
  return runTransaction(db, async (transaction) => {
    const [listingSnap, ...dateSnaps] = await Promise.all([
      transaction.get(listingRef),
      ...dateRefs.map((ref) => transaction.get(ref)),
    ]);
    if (!listingSnap.exists()) throw new Error("Listing not found.");
    const listing = listingSnap.data();
    if (listing.hostId !== actor.id && actor.role !== "admin")
      throw new Error("Not your listing.");
    const blockedDates = new Set(listing.blockedDates || []);
    dates.forEach((date, index) => {
      if (block) {
        if (date < todayStr() || dateSnaps[index].exists()) return;
        blockedDates.add(date);
      } else {
        blockedDates.delete(date);
      }
    });
    const result = [...blockedDates].sort();
    transaction.update(listingRef, { blockedDates: result });
    return result;
  });
}

export { blockedToRanges };
