// FIREBASE: admin operations should go through Cloud Functions / security rules that check
// request.auth.token.role == 'admin' (set via custom claims: admin.auth().setCustomUserClaims).
import { getDb, save, delay, clone } from "./db.js";
import { pushNotification } from "./notificationService.js";
import { deleteListing } from "./listingService.js";
import { applyReviewDelta, isVisible } from "./rules.js";

const requireAdmin = (actor) => {
  if (actor?.role !== "admin")
    throw new Error("Administrator access required.");
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

export async function getAdminStats() {
  await delay();
  const db = getDb();
  const paid = db.payments.filter((p) =>
    ["succeeded", "partially_refunded"].includes(p.status),
  );
  const revenue = paid.reduce(
    (s, p) => s + p.amount - (p.refundAmount || 0),
    0,
  );
  const platformFees = db.bookings
    .filter((b) => ["confirmed", "completed"].includes(b.status))
    .reduce((s, b) => s + b.serviceFee, 0);

  const months = monthsBack(6);
  paid.forEach((p) => {
    const m = months.find((x) => p.createdAt.startsWith(x.key));
    if (m) m.value += p.amount - (p.refundAmount || 0);
  });

  return clone({
    users: db.users.length,
    guests: db.users.filter((u) => u.role === "guest").length,
    hosts: db.users.filter((u) => u.role === "host").length,
    listings: db.listings.length,
    publishedListings: db.listings.filter((l) => l.status === "published")
      .length,
    pendingListings: db.listings.filter((l) => l.status === "pending").length,
    pendingHosts: db.users.filter(
      (u) => u.hostApplication?.status === "pending",
    ).length,
    reportedReviews: db.reviews.filter((r) => r.reported && isVisible(r))
      .length,
    bookings: db.bookings.filter((b) => b.status !== "pending_payment").length,
    revenue,
    platformFees,
    months,
    recentBookings: db.bookings
      .filter((b) => b.status !== "pending_payment")
      .slice(0, 5)
      .map((b) => ({
        ...b,
        listingTitle: db.listings.find((l) => l.id === b.listingId)?.title,
        guestName: db.users.find((u) => u.id === b.guestId)?.name,
      })),
  });
}

// ---- Reports & analytics ---------------------------------------------------------
export async function getAnalytics(rangeMonths = 6) {
  await delay();
  const db = getDb();
  const months = monthsBack(rangeMonths);
  const keys = new Set(months.map((m) => m.key));
  const real = db.bookings.filter((b) => b.status !== "pending_payment");
  const inRange = real.filter((b) => keys.has(b.createdAt.slice(0, 7)));

  const bookingsByMonth = months.map((m) => ({
    ...m,
    value: inRange.filter((b) => b.createdAt.startsWith(m.key)).length,
  }));
  const revenueByMonth = months.map((m) => ({
    ...m,
    value: inRange
      .filter(
        (b) =>
          b.createdAt.startsWith(m.key) &&
          ["confirmed", "completed"].includes(b.status),
      )
      .reduce((s, b) => s + b.total, 0),
  }));
  const usersByMonth = months.map((m) => ({
    ...m,
    value: db.users.filter((u) => u.createdAt.startsWith(m.key)).length,
  }));

  const statusCounts = ["pending", "confirmed", "completed", "cancelled"].map(
    (s) => ({
      key: s,
      label: s,
      value: inRange.filter((b) => b.status === s).length,
    }),
  );
  const earning = inRange.filter((b) =>
    ["confirmed", "completed"].includes(b.status),
  );
  const revenue = earning.reduce((s, b) => s + b.total, 0);
  const fees = earning.reduce((s, b) => s + b.serviceFee, 0);

  const byListing = {};
  earning.forEach((b) => {
    byListing[b.listingId] ??= { bookings: 0, revenue: 0, nights: 0 };
    byListing[b.listingId].bookings += 1;
    byListing[b.listingId].revenue += b.total;
    byListing[b.listingId].nights += b.nights;
  });
  const topListings = Object.entries(byListing)
    .map(([id, v]) => ({
      id,
      ...v,
      title: db.listings.find((l) => l.id === id)?.title || "(removed)",
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const byCategory = {};
  earning.forEach((b) => {
    const cat =
      db.listings.find((l) => l.id === b.listingId)?.category || "other";
    byCategory[cat] ??= { category: cat, bookings: 0, revenue: 0 };
    byCategory[cat].bookings += 1;
    byCategory[cat].revenue += b.total;
  });
  const catLabel = (id) =>
    db.settings.categories.find((c) => c.id === id)?.label || id;

  return clone({
    totals: {
      bookings: inRange.length,
      revenue,
      fees,
      avgBooking: earning.length ? revenue / earning.length : 0,
      cancellationRate: inRange.length
        ? (inRange.filter((b) => b.status === "cancelled").length /
            inRange.length) *
          100
        : 0,
      newUsers: usersByMonth.reduce((s, m) => s + m.value, 0),
      nights: earning.reduce((s, b) => s + b.nights, 0),
    },
    bookingsByMonth,
    revenueByMonth,
    usersByMonth,
    statusCounts,
    topListings,
    byCategory: Object.values(byCategory)
      .map((c) => ({ ...c, label: catLabel(c.category) }))
      .sort((a, b) => b.revenue - a.revenue),
  });
}

// ---- Users --------------------------------------------------------------------------
export async function getAllUsers() {
  await delay();
  return clone(getDb().users.map(({ password, ...u }) => u));
}

export async function setUserStatus(userId, status) {
  await delay();
  const u = getDb().users.find((x) => x.id === userId);
  if (!u) throw new Error("User not found.");
  if (u.role === "admin") throw new Error("Cannot change an admin account.");
  u.status = status;
  save();
}

export async function updateUserDetails(userId, { name, phone, bio }) {
  await delay();
  const u = getDb().users.find((x) => x.id === userId);
  if (!u) throw new Error("User not found.");
  if (!name?.trim()) throw new Error("Name cannot be empty.");
  Object.assign(u, {
    name: name.trim(),
    phone: phone ?? u.phone,
    bio: bio ?? u.bio,
  });
  save();
}

export async function setUserRole(userId, role) {
  await delay();
  const u = getDb().users.find((x) => x.id === userId);
  if (!u) throw new Error("User not found.");
  u.role = role;
  if (role === "host")
    u.hostApplication = {
      ...(u.hostApplication || { businessName: u.name, about: "" }),
      status: "approved",
    };
  save();
}

// ---- Host management ----------------------------------------------------------------
export async function getHostAccounts() {
  await delay();
  const db = getDb();
  return clone(
    db.users
      .filter((u) => u.hostApplication || u.role === "host")
      .map(({ password, ...u }) => ({
        ...u,
        application: u.hostApplication || {
          status: "approved",
          businessName: u.name,
          about: "",
        },
        listingCount: db.listings.filter((l) => l.hostId === u.id).length,
        bookingCount: db.bookings.filter(
          (b) => b.hostId === u.id && b.status !== "pending_payment",
        ).length,
      })),
  );
}

export async function reviewHostApplication(userId, decision, note = "") {
  await delay();
  const u = getDb().users.find((x) => x.id === userId);
  if (!u || !u.hostApplication) throw new Error("Application not found.");
  if (!["approved", "rejected"].includes(decision))
    throw new Error("Invalid decision.");
  u.hostApplication.status = decision;
  u.hostApplication.note = note;
  if (decision === "approved") u.role = "host";
  pushNotification(
    u.id,
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
  save();
}

// Deactivate: back to guest and hide all of the host's published listings.
export async function setHostActive(userId, active) {
  await delay();
  const db = getDb();
  const u = db.users.find((x) => x.id === userId);
  if (!u || u.role === "admin") throw new Error("Host not found.");
  if (active) {
    u.role = "host";
    u.hostApplication = { ...(u.hostApplication || {}), status: "approved" };
    pushNotification(u.id, {
      type: "host",
      title: "Host account reactivated",
      message:
        "You can host again. Ask an admin to re-approve any hidden listings.",
      link: "/host",
    });
  } else {
    u.role = "guest";
    u.hostApplication = { ...(u.hostApplication || {}), status: "deactivated" };
    db.listings
      .filter((l) => l.hostId === u.id && l.status === "published")
      .forEach((l) => {
        l.status = "suspended";
      });
    pushNotification(u.id, {
      type: "host",
      title: "Host account deactivated",
      message:
        "Your host account was deactivated and your listings are hidden. Contact support for help.",
      link: "/",
    });
  }
  save();
}

// ---- Listings ------------------------------------------------------------------------
export async function getAllListings() {
  await delay();
  const db = getDb();
  return clone(
    db.listings.map((l) => ({
      ...l,
      hostName: db.users.find((u) => u.id === l.hostId)?.name,
    })),
  );
}

export async function setListingStatus(listingId, status) {
  await delay();
  const l = getDb().listings.find((x) => x.id === listingId);
  if (!l) throw new Error("Listing not found.");
  l.status = status; // 'published' | 'pending' | 'rejected' | 'suspended'
  const msg = {
    published: ["Listing approved", `"${l.title}" is now live.`],
    rejected: [
      "Listing rejected",
      `"${l.title}" was not approved. Edit it and resubmit.`,
    ],
    suspended: [
      "Listing hidden",
      `"${l.title}" was hidden by an administrator.`,
    ],
  }[status];
  if (msg)
    pushNotification(l.hostId, {
      type: "listing",
      title: msg[0],
      message: msg[1],
      link: "/host/listings",
    });
  save();
}

export const removeListing = (listingId, actor) => {
  requireAdmin(actor);
  return deleteListing(listingId, actor);
};

// ---- Bookings & payments -----------------------------------------------------------
export async function getAllBookings() {
  await delay();
  const db = getDb();
  return clone(
    db.bookings
      .filter((b) => b.status !== "pending_payment")
      .map((b) => ({
        ...b,
        listingTitle: db.listings.find((l) => l.id === b.listingId)?.title,
        guestName: db.users.find((u) => u.id === b.guestId)?.name,
        hostName: db.users.find((u) => u.id === b.hostId)?.name,
      })),
  );
}

export async function getAllPayments() {
  await delay();
  const db = getDb();
  return clone(
    db.payments.map((p) => ({
      ...p,
      guestName: db.users.find((u) => u.id === p.guestId)?.name,
      hostName: db.users.find((u) => u.id === p.hostId)?.name,
    })),
  );
}

// FIREBASE/STRIPE: call stripe.refunds.create({ payment_intent }) from a Cloud Function
export async function refundPayment(paymentId) {
  await delay(500);
  const db = getDb();
  const p = db.payments.find((x) => x.id === paymentId);
  if (!p) throw new Error("Payment not found.");
  if (p.status !== "succeeded")
    throw new Error("Only successful payments can be refunded.");
  p.status = "refunded";
  p.refundAmount = p.amount;
  const b = db.bookings.find((x) => x.id === p.bookingId);
  if (b && b.status !== "completed") {
    b.status = "cancelled";
    b.refundAmount = p.amount;
    pushNotification(b.guestId, {
      type: "booking",
      title: "Payment refunded",
      message:
        "An administrator refunded your payment and cancelled the reservation.",
      link: `/booking/${b.id}/confirmation`,
    });
  }
  save();
}

// ---- Review moderation ------------------------------------------------------------
export async function getAllReviews() {
  await delay();
  const db = getDb();
  return clone(
    db.reviews
      .map((r) => ({
        ...r,
        status: r.status || "visible",
        guestName: db.users.find((u) => u.id === r.guestId)?.name,
        listingTitle:
          db.listings.find((l) => l.id === r.listingId)?.title || "(removed)",
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  );
}

export async function setReviewStatus(reviewId, status) {
  await delay();
  const db = getDb();
  const r = db.reviews.find((x) => x.id === reviewId);
  if (!r) throw new Error("Review not found.");
  const was = isVisible(r);
  r.status = status;
  const now = isVisible(r);
  const listing = db.listings.find((l) => l.id === r.listingId);
  if (listing && was !== now)
    applyReviewDelta(listing, r.rating, now ? +1 : -1);
  if (status === "hidden" && r.reported) r.reported.resolved = true;
  save();
}

export async function deleteReview(reviewId) {
  await delay();
  const db = getDb();
  const r = db.reviews.find((x) => x.id === reviewId);
  if (!r) return;
  const listing = db.listings.find((l) => l.id === r.listingId);
  if (listing && isVisible(r)) applyReviewDelta(listing, r.rating, -1);
  db.reviews = db.reviews.filter((x) => x.id !== reviewId);
  save();
}

export async function dismissReport(reviewId) {
  await delay();
  const r = getDb().reviews.find((x) => x.id === reviewId);
  if (r) {
    delete r.reported;
    save();
  }
}
