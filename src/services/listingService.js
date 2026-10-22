// FIREBASE: Firestore collections 'listings', 'reviews', 'wishlists'
//   getListings    -> query(collection(db,'listings'), where('status','==','published'), ...)
//                     (text search / range filters: filter client-side or use Algolia/Typesense)
//   getListing     -> getDoc(doc(db,'listings',id))
//   create/update  -> addDoc / updateDoc ; images -> Firebase Storage uploadBytes + getDownloadURL
//   ownership      -> enforce in Firestore rules: resource.data.hostId == request.auth.uid
import { getDb, save, delay, genId, clone } from "./db.js";
import { pushNotification, notifyAdmins } from "./notificationService.js";
import {
  ACTIVE_STATUSES,
  applyReviewDelta,
  isRangeFree,
  isVisible,
  todayStr,
  withListingDefaults,
} from "./rules.js";

const isAdminOrOwner = (listing, actor) =>
  !!actor && (actor.role === "admin" || listing.hostId === actor.id);

export async function getListings(filters = {}) {
  await delay();
  const db = getDb();
  const {
    q,
    category,
    minPrice,
    maxPrice,
    guests,
    propertyType,
    sort,
    checkIn,
    checkOut,
  } = filters;
  let list = db.listings.filter((l) => l.status === "published");
  if (q && q.trim()) {
    const s = q.trim().toLowerCase();
    list = list.filter((l) =>
      [
        l.title,
        l.location,
        l.street,
        l.neighborhood,
        l.city,
        l.province,
        l.postalCode,
        l.landmark,
        l.country,
      ].some((f) => (f || "").toLowerCase().includes(s)),
    );
  }
  if (category && category !== "all")
    list = list.filter((l) => l.category === category);
  if (minPrice) list = list.filter((l) => l.pricePerNight >= Number(minPrice));
  if (maxPrice) list = list.filter((l) => l.pricePerNight <= Number(maxPrice));
  if (guests) list = list.filter((l) => l.maxGuests >= Number(guests));
  if (propertyType && propertyType !== "any")
    list = list.filter((l) => l.propertyType === propertyType);
  // date filter: hide listings that are booked or blocked during the chosen stay
  if (checkIn && checkOut && checkOut > checkIn)
    list = list.filter((l) => isRangeFree(db, l.id, checkIn, checkOut));
  if (sort === "price-asc")
    list = [...list].sort((a, b) => a.pricePerNight - b.pricePerNight);
  if (sort === "price-desc")
    list = [...list].sort((a, b) => b.pricePerNight - a.pricePerNight);
  if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
  return clone(list.map(withListingDefaults));
}

export async function getListing(id) {
  await delay();
  const db = getDb();
  const listing = db.listings.find((l) => l.id === id);
  if (!listing) return null;
  const host = db.users.find((u) => u.id === listing.hostId);
  const reviews = db.reviews
    .filter((r) => r.listingId === id && isVisible(r))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => {
      const g = db.users.find((u) => u.id === r.guestId);
      return {
        ...r,
        guest: g ? { id: g.id, name: g.name, avatar: g.avatar } : null,
      };
    });
  return clone({
    ...withListingDefaults(listing),
    host: host
      ? {
          id: host.id,
          name: host.name,
          avatar: host.avatar,
          bio: host.bio,
          createdAt: host.createdAt,
        }
      : null,
    reviews,
  });
}

export async function getHostListings(hostId) {
  await delay();
  return clone(
    getDb()
      .listings.filter((l) => l.hostId === hostId)
      .map(withListingDefaults),
  );
}

const numeric = (d, listing = {}) => ({
  pricePerNight: Number(d.pricePerNight ?? listing.pricePerNight),
  cleaningFee: Number(d.cleaningFee ?? listing.cleaningFee ?? 0),
  maxGuests: Number(d.maxGuests ?? listing.maxGuests),
  bedrooms: Number(d.bedrooms ?? listing.bedrooms),
  beds: Number(d.beds ?? listing.beds),
  baths: Number(d.baths ?? listing.baths),
});

const cleanRules = (rules) =>
  Array.isArray(rules) ? rules.map((r) => r.trim()).filter(Boolean) : undefined;

