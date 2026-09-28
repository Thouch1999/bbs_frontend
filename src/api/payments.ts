import { useMutation } from "@tanstack/react-query";

import type { InitiatePaymentResponse, PaymentProvider, PromoValidateResponse } from "../types";
import type { ApiError } from "./types";
import { http } from "./client";

export function useInitiatePayment() {
  return useMutation<InitiatePaymentResponse, ApiError, { booking_id: string; provider: PaymentProvider }>({
    mutationFn: async (body: { booking_id: string; provider: PaymentProvider }) => {
      const { data } = await http.post<InitiatePaymentResponse>("/payments/", body);
      return data;
    },
  });
}

export interface PromoValidateRequest {
  code: string;
  trip_id: string;
  num_seats: number;
  currency: "KHR" | "USD";
  contact_phone?: string;
}

export function usePromoValidate() {
  return useMutation<PromoValidateResponse, ApiError, PromoValidateRequest>({
    mutationFn: async (body: PromoValidateRequest) => {
      const { data } = await http.post<PromoValidateResponse>("/promo-codes/validate/", body);
      return data;
    },
  });
}
