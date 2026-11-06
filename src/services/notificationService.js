import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";

const notificationsRef = collection(db, "notifications");

const requireOwnUser = (userId) => {
  if (!auth.currentUser || auth.currentUser.uid !== userId)
    throw new Error("You can only access your own notifications.");
};

const requireAdmin = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("Administrator access required.");
  const userSnapshot = await getDoc(doc(db, "users", user.uid));
  if (!userSnapshot.exists() || userSnapshot.data().role !== "admin")
    throw new Error(
      "Only administrators can create notifications directly. Event notifications require a trusted backend.",
    );
  return user;
};

const toNotification = (snapshot) => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt,
  };
};

const notificationData = ({ type = "info", title, message, link = "" }) => {
  if (typeof title !== "string" || typeof message !== "string")
    throw new Error("A notification requires a title and message.");
  return {
    type,
    title,
    message,
    link,
    read: false,
    createdAt: serverTimestamp(),
  };
};

export async function pushNotification(userId, payload) {
  if (!userId) throw new Error("A notification recipient is required.");
  await requireAdmin();
  const ref = await addDoc(notificationsRef, {
    userId,
    ...notificationData(payload),
  });
  return ref.id;
}

export async function notifyAdmins(payload) {
  await requireAdmin();
  const admins = await getDocs(
    query(collection(db, "users"), where("role", "==", "admin")),
  );
  const recipients = admins.docs.map((snapshot) => snapshot.id);
  const data = notificationData({ type: "admin", ...payload });

  for (let index = 0; index < recipients.length; index += 500) {
    const batch = writeBatch(db);
    recipients.slice(index, index + 500).forEach((userId) => {
      batch.set(doc(notificationsRef), { userId, ...data });
    });
    await batch.commit();
  }
}

export async function getNotifications(userId) {
  requireOwnUser(userId);
  const snapshot = await getDocs(
    query(
      notificationsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs.map(toNotification);
}

export async function getUnreadCount(userId) {
  requireOwnUser(userId);
  const snapshot = await getDocs(
    query(
      notificationsRef,
      where("userId", "==", userId),
      where("read", "==", false),
    ),
  );
  return snapshot.size;
}

export function subscribeNotifications(userId, callback) {
  requireOwnUser(userId);
  if (typeof callback !== "function")
    throw new Error("A notification callback is required.");

  return onSnapshot(
    query(
      notificationsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(50),
    ),
    (snapshot) => {
      const items = snapshot.docs.map(toNotification);
      callback({
        count: items.filter((notification) => !notification.read).length,
        items,
      });
    },
    (error) => {
      console.error("Failed to subscribe to notifications:", error);
    },
  );
}

export async function markRead(id) {
  if (!id) throw new Error("A notification ID is required.");
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export async function markAllRead(userId) {
  requireOwnUser(userId);
  const snapshot = await getDocs(
    query(
      notificationsRef,
      where("userId", "==", userId),
      where("read", "==", false),
    ),
  );
  const unread = snapshot.docs;

  for (let index = 0; index < unread.length; index += 500) {
    const batch = writeBatch(db);
    unread.slice(index, index + 500).forEach((notification) => {
      batch.update(notification.ref, { read: true });
    });
    await batch.commit();
  }
}

export async function deleteNotification(id) {
  if (!id) throw new Error("A notification ID is required.");
  await deleteDoc(doc(db, "notifications", id));
}