export async function createListing(hostId, data) {
  await delay();
  const db = getDb();
  const host = db.users.find((u) => u.id === hostId);
  if (!host || !["host", "admin"].includes(host.role))
    throw new Error("Only approved hosts can create listings.");
  const {
    id: _i,
    hostId: _h,
    rating: _r,
    reviewCount: _rc,
    status: _s,
    blockedDates: _b,
    ...rest
  } = data;
  const listing = withListingDefaults({
    ...rest,
    id: genId("l"),
    hostId,
    rating: 0,
    reviewCount: 0,
    status: "pending", // admin approves before publishing
    createdAt: new Date().toISOString(),
    ...numeric(data),
    ...(cleanRules(data.houseRules)
      ? { houseRules: cleanRules(data.houseRules) }
      : {}),
  });
  db.listings.unshift(listing);
  notifyAdmins({
    title: "Listing waiting for approval",
    message: `${host.name} submitted "${listing.title}".`,
    link: "/admin/listings",
  });
  save();
  return clone(listing);
}

export async function updateListing(id, data, actor) {
  await delay();
  const listing = getDb().listings.find((l) => l.id === id);
  if (!listing) throw new Error("Listing not found.");
  // property ownership: a host can only change their own listings
  if (!isAdminOrOwner(listing, actor))
    throw new Error("You can only edit your own listings.");
  const {
    id: _i,
    hostId: _h,
    rating: _r,
    reviewCount: _rc,
    createdAt: _c,
    blockedDates: _b,
    status,
    ...rest
  } = data;
  Object.assign(listing, rest, numeric(data, listing));
  if (data.houseRules) listing.houseRules = cleanRules(data.houseRules);
  if (status && status !== listing.status) {
    const hostMove =
      (listing.status === "published" && status === "unlisted") ||
      (listing.status === "unlisted" && status === "pending");
    if (actor.role === "admin" || hostMove) {
      listing.status = status;
      if (status === "pending")
        notifyAdmins({
          title: "Relist request",
          message: `"${listing.title}" is waiting for approval.`,
          link: "/admin/listings",
        });
    }
  }
  save();
  return clone(withListingDefaults(listing));
}

// Deleting is blocked while there are pending / upcoming reservations.
export async function deleteListing(id, actor) {
  await delay();
  const db = getDb();
  const listing = db.listings.find((l) => l.id === id);
  if (!listing) throw new Error("Listing not found.");
  if (!isAdminOrOwner(listing, actor))
    throw new Error("You can only delete your own listings.");
  const blocking = db.bookings.filter(
    (b) =>
      b.listingId === id &&
      ACTIVE_STATUSES.includes(b.status) &&
      b.checkOut >= todayStr(),
  );
  if (blocking.length)
    throw new Error(
      `This listing has ${blocking.length} pending or upcoming reservation(s). Cancel them first, or unlist the property instead.`,
    );
  db.listings = db.listings.filter((l) => l.id !== id);
  db.reviews = db.reviews.filter((r) => r.listingId !== id);
  Object.keys(db.wishlists).forEach((u) => {
    db.wishlists[u] = db.wishlists[u].filter((x) => x !== id);
  });
  if (actor.role === "admin" && listing.hostId !== actor.id)
    pushNotification(listing.hostId, {
      type: "listing",
      title: "Listing removed",
      message: `"${listing.title}" was removed by an administrator.`,
      link: "/host/listings",
    });
  save();
}

// ---- Reviews -----------------------------------------------------------------
// Review eligibility: the guest must have a COMPLETED stay at this listing
// (or a confirmed stay whose check-out date has passed) and may review it only once.
export function reviewEligibility(db, userId, listingId) {
  if (!userId) return { eligible: false, reason: "login" };
  const stay = db.bookings
    .filter((b) => b.listingId === listingId && b.guestId === userId)
    .find(
      (b) =>
        b.status === "completed" ||
        (b.status === "confirmed" && b.checkOut < todayStr()),
    );
  if (!stay) return { eligible: false, reason: "no-stay" };
  if (db.reviews.some((r) => r.listingId === listingId && r.guestId === userId))
    return { eligible: false, reason: "already" };
  return { eligible: true, bookingId: stay.id };
}

