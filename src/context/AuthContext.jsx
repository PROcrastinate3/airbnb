import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as auth from "../services/authService.js";
import { getWishlistIds, toggleWishlist } from "../services/listingService.js";

// Session state comes from authService.onAuthChange (the only place that needs rewriting for Firebase Auth).
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribe = auth.onAuthChange(async (u) => {
      if (!active) return;
      setUser(u);
      setWishlist(u ? await getWishlistIds(u.id) : []);
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const u = await auth.signIn(email, password);
    setUser(u);
    setWishlist(await getWishlistIds(u.id));
    return u;
  }, []);

  const register = useCallback(async (data) => {
    const { wantsHost, ...u } = await auth.signUp(data);
    setUser(u);
    setWishlist([]);
    return { ...u, wantsHost };
  }, []);

  const logout = useCallback(async () => {
    await auth.signOut();
    setUser(null);
    setWishlist([]);
  }, []);

  const updateUser = useCallback(
    async (data) => {
      const u = await auth.updateProfile(user.id, data);
      setUser(u);
      return u;
    },
    [user],
  );

  const applyAsHost = useCallback(
    async (data) => {
      const u = await auth.applyAsHost(user.id, data);
      setUser(u);
      return u;
    },
    [user],
  );

  // re-read the user (e.g. after an admin approved the host application)
  const refreshUser = useCallback(async () => {
    const u = await auth.restoreSession();
    setUser(u);
    return u;
  }, []);

  const toggleFavorite = useCallback(
    async (listingId) => {
      if (!user) return false;
      setWishlist(await toggleWishlist(user.id, listingId));
      return true;
    },
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      wishlist,
      isGuest: !!user,
      isHost: user?.role === "host" || user?.role === "admin",
      isAdmin: user?.role === "admin",
      login,
      register,
      logout,
      updateUser,
      applyAsHost,
      refreshUser,
      toggleFavorite,
    }),
    [
      user,
      loading,
      wishlist,
      login,
      register,
      logout,
      updateUser,
      applyAsHost,
      refreshUser,
      toggleFavorite,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
