// Public content (A4 output) + passenger support tickets (A5 input).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../context/AuthContext";
import type { Announcement, Banner, SupportTicket, SupportTicketDetail, TicketCategory } from "../types/admin";
import { http } from "./client";
import type { ApiError } from "./types";

export function usePublicBanners(placement: Banner["placement"]) {
  return useQuery({
    queryKey: ["content", "banners", placement],
    queryFn: async () => (await http.get<Banner[]>("/content/banners/", { params: { placement } })).data,
    staleTime: 5 * 60_000,
  });
}

export function usePublicAnnouncements(audience: "passengers" | "operators") {
  return useQuery({
    queryKey: ["content", "announcements", audience],
    queryFn: async () => (await http.get<Announcement[]>("/content/announcements/", { params: { audience } })).data,
    staleTime: 5 * 60_000,
  });
}

export function useMyTickets() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["support", "mine"],
    queryFn: async () => (await http.get<SupportTicket[]>("/support/tickets/")).data,
    enabled: isAuthenticated,
  });
}

export function useMyTicket(publicId: string | null) {
  return useQuery({
    queryKey: ["support", "ticket", publicId],
    queryFn: async () => (await http.get<SupportTicketDetail>(`/support/tickets/${publicId}/`)).data,
    enabled: Boolean(publicId),
  });
}

export function useOpenTicket() {
  const queryClient = useQueryClient();
  return useMutation<
    SupportTicketDetail,
    ApiError,
    { category: TicketCategory; subject: string; body: string; booking_id?: string | null }
  >({
    mutationFn: async (body) => (await http.post<SupportTicketDetail>("/support/tickets/", body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support", "mine"] }),
  });
}

export function useReplyMyTicket(publicId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, string>({
    mutationFn: async (body) => (await http.post(`/support/tickets/${publicId}/`, { body })).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["support", "ticket", publicId] });
      void queryClient.invalidateQueries({ queryKey: ["support", "mine"] });
    },
  });
}