export async function getReviewEligibility(userId, listingId) {
  await delay(60);
  return reviewEligibility(getDb(), userId, listingId);
}

export async function getReviewedListingIds(userId) {
  return getDb()
    .reviews.filter((r) => r.guestId === userId)
    .map((r) => r.listingId);
}

export async function addReview({ listingId, guestId, rating, comment }) {
  await delay();
  const db = getDb();
  const el = reviewEligibility(db, guestId, listingId);
  if (!el.eligible)
    throw new Error(
      el.reason === "already"
        ? "You have already reviewed this stay."
        : "Only guests who completed a stay can leave a review.",
    );
  const r = Number(rating);
  if (!(r >= 1 && r <= 5)) throw new Error("Choose a rating from 1 to 5.");
  if (!comment?.trim()) throw new Error("Please write a short review.");
  const review = {
    id: genId("r"),
    listingId,
    guestId,
    bookingId: el.bookingId,
    rating: r,
    comment: comment.trim(),
    status: "visible",
    createdAt: new Date().toISOString(),
  };
  db.reviews.unshift(review);
  const listing = db.listings.find((l) => l.id === listingId);
  if (listing) {
    applyReviewDelta(listing, r, +1);
    const guest = db.users.find((u) => u.id === guestId);
    pushNotification(listing.hostId, {
      type: "review",
      title: "New review",
      message: `${guest?.name || "A guest"} rated "${listing.title}" ${r}★.`,
      link: "/host/reviews",
    });
  }
  save();
  return clone(review);
}

// Host review management: every review on the host's listings + per-listing ratings.
export async function getHostReviews(hostId) {
  await delay();
  const db = getDb();
  const mine = db.listings.filter((l) => l.hostId === hostId);
  const ids = new Set(mine.map((l) => l.id));
  const reviews = db.reviews
    .filter((r) => ids.has(r.listingId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => {
      const g = db.users.find((u) => u.id === r.guestId);
      return {
        ...r,
        guest: g ? { id: g.id, name: g.name, avatar: g.avatar } : null,
        listingTitle: mine.find((l) => l.id === r.listingId)?.title,
      };
    });
  const summary = mine.map((l) => ({
    id: l.id,
    title: l.title,
    rating: l.rating,
    count: l.reviewCount,
    shown: reviews.filter((r) => r.listingId === l.id && isVisible(r)).length,
  }));
  return clone({ reviews, summary });
}

// A host can report an abusive review; admins decide in Review moderation.
export async function reportReview(reviewId, reason, actor) {
  await delay();
  const db = getDb();
  const r = db.reviews.find((x) => x.id === reviewId);
  if (!r) throw new Error("Review not found.");
  const listing = db.listings.find((l) => l.id === r.listingId);
  if (!listing || listing.hostId !== actor?.id)
    throw new Error("You can only report reviews on your own listings.");
  if (!reason?.trim())
    throw new Error("Tell us why you are reporting this review.");
  r.reported = {
    by: actor.id,
    reason: reason.trim(),
    at: new Date().toISOString(),
  };
  notifyAdmins({
    title: "Review reported",
    message: `A host reported a review on "${listing.title}".`,
    link: "/admin/reviews",
  });
  save();
}

// ---- Wishlist --------------------------------------------------------------
// FIREBASE: /users/{uid}/wishlist/{listingId} subcollection
export async function getWishlistIds(userId) {
  return clone(getDb().wishlists[userId] || []);
}

export async function getWishlist(userId) {
  await delay();
  const db = getDb();
  const ids = db.wishlists[userId] || [];
  return clone(
    db.listings.filter((l) => ids.includes(l.id)).map(withListingDefaults),
  );
}

export async function toggleWishlist(userId, listingId) {
  const db = getDb();
  const ids = db.wishlists[userId] || [];
  db.wishlists[userId] = ids.includes(listingId)
    ? ids.filter((i) => i !== listingId)
    : [...ids, listingId];
  save();
  return clone(db.wishlists[userId]);
}
