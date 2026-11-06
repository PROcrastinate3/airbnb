import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { deleteListing } from "./listingService.js";
import { pushNotification } from "./notificationService.js";
import { applyReviewDelta, isVisible } from "./rules.js";

const requireAdmin = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("Administrator access required.");
  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists() || userSnap.data().role !== "admin")
    throw new Error("Administrator access required.");
  return user;
};

const asISO = (value) =>
  value?.toDate ? value.toDate().toISOString() : value;

const withId = (snapshot) => ({
  id: snapshot.id,
  ...snapshot.data(),
  createdAt: asISO(snapshot.data().createdAt),
  submittedAt: asISO(snapshot.data().submittedAt),
  reviewedAt: asISO(snapshot.data().reviewedAt),
  updatedAt: asISO(snapshot.data().updatedAt),
  cancelledAt: asISO(snapshot.data().cancelledAt),
});

const getCollection = async (name) => {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map(withId);
};

const getPublicProfiles = async (ids) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const snapshots = await Promise.all(
    uniqueIds.map((id) => getDoc(doc(db, "publicProfiles", id))),
  );
  return new Map(
    snapshots
      .filter((snapshot) => snapshot.exists())
      .map((snapshot) => [snapshot.id, snapshot.data()]),
  );
};

const monthsBack = (n) => {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return {
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleString("en", { month: "short" }),
      value: 0,
    };
  });
};

