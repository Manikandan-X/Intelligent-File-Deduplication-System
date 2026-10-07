import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { TOKEN_KEY } from "../api/client";
import * as endpoints from "../api/endpoints";
import type { User } from "../types";

// Roles are seeded as Admin then User (db/seed.py), but /auth/me only returns role_id,
// so the admin role id is configurable.
export const ADMIN_ROLE_ID = Number(import.meta.env.VITE_ADMIN_ROLE_ID ?? 1);

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(!!localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    endpoints.getMe().then(setUser).catch(() => localStorage.removeItem(TOKEN_KEY)).finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { access_token } = await endpoints.login(email, password);
    localStorage.setItem(TOKEN_KEY, access_token);
    setUser(await endpoints.getMe());
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, isAdmin: user?.role_id === ADMIN_ROLE_ID, loading, signIn, signOut, setUser }),
    [user, loading, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
