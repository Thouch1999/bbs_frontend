// Admin panel API hooks (Step 16).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AdminCity,
  AdminOperator,
  AdminOverview,
  AdminPaymentDetail,
  AdminPaymentRow,
  AdminPromoCode,
  AdminUser,
  Announcement,
  AuditLogEntry,
  Banner,
  ChecklistKey,
  ChecklistValue,
  DailyPoint,
  OperatorBalance,
  OperatorPayout,
  OperatorStatus,
  OperatorSummaryRow,
  PlatformTopRoute,
  PlatformTotals,
  ReconciliationSummary,
  ReviewNote,
  SupportTicket,
  SupportTicketDetail,
} from "../types/admin";
import type { DateRange, Paginated } from "../types/operator";
import { http } from "./client";
import type { ApiError } from "./types";

const keys = {
  overview: ["admin", "overview"] as const,
  operators: ["admin", "operators"] as const,
  users: ["admin", "users"] as const,
  payments: ["admin", "payments"] as const,
  payouts: ["admin", "payouts"] as const,
  promos: ["admin", "promo-codes"] as const,
  cities: ["admin", "cities"] as const,
  banners: ["admin", "banners"] as const,
  announcements: ["admin", "announcements"] as const,
  tickets: ["admin", "tickets"] as const,
  audit: ["admin", "audit"] as const,
};

// --- Overview / reports ------------------------------------------------------
export function useAdminOverview() {
  return useQuery({
    queryKey: keys.overview,
    queryFn: async () => (await http.get<AdminOverview>("/reports/admin/overview/")).data,
    refetchInterval: 120_000,
  });
}

export function usePlatformTotals(range: DateRange) {
  return useQuery({
    queryKey: ["admin", "reports", "totals", range],
    queryFn: async () => (await http.get<PlatformTotals>("/reports/admin/totals/", { params: range })).data,
    placeholderData: keepPreviousData,
  });
}

export function usePlatformTopRoutes(range: DateRange) {
  return useQuery({
    queryKey: ["admin", "reports", "top-routes", range],
    queryFn: async () =>
      (await http.get<PlatformTopRoute[]>("/reports/admin/top-routes/", { params: { ...range, limit: 10 } })).data,
    placeholderData: keepPreviousData,
  });
}

export function useOperatorSummary(range: DateRange) {
  return useQuery({
    queryKey: ["admin", "reports", "operators", range],
    queryFn: async () => (await http.get<OperatorSummaryRow[]>("/reports/admin/operators/", { params: range })).data,
    placeholderData: keepPreviousData,
  });
}

export function useDailySeries(range: DateRange) {
  return useQuery({
    queryKey: ["admin", "reports", "daily", range],
    queryFn: async () => (await http.get<DailyPoint[]>("/reports/admin/daily/", { params: range })).data,
    placeholderData: keepPreviousData,
  });
}

