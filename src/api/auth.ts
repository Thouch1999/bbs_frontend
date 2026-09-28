import { useMutation } from "@tanstack/react-query";

import type { AuthTokens } from "../types";
import { http } from "./client";
import type { ApiError } from "./types";

export function useLogin() {
  return useMutation<AuthTokens, ApiError, { email: string; password: string }>({
    mutationFn: async (body) => {
      const { data } = await http.post<AuthTokens>("/auth/login/", body);
      return data;
    },
  });
}

export function useRegister() {
  return useMutation<AuthTokens, ApiError, { email: string; password: string; full_name: string }>({
    mutationFn: async (body) => {
      const { data } = await http.post<AuthTokens>("/auth/register/", body);
      return data;
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation<{ detail: string }, ApiError, { email: string }>({
    mutationFn: async (body) => {
      const { data } = await http.post<{ detail: string }>("/auth/password-reset/", body);
      return data;
    },
  });
}

export function useConfirmPasswordReset() {
  return useMutation<{ detail: string }, ApiError, { email: string; code: string; new_password: string }>({
    mutationFn: async (body) => {
      const { data } = await http.post<{ detail: string }>("/auth/password-reset/confirm/", body);
      return data;
    },
  });
}
