import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../context/AuthContext";
import { http } from "./client";

export interface SavedPassenger {
  public_id: string;
  full_name: string;
  age: number | null;
  gender: string;
  phone: string;
  id_document_number: string;
}

interface PaginatedEnvelope<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Saved passengers only exist for signed-in users — guests get an empty list. */
export function useSavedPassengers() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["saved-passengers"],
    queryFn: async () => {
      const { data } = await http.get<PaginatedEnvelope<SavedPassenger>>("/saved-passengers/");
      return data.results;
    },
    enabled: isAuthenticated,
  });
}

export function useCreateSavedPassenger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Omit<SavedPassenger, "public_id">) => {
      const { data } = await http.post<SavedPassenger>("/saved-passengers/", body);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-passengers"] }),
  });
}

export function useUpdateSavedPassenger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      publicId,
      ...body
    }: Partial<Omit<SavedPassenger, "public_id">> & { publicId: string }) => {
      const { data } = await http.patch<SavedPassenger>(`/saved-passengers/${publicId}/`, body);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-passengers"] }),
  });
}

export function useDeleteSavedPassenger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (publicId: string) => {
      await http.delete(`/saved-passengers/${publicId}/`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-passengers"] }),
  });
}
