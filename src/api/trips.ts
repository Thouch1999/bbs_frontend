import { useMutation, useQueries, useQuery } from "@tanstack/react-query";

import type { BusType, HoldSeatsResponse, ReleaseSeatsResponse, Trip, TripSeat } from "../types";
import type { ApiError } from "./types";
import { http } from "./client";

interface PaginatedEnvelope<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface TripSearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  bus_type?: BusType;
  operator?: string;
  page?: number;
}

export function useTripSearch(params: TripSearchParams) {
  return useQuery({
    queryKey: ["trip-search", params],
    queryFn: async () => {
      const { data } = await http.get<PaginatedEnvelope<Trip>>("/trips/search/", { params });
      return data;
    },
    enabled: Boolean(params.origin && params.destination && params.date),
  });
}

// Unfiltered trip-search page — every field is optional server-side — used
// by the homepage's "popular routes" widget to show real upcoming trips
// instead of inventing route/price data.
export function useUpcomingTrips() {
  return useQuery({
    queryKey: ["trip-search", "upcoming"],
    queryFn: async () => {
      const { data } = await http.get<PaginatedEnvelope<Trip>>("/trips/search/");
      return data.results;
    },
    staleTime: 60_000,
  });
}

export interface DatePagerDay {
  date: string;
  count: number;
  minFareUsd: number | null;
  minFareKhr: number | null;
}

// Real per-day min-fare preview for the search-results date pager — a
// handful of parallel trip-search calls (one per candidate day) against the
// same public endpoint, rather than fabricated numbers.
export function useDatePagerFares(origin: string | undefined, destination: string | undefined, dates: string[]) {
  return useQueries({
    queries: dates.map((date) => ({
      queryKey: ["trip-search", "pager", origin, destination, date],
      queryFn: async (): Promise<DatePagerDay> => {
        const { data } = await http.get<PaginatedEnvelope<Trip>>("/trips/search/", {
          params: { origin, destination, date },
        });
        const usdFares = data.results.map((trip) => Number(trip.base_fare_usd));
        const khrFares = data.results.map((trip) => Number(trip.base_fare_khr));
        return {
          date,
          count: data.count,
          minFareUsd: usdFares.length ? Math.min(...usdFares) : null,
          minFareKhr: khrFares.length ? Math.min(...khrFares) : null,
        };
      },
      enabled: Boolean(origin && destination && date),
      staleTime: 60_000,
    })),
  });
}

export function useTrip(tripPublicId: string | undefined) {
  return useQuery({
    queryKey: ["trip", tripPublicId],
    queryFn: async () => {
      const { data } = await http.get<Trip>(`/trips/${tripPublicId}/`);
      return data;
    },
    enabled: Boolean(tripPublicId),
  });
}

export function useTripSeats(tripPublicId: string | undefined) {
  return useQuery({
    queryKey: ["trip-seats", tripPublicId],
    queryFn: async () => {
      const { data } = await http.get<TripSeat[]>(`/trips/${tripPublicId}/seats/`);
      return data;
    },
    enabled: Boolean(tripPublicId),
    // Seat availability changes fast once other buyers are shopping the
    // same trip — don't serve a stale cached map from Step 12's 30s default.
    staleTime: 0,
  });
}

export function useHoldSeats(tripPublicId: string | undefined) {
  return useMutation<HoldSeatsResponse, ApiError, string[]>({
    mutationFn: async (seatIds: string[]) => {
      const { data } = await http.post<HoldSeatsResponse>(`/trips/${tripPublicId}/hold/`, {
        seat_ids: seatIds,
      });
      return data;
    },
  });
}

export function useReleaseSeats(tripPublicId: string | undefined) {
  return useMutation<ReleaseSeatsResponse, ApiError, string[]>({
    mutationFn: async (seatIds: string[]) => {
      const { data } = await http.post<ReleaseSeatsResponse>(`/trips/${tripPublicId}/release/`, {
        seat_ids: seatIds,
      });
      return data;
    },
  });
}
