import { useQuery } from "@tanstack/react-query";

import type { City, RouteStopEntry, Stop } from "../types";
import { http } from "./client";

interface PaginatedEnvelope<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useCities(search: string) {
  return useQuery({
    queryKey: ["cities", search],
    queryFn: async () => {
      const { data } = await http.get<PaginatedEnvelope<City>>("/cities/", { params: { search } });
      return data.results;
    },
    enabled: search.length > 0,
  });
}

export function useStops(cityPublicId: string | null) {
  return useQuery({
    queryKey: ["stops", cityPublicId],
    queryFn: async () => {
      const { data } = await http.get<PaginatedEnvelope<Stop>>("/stops/", { params: { city: cityPublicId } });
      return data.results;
    },
    enabled: Boolean(cityPublicId),
  });
}

export function useTripStops(tripPublicId: string | null) {
  return useQuery({
    queryKey: ["trip-stops", tripPublicId],
    queryFn: async () => {
      const { data } = await http.get<RouteStopEntry[]>(`/trips/${tripPublicId}/stops/`);
      return data;
    },
    enabled: Boolean(tripPublicId),
  });
}
