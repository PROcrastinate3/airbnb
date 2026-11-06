// FIREBASE: Firestore collections 'listings', 'reviews', 'wishlists'
//   getListings    -> query(collection(db,'listings'), where('status','==','published'), ...)
//                     (text search / range filters: filter client-side or use Algolia/Typesense)
//   getListing     -> getDoc(doc(db,'listings',id))
//   create/update  -> addDoc / updateDoc ; images -> Firebase Storage uploadBytes + getDownloadURL
//   ownership      -> enforce in Firestore rules: resource.data.hostId == request.auth.uid
import { getDb, save, delay, genId, clone } from "./db.js";
import { getAuth } from "firebase/auth";
import { pushNotification, notifyAdmins } from "./notificationService.js";
import {
  ACTIVE_STATUSES,
  applyReviewDelta,
  isRangeFree,
  isVisible,
  todayStr,
  withListingDefaults,
} from "./rules.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
const isAdminOrOwner = (listing, actor) =>
  !!actor && (actor.role === "admin" || listing.hostId === actor.id);

// Nights of the stay: checkIn inclusive, checkOut exclusive ("YYYY-MM-DD")
function nightsBetween(checkIn, checkOut) {
  const nights = [];
  const d = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  while (d < end) {
    nights.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return nights;
}

export async function getListings(filters = {}) {
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

  // Filters Firestore can handle server-side
  const constraints = [where("status", "==", "published")];
  if (category && category !== "all")
    constraints.push(where("category", "==", category));
  if (propertyType && propertyType !== "any")
    constraints.push(where("propertyType", "==", propertyType));
  if (minPrice)
    constraints.push(where("pricePerNight", ">=", Number(minPrice)));
  if (maxPrice)
    constraints.push(where("pricePerNight", "<=", Number(maxPrice)));

  const snapshot = await getDocs(
    query(collection(db, "listings"), ...constraints),
  );

  let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Guests: kept client-side to avoid a second range filter on another field
  if (guests) list = list.filter((l) => (l.maxGuests ?? 0) >= Number(guests));

  // Text search: Firestore has no substring search, so filter here
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

  // Availability via the listing's blockedDates[]
  if (checkIn && checkOut && checkOut > checkIn) {
    const nights = nightsBetween(checkIn, checkOut);
    list = list.filter((l) => {
      const blocked = new Set(l.blockedDates ?? []);
      return !nights.some((n) => blocked.has(n));
    });
    // TODO: also exclude listings with overlapping bookings once
    // bookings are in Firestore (see note below)
  }

  if (sort === "price-asc")
    list.sort((a, b) => a.pricePerNight - b.pricePerNight);
  if (sort === "price-desc")
    list.sort((a, b) => b.pricePerNight - a.pricePerNight);
  if (sort === "rating") list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  return list.map(withListingDefaults);
}

const toMillis = (v) =>
  v?.toMillis ? v.toMillis() : v ? new Date(v).getTime() : 0;

const pickUser = (u) =>
  u ? { id: u.id, name: u.name, avatar: u.avatar } : null;

export async function getListing(id) {
  const listingSnap = await getDoc(doc(db, "listings", id));
  if (!listingSnap.exists()) return null;
  const listing = { id: listingSnap.id, ...listingSnap.data() };

  // Public profile documents are readable by guests; user documents are private.
  const [profiles, reviewsSnap] = await Promise.all([
    getPublicProfiles(listing.hostId ? [listing.hostId] : []),
    getDocs(
      query(
        collection(db, "reviews"),
        where("listingId", "==", id),
        where("status", "==", "visible"),
      ),
    ),
  ]);

  const host = profiles.get(listing.hostId);

  // Visibility and sorting are done client-side (no composite index needed)
  const visibleReviews = reviewsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(isVisible)
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

  // Reviewer profiles are public; do not read private user documents here.
  const guestIds = [
    ...new Set(visibleReviews.map((r) => r.guestId).filter(Boolean)),
  ];
  const guestsById = await getPublicProfiles(guestIds);

  const reviews = visibleReviews.map((r) => ({
    ...r,
    guest: pickUser(guestsById.get(r.guestId)),
  }));

  return {
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
  };
}

export async function getHostListings(hostId) {
  const snapshot = await getDocs(
    query(collection(db, "listings"), where("hostId", "==", hostId)),
  );

  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)) // newest first
    .map(withListingDefaults);
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
const stripUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export async function createListing(hostId, data) {
  const hostSnap = await getDoc(doc(db, "users", hostId));
  const host = hostSnap.exists()
    ? { id: hostSnap.id, ...hostSnap.data() }
    : null;
  if (!host || !["host", "admin"].includes(host.role))
    throw new Error("Only approved hosts can create listings.");

  // Strip fields the client must not control
  const {
    id: _i,
    hostId: _h,
    rating: _r,
    reviewCount: _rc,
    status: _s,
    blockedDates: _b,
    createdAt: _c,
    ...rest
  } = data;

  const rules = cleanRules(data.houseRules);

  const listing = stripUndefined({
    ...withListingDefaults({
      ...rest,
      ...numeric(data),
      ...(rules ? { houseRules: rules } : {}),
    }),
    hostId,
    rating: 0,
    reviewCount: 0,
    status: "pending", // admin approves before publishing
    blockedDates: [],
    createdAt: serverTimestamp(),
  });
  delete listing.id; // the id is the document ID, not a field

  const token = await getAuth().currentUser.getIdTokenResult(true);
  console.log("uid:", getAuth().currentUser.uid, "hostId:", hostId);
  console.log("claims:", token.claims);
  const ref = await addDoc(collection(db, "listings"), listing);

  // Don't fail the whole creation if the notification fails
  try {
    await notifyAdmins({
      title: "Listing waiting for approval",
      message: `${host.name} submitted "${listing.title}".`,
      link: "/admin/listings",
    });
  } catch (err) {
    console.error("Failed to notify admins:", err);
  }

  // Re-read so createdAt is the resolved server timestamp, not a sentinel
  const saved = await getDoc(ref);
  return { id: saved.id, ...saved.data() };
}

