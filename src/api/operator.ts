// Back-office (operator) API hooks — one module for the whole Step 15 surface
// so operator pages never talk to axios directly. Every list that feeds a
// <select> or a client-side table goes through fetchAllPages(): the API
// paginates at 20 by default, and a silently truncated bus/route list is
// the same class of bug Step 13 found in the seat map.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Booking, City, CreateBookingRequest, Stop, TripSeat } from "../types";
import type {
  Bus,
  BusWrite,
  CancellationSummary,
  DateRange,
  ManifestRow,
  OccupancyRow,
  OperatorBooking,
  OperatorBookingQuery,
  OperatorDashboard,
  OperatorRoute,
  OperatorTrip,
  OperatorTripQuery,
  Paginated,
  PublicConfig,
  RecurringTripWrite,
  ReturningCustomer,
  RevenueGroupBy,
  RevenueRow,
  RouteStopItem,
  RouteWrite,
  SeatInput,
  SeatLayout,
  StaffCreate,
  StaffMember,
  StaffUpdate,
  StopWrite,
  TripStatusPreview,
  TripStatusUpdate,
  TripWrite,
} from "../types/operator";
import type { RouteStopEntry } from "../types";
import { http } from "./client";
import type { ApiError } from "./types";

const PAGE_SIZE_MAX = 100;

async function fetchAllPages<T>(url: string, params: object = {}): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  for (;;) {
    const { data } = await http.get<Paginated<T>>(url, { params: { ...params, page, page_size: PAGE_SIZE_MAX } });
    results.push(...data.results);
    if (!data.next) return results;
    page += 1;
  }
}

export const operatorKeys = {
  trips: ["operator", "trips"] as const,
  buses: ["operator", "buses"] as const,
  layouts: ["operator", "seat-layouts"] as const,
  routes: ["operator", "routes"] as const,
  bookings: ["operator", "bookings"] as const,
  staff: ["operator", "staff"] as const,
  dashboard: ["operator", "dashboard"] as const,
};

// --- Config ---------------------------------------------------------------
export function usePublicConfig() {
  return useQuery({
    queryKey: ["public-config"],
    queryFn: async () => (await http.get<PublicConfig>("/config/")).data,
    staleTime: Infinity,
  });
}

// --- Trips ----------------------------------------------------------------
export function useOperatorTrips(query: OperatorTripQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...operatorKeys.trips, "page", query],
    queryFn: async () => (await http.get<Paginated<OperatorTrip>>("/operator/trips/", { params: query })).data,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

/** Every trip in a date range (calendar view, dashboard, counter screen). */
export function useAllOperatorTrips(query: Omit<OperatorTripQuery, "page" | "page_size">, enabled = true) {
  return useQuery({
    queryKey: [...operatorKeys.trips, "all", query],
    queryFn: () => fetchAllPages<OperatorTrip>("/operator/trips/", query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useOperatorTrip(publicId: string | undefined) {
  return useQuery({
    queryKey: [...operatorKeys.trips, "detail", publicId],
    queryFn: async () => (await http.get<OperatorTrip>(`/operator/trips/${publicId}/`)).data,
    enabled: Boolean(publicId),
  });
}

function useInvalidateTrips() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: operatorKeys.trips });
    void queryClient.invalidateQueries({ queryKey: operatorKeys.dashboard });
  };
}

