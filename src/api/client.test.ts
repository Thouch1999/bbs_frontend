import MockAdapter from "axios-mock-adapter";
import { beforeEach, describe, expect, it } from "vitest";

import { http, normalizeApiError } from "./client";
import { clearTokens, getAccessToken, setTokens } from "./tokenStore";

const mock = new MockAdapter(http);

describe("http client 401 -> refresh -> retry", () => {
  beforeEach(() => {
    mock.reset();
    clearTokens();
    setTokens({ access: "old-access", refresh: "refresh-1" });
  });

  it("shares a single refresh call across concurrent 401s and retries both requests", async () => {
    mock.onGet("/a").replyOnce(401).onGet("/a").reply(200, { ok: "a" });
    mock.onGet("/b").replyOnce(401).onGet("/b").reply(200, { ok: "b" });
    mock.onPost("/auth/token/refresh/").reply(200, { access: "new-access", refresh: "refresh-2" });

    const [a, b] = await Promise.all([http.get("/a"), http.get("/b")]);

    expect(a.data).toEqual({ ok: "a" });
    expect(b.data).toEqual({ ok: "b" });

    const refreshCalls = mock.history.post.filter((req) => req.url === "/auth/token/refresh/");
    expect(refreshCalls).toHaveLength(1);
    expect(getAccessToken()).toBe("new-access");
  });

  it("clears tokens and rejects with a normalized error when the refresh call itself fails", async () => {
    mock.onGet("/a").reply(401);
    mock.onPost("/auth/token/refresh/").reply(401, { error: { code: "invalid_token", message: "bad refresh" } });

    await expect(http.get("/a")).rejects.toMatchObject({ code: "invalid_token" });
    expect(getAccessToken()).toBeNull();
  });
});

describe("normalizeApiError", () => {
  beforeEach(() => {
    mock.reset();
  });

  // A raw AxiosError already has string `.code`/`.message` fields of its
  // own (e.g. "ERR_BAD_REQUEST" / "Request failed with status code 400"),
  // which used to satisfy the same duck-typed shape as an already-
  // normalized ApiError and short-circuit before the real backend payload
  // was ever unwrapped — silently swallowing every field validation message
  // (e.g. the banner-image upload's "file too large"/"invalid image" errors).
  it("unwraps the backend's error payload instead of axios's generic message", async () => {
    mock.onPatch("/admin/banners/1/").reply(400, { error: { code: "invalid", message: "File too large." } });

    await expect(http.patch("/admin/banners/1/")).rejects.toMatchObject({
      code: "invalid",
      message: "File too large.",
      status: 400,
    });
  });

  it("falls back to the axios message only when the backend sent no error payload", () => {
    const error = normalizeApiError({
      isAxiosError: true,
      code: "ERR_NETWORK",
      message: "Network Error",
      toJSON: () => ({}),
    });
    expect(error).toMatchObject({ code: "ERR_NETWORK", message: "Network Error" });
  });
});