const getStayDates = (checkIn, checkOut) => {
  const dates = [];
  const date = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  while (date < end) {
    dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return dates;
};

export async function getAdminStats() {
  await requireAdmin();
  const [users, listings, bookings, payments, reviews, applications] = await Promise.all([
    getCollection("users"),
    getCollection("listings"),
    getCollection("bookings"),
    getCollection("payments"),
    getCollection("reviews"),
    getCollection("hostApplication"),
  ]);
  const realBookings = bookings.filter(
    (booking) => booking.status !== "pending_payment",
  );
  const paid = payments.filter((payment) =>
    ["succeeded", "partially_refunded"].includes(payment.status),
  );
  const revenue = paid.reduce(
    (sum, payment) => sum + payment.amount - (payment.refundAmount || 0),
    0,
  );
  const platformFees = realBookings
    .filter((booking) => ["confirmed", "completed"].includes(booking.status))
    .reduce((sum, booking) => sum + (booking.serviceFee || 0), 0);

  const months = monthsBack(6);
  paid.forEach((payment) => {
    const month = months.find((entry) =>
      asISO(payment.createdAt)?.startsWith(entry.key),
    );
    if (month)
      month.value += payment.amount - (payment.refundAmount || 0);
  });

  const [profiles, listingById] = await Promise.all([
    getPublicProfiles(realBookings.map((booking) => booking.guestId)),
    Promise.resolve(new Map(listings.map((listing) => [listing.id, listing]))),
  ]);
  const recentBookings = realBookings
    .sort(
      (a, b) =>
        new Date(b.createdAt || b.checkIn) - new Date(a.createdAt || a.checkIn),
    )
    .slice(0, 5)
    .map((booking) => ({
      ...booking,
      listingTitle: listingById.get(booking.listingId)?.title,
      guestName: booking.guestSnapshot?.name ?? profiles.get(booking.guestId)?.name,
    }));

  return {
    users: users.length,
    guests: users.filter((user) => user.role === "guest").length,
    hosts: users.filter((user) => user.role === "host").length,
    listings: listings.length,
    publishedListings: listings.filter((listing) => listing.status === "published")
      .length,
    pendingListings: listings.filter((listing) => listing.status === "pending")
      .length,
    pendingHosts: new Set([
      ...users
        .filter((user) => user.hostApplication?.status === "pending")
        .map((user) => user.id),
      ...applications
        .filter((application) => application.status === "pending")
        .map((application) => application.userId),
    ]).size,
    reportedReviews: reviews.filter(
      (review) => review.reported && isVisible(review),
    ).length,
    bookings: realBookings.length,
    revenue,
    platformFees,
    months,
    recentBookings,
  };
}

export async function getAnalytics(rangeMonths = 6) {
  await requireAdmin();
  const monthCount = Math.max(1, Math.floor(Number(rangeMonths) || 6));
  const [bookings, users, listings, settingsSnap] = await Promise.all([
    getCollection("bookings"),
    getCollection("users"),
    getCollection("listings"),
    getDoc(doc(db, "settings", "platform")),
  ]);
  const months = monthsBack(monthCount);
  const keys = new Set(months.map((month) => month.key));
  const realBookings = bookings.filter(
    (booking) => booking.status !== "pending_payment",
  );
  const inRange = realBookings.filter((booking) =>
    keys.has(asISO(booking.createdAt)?.slice(0, 7)),
  );

  const bookingsByMonth = months.map((month) => ({
    ...month,
    value: inRange.filter((booking) =>
      asISO(booking.createdAt)?.startsWith(month.key),
    ).length,
  }));
  const revenueByMonth = months.map((month) => ({
    ...month,
    value: inRange
      .filter(
        (booking) =>
          asISO(booking.createdAt)?.startsWith(month.key) &&
          ["confirmed", "completed"].includes(booking.status),
      )
      .reduce((sum, booking) => sum + (booking.total || 0), 0),
  }));
  const usersByMonth = months.map((month) => ({
    ...month,
    value: users.filter((user) =>
      asISO(user.createdAt)?.startsWith(month.key),
    ).length,
  }));
  const statusCounts = ["pending", "confirmed", "completed", "cancelled"].map(
    (status) => ({
      key: status,
      label: status,
      value: inRange.filter((booking) => booking.status === status).length,
    }),
  );
  const earning = inRange.filter((booking) =>
    ["confirmed", "completed"].includes(booking.status),
  );
  const revenue = earning.reduce((sum, booking) => sum + (booking.total || 0), 0);
  const fees = earning.reduce(
    (sum, booking) => sum + (booking.serviceFee || 0),
    0,
  );

  const byListing = {};
  earning.forEach((booking) => {
    byListing[booking.listingId] ??= { bookings: 0, revenue: 0, nights: 0 };
    byListing[booking.listingId].bookings += 1;
    byListing[booking.listingId].revenue += booking.total || 0;
    byListing[booking.listingId].nights += booking.nights || 0;
  });
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const topListings = Object.entries(byListing)
    .map(([id, value]) => ({
      id,
      ...value,
      title: listingById.get(id)?.title || "(removed)",
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const byCategory = {};
  earning.forEach((booking) => {
    const category = listingById.get(booking.listingId)?.category || "other";
    byCategory[category] ??= { category, bookings: 0, revenue: 0 };
    byCategory[category].bookings += 1;
    byCategory[category].revenue += booking.total || 0;
  });
  const categories = settingsSnap.exists()
    ? settingsSnap.data().categories || []
    : [];
  const categoryLabel = (id) =>
    categories.find((category) => category.id === id)?.label || id;

  return {
    totals: {
      bookings: inRange.length,
      revenue,
      fees,
      avgBooking: earning.length ? revenue / earning.length : 0,
      cancellationRate: inRange.length
        ? (inRange.filter((booking) => booking.status === "cancelled").length /
            inRange.length) *
          100
        : 0,
      newUsers: usersByMonth.reduce((sum, month) => sum + month.value, 0),
      nights: earning.reduce((sum, booking) => sum + (booking.nights || 0), 0),
    },
    bookingsByMonth,
    revenueByMonth,
    usersByMonth,
    statusCounts,
    topListings,
    byCategory: Object.values(byCategory)
      .map((category) => ({
        ...category,
        label: categoryLabel(category.category),
      }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

export async function getAllUsers() {
  await requireAdmin();
  return (await getCollection("users")).map(({ password, ...user }) => user);
}

export async function setUserStatus(userId, status) {
  await requireAdmin();
  if (!["active", "suspended"].includes(status))
    throw new Error("Invalid user status.");
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error("User not found.");
  if (userSnap.data().role === "admin")
    throw new Error("Cannot change an admin account.");
  await updateDoc(userRef, { status, updatedAt: serverTimestamp() });
}

export async function updateUserDetails(userId, { name, phone, bio }) {
  await requireAdmin();
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error("User not found.");
  if (!name?.trim()) throw new Error("Name cannot be empty.");
  const updates = {
    name: name.trim(),
    phone: phone ?? userSnap.data().phone ?? "",
    bio: bio ?? userSnap.data().bio ?? "",
    updatedAt: serverTimestamp(),
  };
  await updateDoc(userRef, updates);
  await updateDoc(doc(db, "publicProfiles", userId), {
    name: updates.name,
    bio: updates.bio,
  });
}

export async function setUserRole(userId, role) {
  await requireAdmin();
  if (!["guest", "host", "admin"].includes(role))
    throw new Error("Invalid user role.");
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error("User not found.");
  const user = userSnap.data();
  const updates = {
    role,
    hostApplication: {
      ...(user.hostApplication || {
        businessName: user.name,
        about: "",
      }),
      status: role === "host" ? "approved" : "deactivated",
    },
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.update(userRef, updates);
  const applications = await getDocs(
    query(collection(db, "hostApplication"), where("userId", "==", userId)),
  );
  const latestApplication = applications.docs.sort(
    (a, b) =>
      new Date(b.data().submittedAt?.toDate?.() || b.data().submittedAt || 0) -
      new Date(a.data().submittedAt?.toDate?.() || a.data().submittedAt || 0),
  )[0];
  if (latestApplication)
    batch.update(latestApplication.ref, {
      status: role === "host" ? "approved" : "deactivated",
    });
  await batch.commit();
}

export async function getHostAccounts() {
  await requireAdmin();
  const [users, applications, listings, bookings] = await Promise.all([
    getCollection("users"),
    getCollection("hostApplication"),
    getCollection("listings"),
    getCollection("bookings"),
  ]);
  const accounts = new Map();
  applications.forEach((application) => {
    const existing = accounts.get(application.userId);
    if (
      !existing ||
      new Date(application.submittedAt || 0) >
        new Date(existing.submittedAt || 0)
    )
      accounts.set(application.userId, application);
  });

  return users
    .filter((user) => accounts.has(user.id) || user.hostApplication || user.role === "host")
    .map((user) => {
      const application =
        accounts.get(user.id) ??
        user.hostApplication ??
        (user.role === "host"
          ? {
              status: "approved",
              businessName: user.name,
              about: "",
            }
          : { status: "pending", businessName: user.name, about: "" });
      return {
        ...user,
        application: {
          ...application,
          submittedAt: asISO(application.submittedAt),
        },
        listingCount: listings.filter((listing) => listing.hostId === user.id)
          .length,
        bookingCount: bookings.filter(
          (booking) =>
            booking.hostId === user.id && booking.status !== "pending_payment",
        ).length,
      };
    });
}

export async function reviewHostApplication(userId, decision, note = "") {
  await requireAdmin();
  if (!["approved", "rejected"].includes(decision))
    throw new Error("Invalid decision.");
  const applications = await getDocs(
    query(collection(db, "hostApplication"), where("userId", "==", userId)),
  );
  const application = applications.docs
    .map((snapshot) => ({ ref: snapshot.ref, ...snapshot.data() }))
    .sort(
      (a, b) =>
        new Date(b.submittedAt?.toDate?.() || b.submittedAt || 0) -
        new Date(a.submittedAt?.toDate?.() || a.submittedAt || 0),
    )[0];
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists() || (!application && !userSnap.data().hostApplication))
    throw new Error("Application not found.");

  const batch = writeBatch(db);
  if (application)
    batch.update(application.ref, {
      status: decision,
      note,
      reviewedAt: serverTimestamp(),
    });
  batch.update(userRef, {
    role: decision === "approved" ? "host" : userSnap.data().role,
    hostApplication: {
      ...(userSnap.data().hostApplication || application || {}),
      status: decision,
      note,
    },
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  await pushNotification(
    userId,
    decision === "approved"
      ? {
          type: "host",
          title: "You are now a host!",
          message: "Your application was approved. Create your first listing.",
          link: "/host/listings/new",
        }
      : {
          type: "host",
          title: "Host application declined",
          message:
            note ||
            "Your application was not approved. You can update it and apply again.",
          link: "/become-a-host",
        },
  );
}

export async function setHostActive(userId, active) {
  await requireAdmin();
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists() || userSnap.data().role === "admin")
    throw new Error("Host not found.");
  const user = userSnap.data();
  const nextStatus = active ? "approved" : "deactivated";
  const batch = writeBatch(db);
  batch.update(userRef, {
    role: active ? "host" : "guest",
    hostApplication: {
      ...(user.hostApplication || {}),
      status: nextStatus,
    },
    updatedAt: serverTimestamp(),
  });

  const applications = await getDocs(
    query(collection(db, "hostApplication"), where("userId", "==", userId)),
  );
  applications.docs.forEach((application) =>
    batch.update(application.ref, { status: nextStatus }),
  );
  await batch.commit();

  if (!active) {
    const listings = await getDocs(
      query(
        collection(db, "listings"),
        where("hostId", "==", userId),
        where("status", "==", "published"),
      ),
    );
    for (let offset = 0; offset < listings.docs.length; offset += 450) {
      const listingBatch = writeBatch(db);
      listings.docs.slice(offset, offset + 450).forEach((listing) =>
        listingBatch.update(listing.ref, { status: "suspended" }),
      );
      await listingBatch.commit();
    }
  }

  await pushNotification(
    userId,
    active
      ? {
          type: "host",
          title: "Host account reactivated",
          message:
            "You can host again. Ask an admin to re-approve any hidden listings.",
          link: "/host",
        }
      : {
          type: "host",
          title: "Host account deactivated",
          message:
            "Your host account was deactivated and your listings are hidden. Contact support for help.",
          link: "/",
        },
  );
}

export async function getAllListings() {
  await requireAdmin();
  const [listings, profiles] = await Promise.all([
    getCollection("listings"),
    getCollection("publicProfiles"),
  ]);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return listings.map((listing) => ({
    ...listing,
    hostName: profileById.get(listing.hostId)?.name,
  }));
}

export async function setListingStatus(listingId, status) {
  await requireAdmin();
  if (!["published", "pending", "rejected", "suspended", "unlisted"].includes(status))
    throw new Error("Invalid listing status.");
  const listingRef = doc(db, "listings", listingId);
  const listingSnap = await getDoc(listingRef);
  if (!listingSnap.exists()) throw new Error("Listing not found.");
  const listing = listingSnap.data();
  await updateDoc(listingRef, { status, updatedAt: serverTimestamp() });
  const message = {
    published: ["Listing approved", `"${listing.title}" is now live.`],
    rejected: [
      "Listing rejected",
      `"${listing.title}" was not approved. Edit it and resubmit.`,
    ],
    suspended: [
      "Listing hidden",
      `"${listing.title}" was hidden by an administrator.`,
    ],
  }[status];
  if (message)
    await pushNotification(listing.hostId, {
      type: "listing",
      title: message[0],
      message: message[1],
      link: "/host/listings",
    });
}

export const removeListing = async (listingId, actor) => {
  await requireAdmin();
  if (actor?.id !== auth.currentUser?.uid || actor?.role !== "admin")
    throw new Error("Administrator access required.");
  return deleteListing(listingId, actor);
};

export async function getAllBookings() {
  await requireAdmin();
  const [bookings, listings, profiles] = await Promise.all([
    getCollection("bookings"),
    getCollection("listings"),
    getCollection("publicProfiles"),
  ]);
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return bookings
    .filter((booking) => booking.status !== "pending_payment")
    .map((booking) => ({
      ...booking,
      listingTitle:
        booking.listingSnapshot?.title ??
        listingById.get(booking.listingId)?.title,
      guestName:
        booking.guestSnapshot?.name ??
        profileById.get(booking.guestId)?.name,
      hostName:
        booking.hostSnapshot?.name ??
        profileById.get(booking.hostId)?.name,
    }));
}

export async function getAllPayments() {
  await requireAdmin();
  const [payments, profiles] = await Promise.all([
    getCollection("payments"),
    getCollection("publicProfiles"),
  ]);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return payments.map((payment) => ({
    ...payment,
    guestName:
      payment.guestSnapshot?.name ??
      profileById.get(payment.guestId)?.name,
    hostName:
      payment.hostSnapshot?.name ??
      profileById.get(payment.hostId)?.name,
  }));
}

export async function refundPayment(paymentId) {
  await requireAdmin();
  const paymentRef = doc(db, "payments", paymentId);
  const result = await runTransaction(db, async (transaction) => {
    const paymentSnap = await transaction.get(paymentRef);
    if (!paymentSnap.exists()) throw new Error("Payment not found.");
    const payment = { id: paymentSnap.id, ...paymentSnap.data() };
    if (payment.status !== "succeeded")
      throw new Error("Only successful payments can be refunded.");
    const bookingRef = doc(db, "bookings", payment.bookingId);
    const bookingSnap = await transaction.get(bookingRef);
    const booking = bookingSnap.exists()
      ? { id: bookingSnap.id, ...bookingSnap.data() }
      : null;
    const shouldCancel = booking && booking.status !== "completed";
    const lockRefs = shouldCancel
      ? getStayDates(booking.checkIn, booking.checkOut).map((date) =>
          doc(db, "listings", booking.listingId, "availability", date),
        )
      : [];
    const lockSnaps = await Promise.all(
      lockRefs.map((ref) => transaction.get(ref)),
    );
    transaction.update(paymentRef, {
      status: "refunded",
      refundAmount: payment.amount,
    });
    if (shouldCancel) {
      transaction.update(bookingRef, {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancelledBy: "admin",
        refundAmount: payment.amount,
      });
      lockRefs.forEach((ref, index) => {
        if (
          lockSnaps[index].exists() &&
          lockSnaps[index].data().bookingId === booking.id
        )
          transaction.delete(ref);
      });
    }
    return { booking, cancelled: !!shouldCancel };
  });

  if (result.cancelled)
    await pushNotification(result.booking.guestId, {
      type: "booking",
      title: "Payment refunded",
      message:
        "An administrator refunded your payment and cancelled the reservation.",
      link: `/booking/${result.booking.id}/confirmation`,
    });
}

export async function getAllReviews() {
  await requireAdmin();
  const [reviews, listings, profiles] = await Promise.all([
    getCollection("reviews"),
    getCollection("listings"),
    getCollection("publicProfiles"),
  ]);
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return reviews
    .map((review) => ({
      ...review,
      status: review.status || "visible",
      guestName: profileById.get(review.guestId)?.name,
      listingTitle:
        listingById.get(review.listingId)?.title || "(removed)",
    }))
    .sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );
}

export async function setReviewStatus(reviewId, status) {
  await requireAdmin();
  if (!["visible", "hidden"].includes(status))
    throw new Error("Invalid review status.");
  const reviewRef = doc(db, "reviews", reviewId);
  await runTransaction(db, async (transaction) => {
    const reviewSnap = await transaction.get(reviewRef);
    if (!reviewSnap.exists()) throw new Error("Review not found.");
    const review = { id: reviewSnap.id, ...reviewSnap.data() };
    const wasVisible = isVisible(review);
    const isNowVisible = status === "visible";
    const listingRef = doc(db, "listings", review.listingId);
    const listingSnap = await transaction.get(listingRef);

    transaction.update(reviewRef, {
      status,
      ...(status === "hidden" && review.reported
        ? { "reported.resolved": true }
        : {}),
    });
    if (listingSnap.exists() && wasVisible !== isNowVisible) {
      const listing = { id: listingSnap.id, ...listingSnap.data() };
      applyReviewDelta(listing, review.rating, isNowVisible ? 1 : -1);
      transaction.update(listingRef, {
        rating: listing.rating,
        reviewCount: listing.reviewCount,
      });
    }
  });
}

export async function deleteReview(reviewId) {
  await requireAdmin();
  const reviewRef = doc(db, "reviews", reviewId);
  await runTransaction(db, async (transaction) => {
    const reviewSnap = await transaction.get(reviewRef);
    if (!reviewSnap.exists()) return;
    const review = reviewSnap.data();
    const listingRef = doc(db, "listings", review.listingId);
    const listingSnap = await transaction.get(listingRef);
    if (listingSnap.exists() && isVisible(review)) {
      const listing = { id: listingSnap.id, ...listingSnap.data() };
      applyReviewDelta(listing, review.rating, -1);
      transaction.update(listingRef, {
        rating: listing.rating,
        reviewCount: listing.reviewCount,
      });
    }
    transaction.delete(reviewRef);
  });
}

export async function dismissReport(reviewId) {
  await requireAdmin();
  const reviewRef = doc(db, "reviews", reviewId);
  const reviewSnap = await getDoc(reviewRef);
  if (!reviewSnap.exists()) return;
  await updateDoc(reviewRef, { reported: deleteField() });
}