export function useCreateTrip() {
  const invalidate = useInvalidateTrips();
  return useMutation<OperatorTrip, ApiError, TripWrite>({
    mutationFn: async (body) => (await http.post<OperatorTrip>("/operator/trips/", body)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateTrip() {
  const invalidate = useInvalidateTrips();
  return useMutation<OperatorTrip, ApiError, { publicId: string; body: Partial<TripWrite> }>({
    mutationFn: async ({ publicId, body }) => (await http.patch<OperatorTrip>(`/operator/trips/${publicId}/`, body)).data,
    onSuccess: invalidate,
  });
}

export function useCreateRecurringTrips() {
  const invalidate = useInvalidateTrips();
  return useMutation<OperatorTrip[], ApiError, RecurringTripWrite>({
    mutationFn: async (body) => (await http.post<OperatorTrip[]>("/operator/trips/recurring/", body)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteTrip() {
  const invalidate = useInvalidateTrips();
  return useMutation<void, ApiError, string>({
    mutationFn: async (publicId) => {
      await http.delete(`/operator/trips/${publicId}/`);
    },
    onSuccess: invalidate,
  });
}

export function useTripStatusPreview(publicId: string | undefined, update: TripStatusUpdate | null) {
  return useQuery({
    queryKey: [...operatorKeys.trips, "status-preview", publicId, update],
    queryFn: async () =>
      (await http.get<TripStatusPreview>(`/operator/trips/${publicId}/status-preview/`, { params: update })).data,
    enabled: Boolean(publicId && update && (update.status !== "delayed" || (update.delay_minutes ?? 0) > 0)),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

export function useSetTripStatus() {
  const invalidate = useInvalidateTrips();
  return useMutation<OperatorTrip, ApiError, { publicId: string; body: TripStatusUpdate }>({
    mutationFn: async ({ publicId, body }) =>
      (await http.post<OperatorTrip>(`/operator/trips/${publicId}/status/`, body)).data,
    onSuccess: invalidate,
  });
}

export function useTripManifest(publicId: string | undefined) {
  return useQuery({
    queryKey: [...operatorKeys.trips, "manifest", publicId],
    queryFn: async () => (await http.get<ManifestRow[]>(`/operator/trips/${publicId}/manifest/`)).data,
    enabled: Boolean(publicId),
    staleTime: 0,
  });
}

export function useMarkBoarding(publicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<{ updated: number }, ApiError, { passengerIds: string[]; status: "boarded" | "no_show" }>({
    mutationFn: async ({ passengerIds, status }) =>
      (
        await http.post<{ updated: number }>(`/operator/trips/${publicId}/boarding/`, {
          passenger_ids: passengerIds,
          status,
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...operatorKeys.trips, "manifest", publicId] }),
  });
}

/** Authenticated file download (the Authorization header rules out a plain <a href>). */
export async function downloadManifest(publicId: string, format: "csv" | "pdf"): Promise<void> {
  const response = await http.get<Blob>(`/reports/operator/trips/${publicId}/manifest/export/`, {
    params: { export_format: format },
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `manifest-${publicId}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useTripSeatMap(publicId: string | undefined) {
  return useQuery({
    queryKey: ["trip-seats", publicId],
    queryFn: async () => (await http.get<TripSeat[]>(`/trips/${publicId}/seats/`)).data,
    enabled: Boolean(publicId),
    staleTime: 0,
  });
}

// --- Fleet ----------------------------------------------------------------
export function useBuses() {
  return useQuery({ queryKey: operatorKeys.buses, queryFn: () => fetchAllPages<Bus>("/buses/") });
}

export function useSaveBus() {
  const queryClient = useQueryClient();
  return useMutation<Bus, ApiError, { publicId?: string; body: BusWrite }>({
    mutationFn: async ({ publicId, body }) =>
      publicId
        ? (await http.patch<Bus>(`/buses/${publicId}/`, body)).data
        : (await http.post<Bus>("/buses/", body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: operatorKeys.buses }),
  });
}

export function useUploadBusPhoto() {
  const queryClient = useQueryClient();
  return useMutation<Bus, ApiError, { publicId: string; file: File }>({
    mutationFn: async ({ publicId, file }) => {
      const form = new FormData();
      form.append("photo", file);
      return (await http.patch<Bus>(`/buses/${publicId}/`, form)).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: operatorKeys.buses }),
  });
}

export function useDeleteBus() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: async (publicId) => {
      await http.delete(`/buses/${publicId}/`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: operatorKeys.buses }),
  });
}

export function useSeatLayouts() {
  return useQuery({ queryKey: operatorKeys.layouts, queryFn: () => fetchAllPages<SeatLayout>("/seat-layouts/") });
}

export function useCreateSeatLayout() {
  const queryClient = useQueryClient();
  return useMutation<SeatLayout, ApiError, { name: string; bus_type: SeatLayout["bus_type"] }>({
    mutationFn: async (body) => (await http.post<SeatLayout>("/seat-layouts/", body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: operatorKeys.layouts }),
  });
}

export function useUpdateSeatLayout() {
  const queryClient = useQueryClient();
  return useMutation<SeatLayout, ApiError, { publicId: string; body: Partial<Pick<SeatLayout, "name" | "bus_type">> }>({
    mutationFn: async ({ publicId, body }) => (await http.patch<SeatLayout>(`/seat-layouts/${publicId}/`, body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: operatorKeys.layouts }),
  });
}

export function useSaveLayoutSeats() {
  const queryClient = useQueryClient();
  return useMutation<SeatLayout, ApiError, { publicId: string; deckCount: number; seats: SeatInput[] }>({
    mutationFn: async ({ publicId, deckCount, seats }) =>
      (await http.put<SeatLayout>(`/seat-layouts/${publicId}/seats/`, { deck_count: deckCount, seats })).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: operatorKeys.layouts });
      void queryClient.invalidateQueries({ queryKey: operatorKeys.buses });
    },
  });
}

export function useDeleteSeatLayout() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: async (publicId) => {
      await http.delete(`/seat-layouts/${publicId}/`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: operatorKeys.layouts }),
  });
}

// --- Routes / stops ---------------------------------------------------------
export function useOperatorRoutes() {
  return useQuery({ queryKey: operatorKeys.routes, queryFn: () => fetchAllPages<OperatorRoute>("/routes/") });
}

export function useSaveRoute() {
  const queryClient = useQueryClient();
  return useMutation<OperatorRoute, ApiError, { publicId?: string; body: RouteWrite }>({
    mutationFn: async ({ publicId, body }) =>
      publicId
        ? (await http.patch<OperatorRoute>(`/routes/${publicId}/`, body)).data
        : (await http.post<OperatorRoute>("/routes/", body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: operatorKeys.routes }),
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: async (publicId) => {
      await http.delete(`/routes/${publicId}/`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: operatorKeys.routes }),
  });
}

export function useRouteStops(routePublicId: string | undefined) {
  return useQuery({
    queryKey: [...operatorKeys.routes, "stops", routePublicId],
    queryFn: async () => (await http.get<RouteStopEntry[]>(`/routes/${routePublicId}/stops/`)).data,
    enabled: Boolean(routePublicId),
  });
}

export function useSaveRouteStops(routePublicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<RouteStopEntry[], ApiError, RouteStopItem[]>({
    mutationFn: async (stops) =>
      (await http.put<RouteStopEntry[]>(`/routes/${routePublicId}/stops/bulk/`, { stops })).data,
    onSuccess: (data) => {
      queryClient.setQueryData([...operatorKeys.routes, "stops", routePublicId], data);
      void queryClient.invalidateQueries({ queryKey: operatorKeys.routes });
    },
  });
}

export function useAllCities() {
  return useQuery({
    queryKey: ["cities", "all"],
    queryFn: () => fetchAllPages<City>("/cities/"),
    staleTime: 10 * 60_000,
  });
}

export function useStopsInCities(cityPublicIds: string[]) {
  return useQuery({
    queryKey: ["stops", "cities", [...cityPublicIds].sort()],
    queryFn: async () => (await Promise.all(cityPublicIds.map((city) => fetchAllPages<Stop>("/stops/", { city })))).flat(),
    enabled: cityPublicIds.length > 0,
  });
}

export function useCreateStop() {
  const queryClient = useQueryClient();
  return useMutation<Stop, ApiError, StopWrite>({
    mutationFn: async (body) => (await http.post<Stop>("/stops/", body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stops"] }),
  });
}

// --- Bookings -------------------------------------------------------------
export function useOperatorBookings(query: OperatorBookingQuery, enabled = true) {
  return useQuery({
    queryKey: [...operatorKeys.bookings, query],
    queryFn: async () =>
      (await http.get<Paginated<OperatorBooking>>("/operator/bookings/", { params: query })).data,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useOperatorCancellationPreview(publicId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...operatorKeys.bookings, "cancellation-preview", publicId],
    queryFn: async () =>
      (
        await http.get<{ refund_percentage: string; refund_amount: string }>(
          `/operator/bookings/${publicId}/cancellation-preview/`
        )
      ).data,
    enabled: Boolean(publicId) && enabled,
    staleTime: 0,
  });
}

function useInvalidateBookings() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: operatorKeys.bookings });
    void queryClient.invalidateQueries({ queryKey: operatorKeys.trips });
    void queryClient.invalidateQueries({ queryKey: operatorKeys.dashboard });
  };
}

export function useOperatorCancelBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation<OperatorBooking, ApiError, { publicId: string; reason: string }>({
    mutationFn: async ({ publicId, reason }) =>
      (await http.post<OperatorBooking>(`/operator/bookings/${publicId}/cancel/`, { reason })).data,
    onSuccess: invalidate,
  });
}

export function useMarkCounterPaid() {
  const invalidate = useInvalidateBookings();
  return useMutation<unknown, ApiError, string>({
    mutationFn: async (paymentPublicId) =>
      (await http.post(`/payments/${paymentPublicId}/mark-counter-paid/`)).data,
    onSuccess: invalidate,
  });
}

export function useCustomerLookup(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return useQuery<ReturningCustomer | null, ApiError>({
    queryKey: ["operator", "customer-lookup", digits],
    queryFn: async () => {
      try {
        return (await http.get<ReturningCustomer>("/operator/customers/lookup/", { params: { phone } })).data;
      } catch (error) {
        if ((error as ApiError).status === 404) return null;
        throw error;
      }
    },
    enabled: digits.length >= 8,
    retry: false,
  });
}

// --- Staff ----------------------------------------------------------------
export function useStaff() {
  return useQuery({
    queryKey: operatorKeys.staff,
    queryFn: async () => (await http.get<StaffMember[]>("/operator/staff/")).data,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation<StaffMember, ApiError, StaffCreate>({
    mutationFn: async (body) => (await http.post<StaffMember>("/operator/staff/", body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: operatorKeys.staff }),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation<StaffMember, ApiError, { publicId: string; body: StaffUpdate }>({
    mutationFn: async ({ publicId, body }) =>
      (await http.patch<StaffMember>(`/operator/staff/${publicId}/`, body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: operatorKeys.staff }),
  });
}

// --- Reports --------------------------------------------------------------
export function useOperatorDashboard(enabled = true) {
  return useQuery({
    queryKey: operatorKeys.dashboard,
    queryFn: async () => (await http.get<OperatorDashboard>("/reports/operator/dashboard/")).data,
    refetchInterval: 60_000,
    enabled,
  });
}

export function useRevenueReport(range: DateRange, groupBy: RevenueGroupBy) {
  return useQuery({
    queryKey: ["operator", "reports", "revenue", range, groupBy],
    queryFn: async () =>
      (await http.get<RevenueRow[]>("/reports/operator/revenue/", { params: { ...range, group_by: groupBy } })).data,
    placeholderData: keepPreviousData,
  });
}

export function useOccupancyReport(range: DateRange) {
  return useQuery({
    queryKey: ["operator", "reports", "occupancy", range],
    queryFn: async () => (await http.get<OccupancyRow[]>("/reports/operator/occupancy/", { params: range })).data,
    placeholderData: keepPreviousData,
  });
}

export function useCancellationSummary(range: DateRange) {
  return useQuery({
    queryKey: ["operator", "reports", "cancellations", range],
    queryFn: async () =>
      (await http.get<CancellationSummary>("/reports/operator/cancellations/", { params: range })).data,
    placeholderData: keepPreviousData,
  });
}

// --- Counter (agent) booking ------------------------------------------------
export function useAgentCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation<Booking, ApiError, CreateBookingRequest>({
    mutationFn: async (body) => (await http.post<Booking>("/bookings/agent/", body)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: operatorKeys.bookings });
      void queryClient.invalidateQueries({ queryKey: operatorKeys.trips });
    },
  });
}

/** The caller's own operator (owner/manager) — incl. admin info requests while pending. */
export function useOperatorMe(enabled: boolean) {
  return useQuery({
    queryKey: ["operator", "me"],
    queryFn: async () =>
      (await http.get<{ status: string; info_requests: { body: string; created_at: string }[] }>("/operators/me/")).data,
    enabled,
  });
}
