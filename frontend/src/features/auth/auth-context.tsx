"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import * as authApi from "@/api/auth";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/lib/config";
import type { AuthTokens, CurrentUser } from "@/types";

type AuthState = {
  user: CurrentUser | null;
  /** True until the stored token has been checked against `/users/me`. */
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

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeTokens(tokens: AuthTokens | null) {
  try {
    if (tokens) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
      window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Private mode or blocked storage: the session simply won't survive a reload.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const token = readStorage(ACCESS_TOKEN_KEY);
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await authApi.getCurrentUser(token);
        if (!cancelled) setUser(me);
      } catch {
        // Expired or invalid token — drop it rather than looping on 401s.
        writeTokens(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyTokens = useCallback(async (tokens: AuthTokens) => {
    writeTokens(tokens);
    const me = await authApi.getCurrentUser(tokens.access_token);
    setUser(me);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await applyTokens(await authApi.login({ email, password }));
    },
    [applyTokens],
  );

  const register = useCallback(
    async (input: { email: string; password: string; first_name: string; last_name: string }) => {
      await applyTokens(await authApi.register(input));
    },
    [applyTokens],
  );

  const logout = useCallback(async () => {
    const refreshToken = readStorage(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      // Best effort: the local session is cleared even if the server call fails.
      try {
        await authApi.logout(refreshToken);
      } catch {
        /* ignored */
      }
    }
    writeTokens(null);
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
