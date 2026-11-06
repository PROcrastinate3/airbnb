import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { db } from "../firebase.js";

const SETTINGS_REF = doc(db, "settings", "platform");
let cache = null;

const copySettings = (settings) => ({
  ...settings,
  categories: (settings.categories || []).map((category) => ({ ...category })),
});

export async function loadSettings() {
  const snapshot = await getDoc(SETTINGS_REF);
  if (!snapshot.exists())
    throw new Error(
      "Platform settings were not found. Create /settings/platform in Firestore.",
    );
  const data = snapshot.data();
  if (
    !Number.isFinite(data.serviceFeeRate) ||
    !Array.isArray(data.categories)
  )
    throw new Error("Platform settings have an invalid format.");
  cache = copySettings(data);
  return getSettings();
}

const need = () => {
  if (!cache)
    throw new Error(
      "Settings not loaded yet. Wrap the app in <SettingsProvider>.",
    );
  return cache;
};

export const getSettings = () => copySettings(need());
export const getServiceFeeRate = () => need().serviceFeeRate;
export const getCategories = ({ withAll = true } = {}) => {
  const categories = need().categories.map((category) => ({ ...category }));
  return withAll
    ? [{ id: "all", label: "All", icon: "✨" }, ...categories]
    : categories;
};

const updateSettings = async (update) => {
  const updated = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(SETTINGS_REF);
    if (!snapshot.exists())
      throw new Error(
        "Platform settings were not found. Create /settings/platform in Firestore.",
      );
    const current = snapshot.data();
    if (
      !Number.isFinite(current.serviceFeeRate) ||
      !Array.isArray(current.categories)
    )
      throw new Error("Platform settings have an invalid format.");
    const next = update(copySettings(current));
    transaction.update(SETTINGS_REF, next);
    return { ...current, ...next };
  });
  cache = copySettings(updated);
};

export async function updateServiceFee(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value) || value < 0 || value > 0.5)
    throw new Error("Service fee must be between 0% and 50%.");
  await updateSettings(() => ({ serviceFeeRate: Number(value.toFixed(4)) }));
}

const slug = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export async function addCategory({ label, icon }) {
  const categoryLabel = label?.trim() || "";
  const id = slug(categoryLabel);
  if (!id) throw new Error("Enter a category name.");
  if (id === "all") throw new Error("That category already exists.");
  await updateSettings((settings) => {
    if (settings.categories.some((category) => category.id === id))
      throw new Error("That category already exists.");
    return {
      categories: [
        ...settings.categories,
        { id, label: categoryLabel, icon: icon?.trim() || "🏠" },
      ],
    };
  });
}

export async function updateCategory(id, { label, icon }) {
  const categoryLabel = label?.trim() || "";
  if (!categoryLabel) throw new Error("Enter a category name.");
  await updateSettings((settings) => {
    const category = settings.categories.find((entry) => entry.id === id);
    if (!category) throw new Error("Category not found.");
    return {
      categories: settings.categories.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              label: categoryLabel,
              icon: icon?.trim() || entry.icon,
            }
          : entry,
      ),
    };
  });
}

export async function removeCategory(id) {
  const listings = await getDocs(
    query(collection(db, "listings"), where("category", "==", id)),
  );
  if (!listings.empty)
    throw new Error(
      `${listings.size} listing(s) use this category. Move them to another category first.`,
    );
  await updateSettings((settings) => {
    if (!settings.categories.some((category) => category.id === id))
      throw new Error("Category not found.");
    return {
      categories: settings.categories.filter((category) => category.id !== id),
    };
  });
}
