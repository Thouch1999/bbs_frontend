import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Booking, CancellationPreview, CreateBookingRequest, ReschedulePreview } from "../types";
import { http } from "./client";
import type { ApiError } from "./types";

interface PaginatedEnvelope<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useCreateBooking() {
  return useMutation<Booking, ApiError, CreateBookingRequest>({
    mutationFn: async (body: CreateBookingRequest) => {
      const { data } = await http.post<Booking>("/bookings/", body);
      return data;
    },
  });
}

/** GET /bookings/{id}/ requires auth + ownership, so guests always go
 * through this PNR+phone lookup instead — used by PaymentResultPage and
 * TicketPage. */
export function useBookingLookup(
  pnr: string | null,
  phone: string | null,
  options?: { refetchInterval?: number | false }
) {
  return useQuery({
    queryKey: ["booking-lookup", pnr, phone],
    queryFn: async () => {
      const { data } = await http.get<Booking>("/bookings/lookup/", { params: { pnr, phone } });
      return data;
    },
    enabled: Boolean(pnr && phone),
    refetchInterval: options?.refetchInterval,
  });
}

export type BookingsWhen = "upcoming" | "past";

export function useMyBookings(when: BookingsWhen, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["my-bookings", when],
    queryFn: async () => {
      const { data } = await http.get<PaginatedEnvelope<Booking>>("/bookings/my/", { params: { when } });
      return data.results;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useBookingDetail(publicId: string | undefined) {
  return useQuery({
    queryKey: ["booking-detail", publicId],
    queryFn: async () => {
      const { data } = await http.get<Booking>(`/bookings/${publicId}/`);
      return data;
    },
    enabled: Boolean(publicId),
  });
}

export function useCancellationPreview(publicId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["cancellation-preview", publicId],
    queryFn: async () => {
      const { data } = await http.get<CancellationPreview>(`/bookings/${publicId}/cancellation-preview/`);
      return data;
    },
    enabled: Boolean(publicId) && enabled,
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation<Booking, ApiError, { publicId: string; reason?: string }>({
    mutationFn: async ({ publicId, reason }) => {
      const { data } = await http.post<Booking>(`/bookings/${publicId}/cancel/`, { reason });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["booking-detail", data.public_id], data);
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
  });
}

export function useReschedulePreview(publicId: string | undefined, newTripId: string | undefined) {
  return useQuery({
    queryKey: ["reschedule-preview", publicId, newTripId],
    queryFn: async () => {
      const { data } = await http.get<ReschedulePreview>(`/bookings/${publicId}/reschedule-preview/`, {
        params: { new_trip_id: newTripId },
      });
      return data;
    },
    enabled: Boolean(publicId && newTripId),
  });
}

export function useRescheduleBooking() {
  const queryClient = useQueryClient();
  return useMutation<
    Booking,
    ApiError,
    { publicId: string; newTripId: string; newHoldToken: string }
  >({
    mutationFn: async ({ publicId, newTripId, newHoldToken }) => {
      const { data } = await http.post<Booking>(`/bookings/${publicId}/reschedule/`, {
        new_trip_id: newTripId,
        new_hold_token: newHoldToken,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["booking-detail", data.public_id], data);
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
  });
}
