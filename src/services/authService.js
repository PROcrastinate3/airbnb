// FIREBASE: replace with firebase/auth
//   signIn  -> signInWithEmailAndPassword(auth, email, password) + getDoc(doc(db,'users',uid))
//   signUp  -> createUserWithEmailAndPassword + setDoc(doc(db,'users',uid), {...})
//   signOut -> signOut(auth)
//   session -> onAuthStateChanged(auth, cb)   (see AuthContext.jsx)
import { getDb, save, delay, genId, clone } from "./db.js";
import { notifyAdmins, pushNotification } from "./notificationService.js";

const SESSION_KEY = "staybnb_session"; // local demo only — Firebase Auth persists the session itself

// Auth state listener. cb(user|null) fires once on startup and again on every sign in / up / out.
// FIREBASE: replace with
//   onAuthStateChanged(auth, async (fb) => cb(fb ? await getUser(fb.uid) : null))   // returns the unsubscribe fn
const listeners = new Set();
const emit = (u) => listeners.forEach((cb) => cb(u));
export function onAuthChange(cb) {
  listeners.add(cb);
  restoreSession().then(cb);
  return () => listeners.delete(cb);
}

const safe = (u) => {
  if (!u) return null;
  const { password, ...rest } = u;
  return clone(rest);
};

export async function signIn(email, password) {
  await delay();
  const user = getDb().users.find(
    (u) =>
      u.email.toLowerCase() === email.trim().toLowerCase() &&
      u.password === password,
  );
  if (!user) throw new Error("Invalid email or password.");
  if (user.status === "suspended")
    throw new Error("This account has been suspended.");
  localStorage.setItem(SESSION_KEY, user.id);
  emit(safe(user));
  return safe(user);
}

export async function signUp({ name, email, password, role = "guest" }) {
  await delay();
  const db = getDb();
  if (
    db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  ) {
    throw new Error("An account with this email already exists.");
  }
  if (password.length < 6)
    throw new Error("Password must be at least 6 characters.");
  const user = {
    id: genId("u"),
    name: name.trim(),
    email: email.trim(),
    password,
    role: "guest", // choosing "host" at sign-up only starts the host application (see applyAsHost)
    avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`,
    createdAt: new Date().toISOString(),
    status: "active",
    bio: "",
    phone: "",
  };
  db.users.push(user);
  pushNotification(user.id, {
    type: "info",
    title: "Welcome to Staybnb",
    message:
      role === "host"
        ? "Finish your host application to start listing your place."
        : "Find your next stay and book it in minutes.",
    link: role === "host" ? "/become-a-host" : "/search",
  });
  save();
  localStorage.setItem(SESSION_KEY, user.id);
  emit(safe(user));
  return { ...safe(user), wantsHost: role === "host" };
}

export async function signOut() {
  await delay(100);
  localStorage.removeItem(SESSION_KEY);
  emit(null);
}

// FIREBASE: not needed — use onAuthChange / auth.currentUser. refreshUser() can call getUser(auth.currentUser.uid).
export async function restoreSession() {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const user = getDb().users.find((u) => u.id === id);
  return user && user.status !== "suspended" ? safe(user) : null;
}

// FIREBASE: updateDoc(doc(db,'users',uid), data)
export async function updateProfile(userId, data) {
  await delay();
  const user = getDb().users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found.");
  const { name, bio, phone, avatar } = data;
  Object.assign(user, {
    name: name ?? user.name,
    bio: bio ?? user.bio,
    phone: phone ?? user.phone,
    avatar: avatar || user.avatar,
  });
  if (data.businessName !== undefined && user.hostApplication)
    user.hostApplication.businessName = data.businessName;
  save();
  return safe(user);
}

// Host registration: a guest APPLIES to become a host; an admin approves it (Admin > Hosts).
export async function applyAsHost(userId, { businessName, phone, about }) {
  await delay();
  const user = getDb().users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found.");
  if (user.role === "host" || user.role === "admin")
    throw new Error("You are already a host.");
  if (user.hostApplication?.status === "pending")
    throw new Error("Your application is already under review.");
  if (!businessName?.trim()) throw new Error("Enter a host or business name.");
  if (!about?.trim()) throw new Error("Tell us a little about your property.");
  user.hostApplication = {
    status: "pending",
    businessName: businessName.trim(),
    about: about.trim(),
    submittedAt: new Date().toISOString(),
  };
  if (phone?.trim()) user.phone = phone.trim();
  notifyAdmins({
    title: "Host application waiting",
    message: `${user.name} applied to become a host.`,
    link: "/admin/hosts",
  });
  save();
  return safe(user);
}

export async function changePassword(userId, current, next) {
  await delay();
  const user = getDb().users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found.");
  if (user.password !== current)
    throw new Error("Current password is incorrect.");
  if (!next || next.length < 6)
    throw new Error("New password must be at least 6 characters.");
  user.password = next;
  save();
}

// FIREBASE: getDoc(doc(db,'users',id))
export async function getUser(id) {
  await delay(50);
  return safe(getDb().users.find((u) => u.id === id));
}