export async function updateListing(id, data, actor) {
  const ref = doc(db, "listings", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Listing not found.");
  const listing = { id: snap.id, ...snap.data() };

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

  // Collect changes instead of mutating the listing
  const updates = {
    ...rest,
    ...numeric(data, listing), // falls back to the stored values
    ...(data.houseRules ? { houseRules: cleanRules(data.houseRules) } : {}),
  };

  let relistRequested = false;
  if (status && status !== listing.status) {
    const hostMove =
      (listing.status === "published" && status === "unlisted") ||
      (listing.status === "unlisted" && status === "pending");
    if (actor.role === "admin" || hostMove) {
      updates.status = status;
      relistRequested = status === "pending";
    }
  }

  await updateDoc(ref, {
    ...stripUndefined(updates),
    updatedAt: serverTimestamp(),
  });

  if (relistRequested) {
    try {
      await notifyAdmins({
        title: "Relist request",
        message: `"${listing.title}" is waiting for approval.`,
        link: "/admin/listings",
      });
    } catch (err) {
      console.error("Failed to notify admins:", err);
    }
  }

  const updated = await getDoc(ref);
  return withListingDefaults({ id: updated.id, ...updated.data() });
}

export async function deleteListing(id, actor) {
  const ref = doc(db, "listings", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Listing not found.");
  const listing = { id: snap.id, ...snap.data() };

  if (!isAdminOrOwner(listing, actor))
    throw new Error("You can only delete your own listings.");

  // The hostId filter is required: your rules only let a host read bookings
  // where hostId == their uid, so a query without it is rejected outright.
  const bookingsSnap = await getDocs(
    query(
      collection(db, "bookings"),
      where("listingId", "==", id),
      where("hostId", "==", listing.hostId),
      where("status", "in", ACTIVE_STATUSES),
    ),
  );
  const today = todayStr();
  const blocking = bookingsSnap.docs.filter((d) => d.data().checkOut >= today);
  if (blocking.length)
    throw new Error(
      `This listing has ${blocking.length} pending or upcoming reservation(s). Cancel them first, or unlist the property instead.`,
    );

  await deleteDoc(ref);

  if (actor.role === "admin" && listing.hostId !== actor.id) {
    try {
      await pushNotification(listing.hostId, {
        type: "listing",
        title: "Listing removed",
        message: `"${listing.title}" was removed by an administrator.`,
        link: "/host/listings",
      });
    } catch (err) {
      console.error("Failed to notify host:", err);
    }
  }
}

// ---- Reviews -----------------------------------------------------------------
// Review eligibility: the guest must have a COMPLETED stay at this listing
// (or a confirmed stay whose check-out date has passed) and may review it only once.
export async function reviewEligibility(userId, listingId) {
  if (!userId) return { eligible: false, reason: "login" };

  // Both queries filter by guestId, which your read rules require
  const bookingsSnap = await getDocs(
    query(
      collection(db, "bookings"),
      where("guestId", "==", userId),
      where("listingId", "==", listingId),
    ),
  );
  const today = todayStr();
  const stay = bookingsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find(
      (b) =>
        b.status === "completed" ||
        (b.status === "confirmed" && b.checkOut < today),
    );
  if (!stay) return { eligible: false, reason: "no-stay" };

  const existing = await getDocs(
    query(
      collection(db, "reviews"),
      where("guestId", "==", userId),
      where("listingId", "==", listingId),
      limit(1),
    ),
  );
  if (!existing.empty) return { eligible: false, reason: "already" };

  return { eligible: true, bookingId: stay.id };
}

export async function getReviewEligibility(userId, listingId) {
  return reviewEligibility(userId, listingId);
}

export async function getReviewedListingIds(userId) {
  if (!userId) return [];
  const snap = await getDocs(
    query(collection(db, "reviews"), where("guestId", "==", userId)),
  );
  return snap.docs.map((d) => d.data().listingId);
}

export async function addReview({ listingId, guestId, rating, comment }) {
  const el = await reviewEligibility(guestId, listingId);
  if (!el.eligible)
    throw new Error(
      el.reason === "already"
        ? "You have already reviewed this stay."
        : "Only guests who completed a stay can leave a review.",
    );
  const r = Number(rating);
  if (!(r >= 1 && r <= 5)) throw new Error("Choose a rating from 1 to 5.");
  if (!comment?.trim()) throw new Error("Please write a short review.");

  // Deterministic ID: one review per guest per listing, enforced by the rules
  const ref = doc(db, "reviews", `${guestId}_${listingId}`);
  try {
    await setDoc(ref, {
      listingId,
      guestId,
      bookingId: el.bookingId,
      rating: r,
      comment: comment.trim(),
      status: "visible",
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    if (err.code === "permission-denied")
      throw new Error(
        "Couldn't submit your review. You may have already reviewed this stay.",
      );
    throw err;
  }

  const saved = await getDoc(ref);
  return { id: saved.id, ...saved.data() };
}

// Host review management: every review on the host's listings + per-listing ratings.
// Public name/avatar lookup. A failed or missing lookup gives null, as in the mock.
async function getPublicProfiles(ids) {
  const entries = await Promise.all(
    ids.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "publicProfiles", uid));
        if (!snap.exists()) return null;
        const { name, avatar, bio, createdAt } = snap.data();
        return [
          uid,
          {
            id: uid,
            name,
            avatar,
            bio,
            createdAt: createdAt?.toDate
              ? createdAt.toDate().toISOString()
              : createdAt ?? null,
          },
        ];
      } catch {
        return null;
      }
    }),
  );
  return new Map(entries.filter(Boolean));
}

