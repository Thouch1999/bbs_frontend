// Admin panel response shapes — hand-written to match the Step 16
// serializers (apps/reports admin, apps/operators admin, apps/accounts admin,
// apps/payments admin, apps/content, apps/support, core audit log).
import type { Currency } from "./operator";

export interface CurrencyPair {
  usd: string;
  khr: string;
}

export interface PlatformTotals {
  total_bookings: number;
  total_passengers: number;
  revenue: CurrencyPair;
  commission: CurrencyPair;
  active_operators: number;
  average_occupancy: string;
  cancellation_rate: string;
}

export interface PlatformTopRoute {
  origin_city_name: string;
  origin_city_name_km: string;
  destination_city_name: string;
  destination_city_name_km: string;
  bookings_count: number;
  operators_count: number;
  revenue_usd: string;
  revenue_khr: string;
}

export interface DailyPoint {
  date: string;
  bookings: number;
  revenue_usd: string;
  revenue_khr: string;
}

export interface SystemStatusRow {
  key: string;
  kind: "payment" | "notification";
  label: string;
  mode: "live" | "test" | "console" | "not_implemented";
  health: "ok" | "degraded" | "down";
  last_success_at: string | null;
  last_webhook_at: string | null;
  failures_24h: number;
  pending: number;
}

export interface PendingOperator {
  public_id: string;
  name: string;
  name_km: string;
  licence_number: string;
  licence_document: string | null;
  created_at: string;
}

export interface AdminOverview {
  totals: PlatformTotals;
  pending_operators: PendingOperator[];
  pending_operators_count: number;
  series: DailyPoint[];
  top_routes: PlatformTopRoute[];
  system_status: SystemStatusRow[];
}

export interface OperatorSummaryRow {
  operator_public_id: string;
  operator_name: string;
  bookings_count: number;
  seats_sold: number;
  seats_total: number;
  occupancy_rate: string;
  revenue_usd: string;
  revenue_khr: string;
}

export type OperatorStatus = "pending" | "approved" | "rejected" | "suspended";
export type ChecklistKey = "licence_number" | "route_licence" | "bank_account" | "owner_id";
export type ChecklistValue = "verified" | "needs_info" | "rejected";

export interface ReviewNote {
  public_id: string;
  kind: "note" | "info_request";
  body: string;
  author_name: string;
  created_at: string;
}

export interface AdminOperator {
  public_id: string;
  name: string;
  name_km: string;
  licence_number: string;
  licence_document: string | null;
  contact_phone: string;
  contact_email: string | null;
  address: string;
  commission_rate: string;
  status: OperatorStatus;
  rejection_reason: string;
  approved_at: string | null;
  created_at: string;
  owner_name: string;
  owner_email: string;
  staff_count: number;
  routes_count: number;
  buses_count: number;
  trips_count: number;
  review_checklist: Partial<Record<ChecklistKey, ChecklistValue>>;
  review_notes: ReviewNote[];
}

export interface AdminUser {
  public_id: string;
  email: string;
  phone: string;
  full_name: string;
  role: "passenger" | "operator_staff" | "admin";
  is_active: boolean;
  preferred_language: "km" | "en";
  last_login: string | null;
  created_at: string;
  bookings_count: number;
  operator_name: string;
  staff_role: string;
}

export type ReconciliationStatus = "paid" | "pending" | "failed" | "mismatch";

export interface AdminPaymentRow {
  public_id: string;
  provider: string;
  provider_txn_id: string | null;
  status: "pending" | "succeeded" | "failed";
  amount: string;
  currency: Currency;
  pnr: string;
  booking_public_id: string;
  booking_status: string;
  operator_public_id: string;
  operator_name: string;
  refunded: string;
  commission: string;
  net_to_operator: string;
  flags: string[];
  reconciliation_status: ReconciliationStatus;
  created_at: string;
}

export interface AdminPaymentDetail extends AdminPaymentRow {
  booking_total_amount: string;
  booking_currency: Currency;
  booking_refund_amount: string | null;
  booking_rescheduled_at: string | null;
  raw_payload: Record<string, unknown>;
  refunds: { public_id: string; amount: string; reason: string; status: string; provider_refund_id: string; created_at: string }[];
  webhook_logs: { public_id: string; provider: string; signature_valid: boolean; note: string; raw_body: string; created_at: string }[];
  refundable: string;
}

export interface ReconciliationSummary {
  collected_today: CurrencyPair;
  paid_out: CurrencyPair;
  pending_payout: CurrencyPair;
  mismatch_count: number;
}

export interface OperatorBalance {
  operator_public_id: string;
  operator_name: string;
  currency: Currency;
  bookings_count: number;
  gross: string;
  refunded: string;
  commission: string;
  earned: string;
  paid_out: string;
  outstanding: string;
  last_paid_at: string | null;
}

export interface OperatorPayout {
  public_id: string;
  operator_public_id: string;
  operator_name: string;
  currency: Currency;
  amount: string;
  period_start: string;
  period_end: string;
  reference: string;
  note: string;
  paid_at: string;
  paid_by_name: string;
}

export interface AdminPromoCode {
  public_id: string;
  code: string;
  description_km: string;
  description_en: string;
  discount_type: "percent" | "fixed";
  value: string;
  min_amount: string | null;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  valid_from: string;
  valid_until: string;
  applicable_operator_id: string | null;
  applicable_operator_name: string;
  applicable_route_id: string | null;
  applicable_route_name: string;
  is_active: boolean;
  times_used: number;
  created_at: string;
}

export interface Banner {
  public_id: string;
  title_km: string;
  title_en: string;
  body_km: string;
  body_en: string;
  placement: "home" | "search" | "my_bookings";
  background_color: string;
  image: string | null;
  link_url: string;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Announcement {
  public_id: string;
  message_km: string;
  message_en: string;
  severity: "info" | "warning";
  audience: "all" | "passengers" | "operators";
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export type TicketCategory = "refund_dispute" | "payment_failed" | "trip_complaint" | "account" | "other";
export type TicketStatus = "open" | "waiting_customer" | "resolved";

export interface SupportMessage {
  public_id: string;
  sender: "customer" | "staff";
  channel: "web" | "sms" | "telegram" | "email";
  body: string;
  author_name: string;
  created_at: string;
}

export interface SupportTicket {
  public_id: string;
  category: TicketCategory;
  priority: "low" | "normal" | "high";
  status: TicketStatus;
  subject: string;
  contact_phone: string;
  contact_name: string;
  language: "km" | "en";
  pnr: string;
  booking_public_id: string | null;
  sla_due_at: string;
  last_message_at: string;
  unread_by_staff: boolean;
  resolved_at: string | null;
  created_at: string;
  last_message_preview: string;
}

export interface SupportTicketDetail extends SupportTicket {
  messages: SupportMessage[];
}

export interface AuditLogEntry {
  public_id: string;
  action: string;
  target_model: string;
  target_id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  actor_name: string;
  actor_email: string;
  created_at: string;
}
