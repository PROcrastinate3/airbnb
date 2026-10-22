// ============================================================================
// db.js — tiny in-memory "database" persisted to localStorage.
// This is the ONLY file that knows data lives locally. When migrating to
// Firebase, delete this file and rewrite the functions in /services to call
// Firestore (see the "FIREBASE:" comments next to each service function).
// ============================================================================
import * as seed from "../data/mockData.js";
import { withListingDefaults } from "./rules.js";

// Bump this whenever the shape of mockData changes so browsers drop their stale cached copy.
const KEY = "staybnb_db_v3";

const seedData = () => ({
  users: seed.users,
  // l_5 is a request-to-book listing so the host "accept / decline" flow can be demoed.
  listings: seed.listings.map((l) =>
    withListingDefaults({ ...l, instantBook: l.id !== "l_5" }),
  ),
  bookings: seed.bookings,
  payments: seed.payments,
  reviews: seed.reviews,
  wishlists: seed.wishlists,
  notifications: seed.notifications,
  settings: {
    serviceFeeRate: seed.SERVICE_FEE_RATE,
    categories: seed.CATEGORIES.filter((c) => c.id !== "all"),
  },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return JSON.parse(JSON.stringify(seedData()));
}

let db = load();

export const getDb = () => db;

export const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
};

export const resetDb = () => {
  db = JSON.parse(JSON.stringify(seedData()));
  save();
};

// Simulates network latency so loading states are visible while developing.
export const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export const genId = (prefix) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

export const clone = (v) => JSON.parse(JSON.stringify(v));