export async function getHostReviews(hostId) {
  const listingsSnap = await getDocs(
    query(collection(db, "listings"), where("hostId", "==", hostId)),
  );
  const mine = listingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // One query per listing: the rule looks up each listing's host, which only
  // works when the query pins listingId to a single value
  const reviewSnaps = await Promise.all(
    mine.map((l) =>
      getDocs(query(collection(db, "reviews"), where("listingId", "==", l.id))),
    ),
  );
  const all = reviewSnaps
    .flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

  const guests = await getPublicProfiles([
    ...new Set(all.map((r) => r.guestId).filter(Boolean)),
  ]);
  const titleById = new Map(mine.map((l) => [l.id, l.title]));

  const reviews = all.map((r) => ({
    ...r,
    guest: guests.get(r.guestId) ?? null,
    listingTitle: titleById.get(r.listingId),
  }));

  const summary = mine.map((l) => ({
    id: l.id,
    title: l.title,
    rating: l.rating,
    count: l.reviewCount,
    shown: reviews.filter((r) => r.listingId === l.id && isVisible(r)).length,
  }));

  return { reviews, summary };
}

// A host can report an abusive review; admins decide in Review moderation.
export async function reportReview(reviewId, reason, actor) {
  const reviewRef = doc(db, "reviews", reviewId);
  const reviewSnap = await getDoc(reviewRef);
  if (!reviewSnap.exists()) throw new Error("Review not found.");
  const r = { id: reviewSnap.id, ...reviewSnap.data() };

  const listingSnap = await getDoc(doc(db, "listings", r.listingId));
  if (!listingSnap.exists() || listingSnap.data().hostId !== actor?.id)
    throw new Error("You can only report reviews on your own listings.");
  if (!reason?.trim())
    throw new Error("Tell us why you are reporting this review.");

  await updateDoc(reviewRef, {
    reported: {
      by: actor.id,
      reason: reason.trim(),
      at: serverTimestamp(),
    },
  });
}

// ---- Wishlist --------------------------------------------------------------
// FIREBASE: /users/{uid}/wishlist/{listingId} subcollection
export async function getWishlistIds(userId) {
  if (!userId) return [];
  const snap = await getDocs(collection(db, "users", userId, "wishlist"));
  return snap.docs.map((d) => d.data().listingId ?? d.id);
}

export async function getWishlist(userId) {
  const ids = await getWishlistIds(userId);

  // One getDoc per listing. A listing that was deleted or is no longer
  // readable (unlisted, suspended) throws a permission error, so skip it
  const snaps = await Promise.all(
    ids.map(async (id) => {
      try {
        return await getDoc(doc(db, "listings", id));
      } catch {
        return null;
      }
    }),
  );

  return snaps
    .filter((s) => s && s.exists())
    .map((s) => withListingDefaults({ id: s.id, ...s.data() }));
}

export async function toggleWishlist(userId, listingId) {
  const ref = doc(db, "users", userId, "wishlist", listingId);
  const snap = await getDoc(ref);
  if (snap.exists()) await deleteDoc(ref);
  else await setDoc(ref, { listingId });
  return getWishlistIds(userId);
}