// --- Operators -----------------------------------------------------------------
export function useAdminOperators(params: { status?: OperatorStatus; search?: string; page?: number }) {
  return useQuery({
    queryKey: [...keys.operators, "list", params],
    queryFn: async () => (await http.get<Paginated<AdminOperator>>("/operators/", { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useAdminOperator(publicId: string | undefined) {
  return useQuery({
    queryKey: [...keys.operators, "detail", publicId],
    queryFn: async () => (await http.get<AdminOperator>(`/operators/${publicId}/`)).data,
    enabled: Boolean(publicId),
  });
}

function useOperatorMutation<TBody>(path: (id: string) => string, method: "post" | "patch" = "post") {
  const queryClient = useQueryClient();
  return useMutation<AdminOperator, ApiError, { publicId: string; body: TBody }>({
    mutationFn: async ({ publicId, body }) => (await http[method]<AdminOperator>(path(publicId), body)).data,
    onSuccess: (data) => {
      queryClient.setQueryData([...keys.operators, "detail", data.public_id], data);
      void queryClient.invalidateQueries({ queryKey: [...keys.operators, "list"] });
      void queryClient.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

export const useApproveOperator = () =>
  useOperatorMutation<{ commission_rate?: string; note?: string }>((id) => `/operators/${id}/approve/`);
export const useRejectOperator = () => useOperatorMutation<{ reason: string }>((id) => `/operators/${id}/reject/`);
export const useSuspendOperator = () => useOperatorMutation<{ reason: string }>((id) => `/operators/${id}/suspend/`);
export const useReinstateOperator = () => useOperatorMutation<{ note?: string }>((id) => `/operators/${id}/reinstate/`);
export const useSetChecklist = () =>
  useOperatorMutation<{ checklist: Partial<Record<ChecklistKey, ChecklistValue>> }>(
    (id) => `/operators/${id}/checklist/`,
    "patch"
  );

export function useAddReviewNote() {
  const queryClient = useQueryClient();
  return useMutation<ReviewNote, ApiError, { publicId: string; body: string; kind: ReviewNote["kind"] }>({
    mutationFn: async ({ publicId, body, kind }) =>
      (await http.post<ReviewNote>(`/operators/${publicId}/notes/`, { body, kind })).data,
    onSuccess: (_data, { publicId }) =>
      queryClient.invalidateQueries({ queryKey: [...keys.operators, "detail", publicId] }),
  });
}

// --- Users ---------------------------------------------------------------------
export function useAdminUsers(params: { search?: string; role?: string; is_active?: boolean; page?: number }) {
  return useQuery({
    queryKey: [...keys.users, params],
    queryFn: async () => (await http.get<Paginated<AdminUser>>("/admin/users/", { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation<AdminUser, ApiError, { publicId: string; body: { is_active?: boolean; role?: string } }>({
    mutationFn: async ({ publicId, body }) => (await http.patch<AdminUser>(`/admin/users/${publicId}/`, body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.users }),
  });
}

// --- Payments / reconciliation ----------------------------------------------------
export interface AdminPaymentQuery {
  date_from?: string;
  date_to?: string;
  provider?: string;
  operator?: string;
  currency?: string;
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export function useAdminPayments(query: AdminPaymentQuery) {
  return useQuery({
    queryKey: [...keys.payments, "list", query],
    queryFn: async () => (await http.get<Paginated<AdminPaymentRow>>("/admin/payments/", { params: query })).data,
    placeholderData: keepPreviousData,
  });
}

export function useAdminPayment(publicId: string | null) {
  return useQuery({
    queryKey: [...keys.payments, "detail", publicId],
    queryFn: async () => (await http.get<AdminPaymentDetail>(`/admin/payments/${publicId}/`)).data,
    enabled: Boolean(publicId),
  });
}

export function useReconciliationSummary() {
  return useQuery({
    queryKey: [...keys.payments, "summary"],
    queryFn: async () => (await http.get<ReconciliationSummary>("/admin/reconciliation/summary/")).data,
  });
}

export function useOperatorBalances() {
  return useQuery({
    queryKey: [...keys.payouts, "balances"],
    queryFn: async () => (await http.get<OperatorBalance[]>("/admin/payouts/balances/")).data,
  });
}

export function usePayouts() {
  return useQuery({
    queryKey: [...keys.payouts, "history"],
    queryFn: async () => (await http.get<OperatorPayout[]>("/admin/payouts/")).data,
  });
}

export function useRecordPayout() {
  const queryClient = useQueryClient();
  return useMutation<
    OperatorPayout,
    ApiError,
    { operator_id: string; currency: string; amount: string; period_start: string; period_end: string; reference?: string; note?: string }
  >({
    mutationFn: async (body) => (await http.post<OperatorPayout>("/admin/payouts/", body)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.payouts });
      void queryClient.invalidateQueries({ queryKey: [...keys.payments, "summary"] });
    },
  });
}

export function useIssueRefund() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, { paymentId: string; amount: string; reason: string }>({
    mutationFn: async ({ paymentId, amount, reason }) =>
      (await http.post(`/payments/${paymentId}/refund/`, { amount, reason })).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.payments });
      void queryClient.invalidateQueries({ queryKey: keys.payouts });
      void queryClient.invalidateQueries({ queryKey: keys.audit });
    },
  });
}

// --- Content ---------------------------------------------------------------------
function crud<T extends { public_id: string }>(queryKey: readonly string[], path: string) {
  return {
    useList: () =>
      useQuery({
        queryKey,
        queryFn: async () => (await http.get<Paginated<T>>(path, { params: { page_size: 100 } })).data.results,
      }),
    useSave: () => {
      const queryClient = useQueryClient();
      return useMutation<T, ApiError, { publicId?: string; body: Partial<T> }>({
        mutationFn: async ({ publicId, body }) =>
          publicId ? (await http.patch<T>(`${path}${publicId}/`, body)).data : (await http.post<T>(path, body)).data,
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
      });
    },
    useDelete: () => {
      const queryClient = useQueryClient();
      return useMutation<void, ApiError, string>({
        mutationFn: async (publicId) => {
          await http.delete(`${path}${publicId}/`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
      });
    },
  };
}

export const cityApi = crud<AdminCity>(keys.cities, "/admin/cities/");
export const bannerApi = crud<Banner>(keys.banners, "/admin/banners/");

export function useUploadBannerImage() {
  const queryClient = useQueryClient();
  return useMutation<Banner, ApiError, { publicId: string; file: File }>({
    mutationFn: async ({ publicId, file }) => {
      const form = new FormData();
      form.append("image", file);
      return (await http.patch<Banner>(`/admin/banners/${publicId}/`, form)).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.banners }),
  });
}
export const announcementApi = crud<Announcement>(keys.announcements, "/admin/announcements/");
export const promoApi = crud<AdminPromoCode>(keys.promos, "/admin/promo-codes/");

// --- Support ---------------------------------------------------------------------
export function useAdminTickets(params: { category?: string; status?: string; search?: string }) {
  return useQuery({
    queryKey: [...keys.tickets, "list", params],
    queryFn: async () =>
      (await http.get<Paginated<SupportTicket>>("/admin/support/tickets/", { params: { ...params, page_size: 100 } }))
        .data.results,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useAdminTicket(publicId: string | null) {
  return useQuery({
    queryKey: [...keys.tickets, "detail", publicId],
    queryFn: async () => (await http.get<SupportTicketDetail>(`/admin/support/tickets/${publicId}/`)).data,
    enabled: Boolean(publicId),
  });
}

export function useReplyTicket() {
  const queryClient = useQueryClient();
  return useMutation<SupportTicketDetail, ApiError, { publicId: string; body: string; resolve: boolean }>({
    mutationFn: async ({ publicId, body, resolve }) =>
      (await http.post<SupportTicketDetail>(`/admin/support/tickets/${publicId}/reply/`, { body, resolve })).data,
    onSuccess: (data) => {
      queryClient.setQueryData([...keys.tickets, "detail", data.public_id], data);
      void queryClient.invalidateQueries({ queryKey: [...keys.tickets, "list"] });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation<
    SupportTicketDetail,
    ApiError,
    { publicId: string; body: { priority?: string; status?: string; mark_read?: boolean } }
  >({
    mutationFn: async ({ publicId, body }) =>
      (await http.patch<SupportTicketDetail>(`/admin/support/tickets/${publicId}/`, body)).data,
    onSuccess: (data) => {
      queryClient.setQueryData([...keys.tickets, "detail", data.public_id], data);
      void queryClient.invalidateQueries({ queryKey: [...keys.tickets, "list"] });
    },
  });
}

// --- Audit log -------------------------------------------------------------------
export function useAuditLog(params: { action?: string; booking?: string; date_from?: string; date_to?: string; page?: number }, enabled = true) {
  return useQuery({
    queryKey: [...keys.audit, params],
    queryFn: async () => (await http.get<Paginated<AuditLogEntry>>("/admin/audit-logs/", { params })).data,
    placeholderData: keepPreviousData,
    enabled,
  });
}
