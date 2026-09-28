// Plain (non-React) token store so the axios interceptors in client.ts can
// read/write auth state without importing React context — avoids a
// context-inside-axios circular dependency. AuthContext wraps this store
// and re-renders on change via subscribe().
const REFRESH_TOKEN_KEY = "bbms.refreshToken";

let accessToken: string | null = null;
let refreshToken: string | null = localStorage.getItem(REFRESH_TOKEN_KEY);

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function setTokens(tokens: { access: string; refresh: string }): void {
  accessToken = tokens.access;
  refreshToken = tokens.refresh;
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  notify();
}

/** Access-only update, used after a refresh that doesn't rotate the refresh token. */
export function setAccessToken(access: string): void {
  accessToken = access;
  notify();
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  notify();
}

export interface JwtClaims {
  role?: "passenger" | "operator_staff" | "admin";
  exp?: number;
  user_id?: number;
}

export function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}
