// FIREBASE: Firestore collection 'notifications' { userId, type, title, message, link, read, createdAt }
//   notify*    -> addDoc from a Cloud Function (triggered by booking / listing changes)
//   getNotifications -> onSnapshot(query(collection(db,'notifications'), where('userId','==',uid), orderBy('createdAt','desc')))
import { getDb, save, delay, genId, clone } from "./db.js";

// Internal helper used by other services. Synchronous so it can run inside their transactions.
export function pushNotification(
  userId,
  { type = "info", title, message, link = "" },
) {
  if (!userId) return;
  getDb().notifications.unshift({
    id: genId("n"),
    userId,
    type,
    title,
    message,
    link,
    read: false,
    createdAt: new Date().toISOString(),
  });
  save();
}

export const notifyAdmins = (payload) =>
  getDb()
    .users.filter((u) => u.role === "admin")
    .forEach((a) => pushNotification(a.id, { type: "admin", ...payload }));

export async function getNotifications(userId) {
  await delay(80);
  return clone(
    getDb()
      .notifications.filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  );
}

export async function getUnreadCount(userId) {
  return getDb().notifications.filter((n) => n.userId === userId && !n.read)
    .length;
}

// Live feed for the bell. cb({ count, items }) fires immediately and on every change; returns an unsubscribe fn.
// FIREBASE: onSnapshot(query(collection(db,'notifications'), where('userId','==',userId), orderBy('createdAt','desc'), limit(50)),
//   (snap) => { const items = snap.docs.map(d => ({ id: d.id, ...d.data() })); cb({ count: items.filter(n => !n.read).length, items }); })
//   and return that onSnapshot's unsubscribe.
export function subscribeNotifications(userId, cb) {
  const push = async () => {
    const items = await getNotifications(userId);
    cb({ count: items.filter((n) => !n.read).length, items });
  };
  push();
  const t = setInterval(push, 4000); // local demo polling only
  return () => clearInterval(t);
}

export async function markRead(id) {
  const n = getDb().notifications.find((x) => x.id === id);
  if (n) {
    n.read = true;
    save();
  }
}

export async function markAllRead(userId) {
  getDb().notifications.forEach((n) => {
    if (n.userId === userId) n.read = true;
  });
  save();
}

export async function deleteNotification(id) {
  const db = getDb();
  db.notifications = db.notifications.filter((n) => n.id !== id);
  save();
}
