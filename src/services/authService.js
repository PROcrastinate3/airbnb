// FIREBASE: replace with firebase/auth
//   signIn  -> signInWithEmailAndPassword(auth, email, password) + getDoc(doc(db,'users',uid))
//   signUp  -> createUserWithEmailAndPassword + setDoc(doc(db,'users',uid), {...})
//   signOut -> signOut(auth)
//   session -> onAuthStateChanged(auth, cb)   (see AuthContext.jsx)
import { getDb, save, delay, genId, clone } from "./db.js";
import {
  createUserWithEmailAndPassword,
  updateProfile as updateAuthProfile,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
const SESSION_KEY = "staybnb_session"; // local demo only — Firebase Auth persists the session itself

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    try {
      const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));

      if (!userSnap.exists()) {
        callback(null);
        return;
      }

      const user = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        ...userSnap.data(),
      };

      if (user.status === "suspended") {
        callback(null);
        return;
      }

      callback(user);
    } catch (error) {
      console.error("Failed to restore authentication:", error);
      callback(null);
    }
  });
}

export async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password,
  );

  const firebaseUser = credential.user;

  const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));

  if (!userSnap.exists()) {
    await signOut(auth);
    throw new Error("User profile not found.");
  }

  const user = {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    ...userSnap.data(),
  };

  if (user.status === "suspended") {
    await signOut(auth);
    throw new Error("This account has been suspended.");
  }

  return user;
}

export async function signUp({ name, email, password, role = "guest" }) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error("Name is required.");
  }

  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  // 1. Create Firebase Authentication account
  const credential = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    password,
  );

  const user = credential.user;

  try {
    // 2. Update Firebase Auth profile
    const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(normalizedEmail)}`;
    await updateAuthProfile(user, {
      //this is aliased firebase update profile
      displayName: normalizedName,
      photoURL: avatar,
    });
    // 3. Prepare Firestore user document
    const userData = {
      id: user.uid,
      uid: user.uid,
      name: normalizedName,
      email: normalizedEmail,
      role: "guest",
      status: "active",
      avatar,
      bio: "",
      phone: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // 4. Create Firestore profile
    console.log("Authenticated UID:", auth.currentUser?.uid);
    console.log("Document UID:", user.uid);
    console.log("Firestore project:", db.app.options.projectId);
    console.log("User data:", userData);
    try {
      await setDoc(doc(db, "users", user.uid), userData);
      await setDoc(doc(db, "publicProfiles", user.uid), {
        name: normalizedName,
        avatar,
        bio: "",
        createdAt: serverTimestamp(),
      });
      console.log("Firestore write successful!");
    } catch (error) {
      console.error("Firestore write failed!");
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      throw error;
    }
    return {
      uid: user.uid,
      name: normalizedName,
      email: normalizedEmail,
      role: "guest",
      status: "active",
      avatar,
      bio: "",
      phone: "",
      wantsHost: role === "host",
    };
  } catch (error) {
    // Roll back Auth account if profile creation fails
    try {
      await deleteUser(user);
    } catch (rollbackError) {
      console.error("Failed to roll back account:", rollbackError);
    }

    throw error;
  }
}

// FIREBASE: not needed — use onAuthChange / auth.currentUser. refreshUser() can call getUser(auth.currentUser.uid).
{
  /*export async function restoreSession() {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const user = getDb().users.find((u) => u.id === id);
  return user && user.status !== "suspended" ? safe(user) : null;
}*/
}

// FIREBASE: updateDoc(doc(db,'users',uid), data)
export async function updateProfile(userId, data) {
  const userRef = doc(db, "users", userId);

  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error("User not found.");
  }

  const updates = {
    updatedAt: serverTimestamp(),
  };

  const { name, bio, phone, avatar, businessName } = data;

  if (name !== undefined) updates.name = name;
  if (bio !== undefined) updates.bio = bio;
  if (phone !== undefined) updates.phone = phone;
  if (avatar !== undefined) updates.avatar = avatar;

  if (businessName !== undefined && userSnap.data().hostApplication) {
    updates["hostApplication.businessName"] = businessName;
  }

  await updateDoc(userRef, updates);

  await setDoc(
    doc(db, "publicProfiles", userId),
    {
      name: name ?? userSnap.data().name ?? "",
      avatar: avatar ?? userSnap.data().avatar ?? "",
      bio: bio ?? userSnap.data().bio ?? "",
      createdAt: userSnap.data().createdAt ?? serverTimestamp(),
    },
    { merge: true },
  );

  return await getUser(userId);
}

// Host registration: a guest APPLIES to become a host; an admin approves it (Admin > Hosts).
export async function applyAsHost(userId, { businessName, phone, about }) {
  if (!businessName?.trim()) {
    throw new Error("Enter a host or business name.");
  }

  if (!about?.trim()) {
    throw new Error("Tell us a little about your property.");
  }

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error("User not found.");
  }

  const user = userSnap.data();

  if (user.role === "host" || user.role === "admin") {
    throw new Error("You are already a host.");
  }

  const applicationsRef = collection(db, "hostApplication");

  const existing = await getDocs(
    query(applicationsRef, where("userId", "==", userId)),
  );

  if (existing.docs.some((item) => item.data().status === "pending")) {
    throw new Error("Your application is already under review.");
  }

  await addDoc(applicationsRef, {
    userId,
    status: "pending",
    businessName: businessName.trim(),
    about: about.trim(),
    note: "",
    submittedAt: serverTimestamp(),
  });

  if (phone?.trim()) {
    await updateDoc(userRef, {
      phone: phone.trim(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function changePassword(userId, current, next) {
  const user = auth.currentUser;

  if (!user || user.uid !== userId) {
    throw new Error("User not found.");
  }

  if (!current) {
    throw new Error("Enter your current password.");
  }

  if (!next || next.length < 6) {
    throw new Error("New password must be at least 6 characters.");
  }

  if (current === next) {
    throw new Error(
      "New password must be different from your current password.",
    );
  }

  const credential = EmailAuthProvider.credential(user.email, current);

  try {
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, next);
  } catch (error) {
    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password"
    ) {
      throw new Error("Current password is incorrect.");
    }

    if (error.code === "auth/weak-password") {
      throw new Error("Password is too weak.");
    }

    if (error.code === "auth/requires-recent-login") {
      throw new Error("Please log in again before changing your password.");
    }

    throw error;
  }
}

// FIREBASE: getDoc(doc(db,'users',id))
export async function getUser(id) {
  await delay(50);
  return safe(getDb().users.find((u) => u.id === id));
}

export async function logout() {
  await signOut(auth);
} //fixes sisgn out issues
export { signOut };
