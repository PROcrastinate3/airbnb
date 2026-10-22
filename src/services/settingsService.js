// FIREBASE: single doc /settings/platform  { serviceFeeRate, categories[] }
// Settings are read synchronously while rendering (categories, fee in price previews), so they live in
// a module-level cache that <SettingsProvider> fills ONCE at app start via loadSettings().
// With Firestore: loadSettings = async () => { const snap = await getDoc(doc(db,'settings','platform')); cache = snap.data(); }
// (or onSnapshot to keep it live). Every write below must update Firestore AND `cache`.
// Public-read rule is required: the landing page needs categories before login.
import { getDb, save, delay, clone } from "./db.js";

let cache = null;

export async function loadSettings() {
  await delay(50);
  cache = clone(getDb().settings);
  return cache;
}

const need = () => {
  if (!cache) throw new Error("Settings not loaded yet. Wrap the app in <SettingsProvider>.");
  return cache;
};

export const getSettings = () => need();
export const getServiceFeeRate = () => need().serviceFeeRate;
export const getCategories = ({ withAll = true } = {}) => {
  const cats = need().categories;
  return withAll ? [{ id: "all", label: "All", icon: "✨" }, ...cats] : cats;
};

// local-demo only: persist cache back to the mock db
const persist = () => {
  getDb().settings = clone(cache);
  save();
};

export async function updateServiceFee(rate) {
  await delay();
  const n = Number(rate);
  if (!Number.isFinite(n) || n < 0 || n > 0.5)
    throw new Error("Service fee must be between 0% and 50%.");
  need().serviceFeeRate = Number(n.toFixed(4));
  persist();
}

const slug = (s) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export async function addCategory({ label, icon }) {
  await delay();
  const cats = need().categories;
  const id = slug(label || "");
  if (!id) throw new Error("Enter a category name.");
  if (id === "all" || cats.some((c) => c.id === id))
    throw new Error("That category already exists.");
  cats.push({ id, label: label.trim(), icon: icon?.trim() || "🏠" });
  persist();
}

export async function updateCategory(id, { label, icon }) {
  await delay();
  const c = need().categories.find((x) => x.id === id);
  if (!c) throw new Error("Category not found.");
  if (!label?.trim()) throw new Error("Enter a category name.");
  c.label = label.trim();
  c.icon = icon?.trim() || c.icon;
  persist();
}

export async function removeCategory(id) {
  await delay();
  const db = getDb();
  const used = db.listings.filter((l) => l.category === id).length;
  if (used)
    throw new Error(
      `${used} listing(s) use this category. Move them to another category first.`,
    );
  cache.categories = cache.categories.filter((c) => c.id !== id);
  persist();
}
