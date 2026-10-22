// ============================================================================
// rules.js — pure business rules shared by several services.
// Nothing here touches storage, so it moves to Firebase / Cloud Functions as-is.
// ============================================================================
export const pad = (n) => String(n).padStart(2, "0");
export const todayStr = () => new Date().toISOString().slice(0, 10);

export const addDays = (iso, n) => {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (a, b) =>
  Math.round((new Date(b) - new Date(a)) / 86400000);

export const rangesOverlap = (aIn, aOut, bIn, bOut) =>
  new Date(aIn) < new Date(bOut) && new Date(aOut) > new Date(bIn);

export const ACTIVE_STATUSES = ["pending", "pending_payment", "confirmed"];

// ---- Listing defaults (so old data and new fields never crash the UI) -------
export const DEFAULT_RULES = [
  "No smoking indoors",
  "No parties or events",
  "Quiet hours 10 PM – 7 AM",
  "Respect the neighbours",
];

export const LISTING_DEFAULTS = {
  houseRules: DEFAULT_RULES,
  checkInTime: "14:00",
  checkOutTime: "11:00",
  cancellationPolicy: "moderate",
  instantBook: true,
  blockedDates: [],
};

export const withListingDefaults = (l) =>
  l ? { ...LISTING_DEFAULTS, ...l } : l;

// ---- Cancellation policies ---------------------------------------------------
export const CANCELLATION_POLICIES = {
  flexible: {
    label: "Flexible",
    desc: "Full refund up to 1 day before check-in. After that, 50% refund.",
  },
  moderate: {
    label: "Moderate",
    desc: "Full refund up to 5 days before check-in. 50% refund up to 1 day before. No refund after.",
  },
  strict: {
    label: "Strict",
    desc: "50% refund up to 7 days before check-in. No refund after.",
  },
};

// Returns { amount, percent } the guest gets back if THEY cancel now.
// Host / admin cancellations and unaccepted requests are always refunded in full.
export function refundFor(booking, listing, { byGuest = true } = {}) {
  const full = { amount: booking.total, percent: 100 };
  if (!booking.paymentId) return { amount: 0, percent: 0 };
  if (!byGuest || booking.status === "pending") return full;
  const days = daysBetween(todayStr(), booking.checkIn);
  const policy = listing?.cancellationPolicy || "moderate";
  let percent = 0;
  if (policy === "flexible") percent = days >= 1 ? 100 : 50;
  else if (policy === "moderate")
    percent = days >= 5 ? 100 : days >= 1 ? 50 : 0;
  else percent = days >= 7 ? 50 : 0;
  return {
    amount: Number(((booking.total * percent) / 100).toFixed(2)),
    percent,
  };
}

// ---- Availability ------------------------------------------------------------
// Blocked single dates -> merged [checkIn, checkOut) ranges.
export function blockedToRanges(dates = []) {
  const sorted = [...new Set(dates)].sort();
  const out = [];
  for (const d of sorted) {
    const last = out[out.length - 1];
    if (last && last.checkOut === d) last.checkOut = addDays(d, 1);
    else out.push({ checkIn: d, checkOut: addDays(d, 1), blocked: true });
  }
  return out;
}

export function unavailableRanges(db, listingId) {
  const listing = db.listings.find((l) => l.id === listingId);
  const booked = db.bookings
    .filter(
      (b) => b.listingId === listingId && ACTIVE_STATUSES.includes(b.status),
    )
    .map((b) => ({ checkIn: b.checkIn, checkOut: b.checkOut }));
  return [...booked, ...blockedToRanges(listing?.blockedDates)];
}

export const isRangeFree = (db, listingId, checkIn, checkOut) =>
  !unavailableRanges(db, listingId).some((r) =>
    rangesOverlap(checkIn, checkOut, r.checkIn, r.checkOut),
  );

// ---- Ratings (works with seeded counts: adjusts the running average) ---------
export function applyReviewDelta(listing, rating, sign) {
  const n = listing.reviewCount || 0;
  const total = (listing.rating || 0) * n + sign * rating;
  const next = Math.max(0, n + sign);
  listing.reviewCount = next;
  listing.rating = next ? Number((total / next).toFixed(2)) : 0;
}

export const isVisible = (r) => (r.status || "visible") === "visible";
