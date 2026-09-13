"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import * as authApi from "@/api/auth";
import { ApiError } from "@/lib/api";
import type { CurrentUser } from "@/types";

type AuthState = {
  user: CurrentUser | null;
  /** True until the session cookie (if any) has been checked against `/users/me`. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      // No token to check for — the session, if any, lives in an httpOnly
      // cookie the browser attaches by itself. A 401 here just means
      // "signed out", not an error worth surfacing.
      try {
        const me = await authApi.getCurrentUser();
        if (!cancelled) setUser(me);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await authApi.login({ email, password });
    setUser(await authApi.getCurrentUser());
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; first_name: string; last_name: string }) => {
      await authApi.register(input);
      setUser(await authApi.getCurrentUser());
    },
    [],
  );

  const logout = useCallback(async () => {
    // Best effort: the local session is cleared even if the server call fails.
    try {
      await authApi.logout();
    } catch {
      /* ignored */
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
