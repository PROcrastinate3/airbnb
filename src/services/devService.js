// Developer-only helpers. Delete this file (and the "Developer tools" box in Profile.jsx) when on Firebase.
import { resetDb } from "./db.js";
import { signOut } from "./authService.js";

export async function resetDemoData() {
  resetDb();
  await signOut();
}
