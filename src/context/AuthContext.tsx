import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { http } from "../api/client";
import type { ApiError } from "../api/types";
import {
  clearTokens,
  decodeJwt,
  getAccessToken,
  getRefreshToken,
  setTokens,
  subscribe,
  type JwtClaims,
} from "../api/tokenStore";

export type AppRole = "passenger" | "operator_staff" | "admin";

interface AuthState {
  isAuthenticated: boolean;
  isInitializing: boolean;
  role: AppRole | null;
}

interface AuthContextValue extends AuthState {
  login: (tokens: { access: string; refresh: string }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Module-scoped (not component-scoped): React 18 StrictMode double-invokes
// effects in dev, and AuthProvider's boot effect below trades in a
// single-use, rotating refresh token — two concurrent invocations would
// race, with the second one 401ing after the first already rotated the
// token, logging the user straight back out. This makes both invocations
// (StrictMode's, or any other legitimate double-mount) share one in-flight
// request instead. AuthProvider only ever mounts once per real app anyway.
let bootRefreshPromise: Promise<{ access: string; refresh: string }> | null = null;

function stateFromAccessToken(): AuthState {
  const accessToken = getAccessToken();
  if (!accessToken) {
    return { isAuthenticated: false, isInitializing: false, role: null };
  }
  const claims: JwtClaims | null = decodeJwt(accessToken);
  return { isAuthenticated: true, isInitializing: false, role: claims?.role ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isInitializing: true,
    role: null,
  });

  useEffect(() => subscribe(() => setState(stateFromAccessToken())), []);

  useEffect(() => {
    // On boot we only have a persisted refresh token (access tokens live in
    // memory only), so trade it in once for a fresh access token.
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      setState({ isAuthenticated: false, isInitializing: false, role: null });
      return;
    }

    if (!bootRefreshPromise) {
      bootRefreshPromise = http
        .post<{ access: string; refresh: string }>("/auth/token/refresh/", { refresh: refreshToken })
        .then((response) => response.data)
        .finally(() => {
          bootRefreshPromise = null;
        });
    }

    bootRefreshPromise
      .then((data) => {
        setTokens({ access: data.access, refresh: data.refresh });
        setState(stateFromAccessToken());
      })
      .catch((error: ApiError) => {
        // No response at all = offline (a conductor opening the scanner at
        // the bus door with no signal). Keep the session: the role comes
        // from the refresh token's own claims, the offline screens run from
        // IndexedDB, and the 401 -> refresh interceptor renews the access
        // token once the network is back. Only a real rejection logs out.
        const claims = decodeJwt(refreshToken);
        if (!error?.status && claims?.role && (claims.exp ?? 0) * 1000 > Date.now()) {
          setState({ isAuthenticated: true, isInitializing: false, role: claims.role });
          return;
        }
        clearTokens();
        setState({ isAuthenticated: false, isInitializing: false, role: null });
      });
  }, []);

  const login = useCallback((tokens: { access: string; refresh: string }) => {
    setTokens(tokens);
    setState(stateFromAccessToken());
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setState({ isAuthenticated: false, isInitializing: false, role: null });
  }, []);

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
