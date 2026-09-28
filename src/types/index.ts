// Hand-written types for the booking domain, kept close to the actual
// serializer output (apps/trips, apps/bookings, apps/payments,
// apps/routes on the backend) rather than threaded through
// ./generated.ts's verbose `components["schemas"][...]` paths — this file
// IS the "hand-written extension" layer SRS 9 describes. Regenerate
// ./generated.ts via `npm run types:gen` after any backend serializer
// change; update these by hand to match.

export interface City {
  public_id: string;
  name_en: string;
  name_km: string;
  country_code: string;
}

export interface Stop {
  public_id: string;
  city: City;
  name_en: string;
  name_km: string;
  address: string;
  lat: string | null;
  lng: string | null;
}

export interface RouteStopEntry {
  public_id: string;
  stop: Stop;
  sequence: number;
  offset_minutes: number;
}

export interface Route {
  public_id: string;
  name: string;
  origin_city: City;
  destination_city: City;
  distance_km: string | null;
  estimated_duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

export type TripStatus = "scheduled" | "delayed" | "cancelled" | "departed" | "completed";
export type BusType = "seated" | "sleeper" | "mixed";

export interface Trip {
  public_id: string;
  route: Route;
  operator_name: string;
  bus_plate_number: string;
  bus_type: BusType;
  amenities: string[];
  departure_at: string;
  arrival_at: string;
  base_fare_usd: string;
  base_fare_khr: string;
  seats_available: number;
  status: TripStatus;
  delay_minutes: number | null;
  cancellation_reason: string;
}

export type SeatStatus = "available" | "held" | "booked";
export type SeatType = "normal" | "vip";

export interface Seat {
  public_id: string;
  seat_number: string;
  deck: number;
  row_position: number;
  col_position: number;
  seat_type: SeatType;
  is_female_only: boolean;
}

export interface TripSeat {
  public_id: string;
  seat: Seat;
  status: SeatStatus;
}

export interface HoldSeatsResponse {
  hold_token: string;
  held_until: string;
  seat_ids: string[];
}

export interface ReleaseSeatsResponse {
  released: number;
}

export interface PromoValidateResponse {
  subtotal: string;
  discount_amount: string;
}

export type Gender = "male" | "female" | "other" | "";

export interface PassengerInput {
  full_name: string;
  age?: number;
  gender?: Gender;
  phone?: string;
  id_document_number?: string;
}

export interface CreateBookingRequest {
  trip_id: string;
  hold_token: string;
  passengers: PassengerInput[];
  contact_phone: string;
  contact_email?: string | null;
  currency?: "KHR" | "USD";
  boarding_stop_id?: string | null;
  drop_stop_id?: string | null;
  promo_code?: string;
}

export type BookingStatus = "pending_payment" | "confirmed" | "cancelled" | "completed";

export interface BookingPassenger {
  public_id: string;
  full_name: string;
  age: number | null;
  gender: string;
  phone: string;
  id_document_number: string;
  seat_number: string;
}

export interface Booking {
  public_id: string;
  pnr: string;
  trip_public_id: string;
  departure_at: string;
  status: BookingStatus;
  booking_channel: "web" | "counter" | "telegram";
  currency: "KHR" | "USD";
  subtotal_amount: string;
  discount_amount: string;
  fee_amount: string;
  total_amount: string;
  promo_code: string;
  contact_phone: string;
  contact_email: string | null;
  qr_token: string;
  passengers: BookingPassenger[];
  cancelled_at: string | null;
  cancellation_reason: string;
  refund_percentage: string | null;
  refund_amount: string | null;
  rescheduled_at: string | null;
  reschedule_fee_amount: string | null;
  fare_difference_amount: string | null;
  created_at: string;
}

export type PaymentProvider = "aba_payway" | "wing" | "acleda" | "counter" | "mock" | "demo";
export type PaymentStatus = "pending" | "succeeded" | "failed";

export interface Payment {
  public_id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: string;
  currency: "KHR" | "USD";
  provider_txn_id: string | null;
  created_at: string;
}

export interface CounterGatewayPayload {
  pay_at_counter: true;
  deadline: string;
}

export interface RedirectGatewayPayload {
  redirect_url: string;
  qr_payload: string;
  merchant_ref: string;
}

export type GatewayPayload = CounterGatewayPayload | RedirectGatewayPayload | Record<string, unknown>;

export interface InitiatePaymentResponse {
  payment: Payment;
  gateway: GatewayPayload;
}

export interface CancellationPreview {
  refund_percentage: string;
  refund_amount: string;
}

export interface ReschedulePreview {
  fare_difference_amount: string;
  reschedule_fee_amount: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export type UserRole = "passenger" | "operator_staff" | "admin";

export interface Profile {
  public_id: string;
  email: string;
  phone: string;
  full_name: string;
  role: UserRole;
  preferred_language: "km" | "en";
  preferred_currency: "KHR" | "USD";
  /** Null unless role is operator_staff — see ./operator.ts. */
  operator_staff: import("./operator").OperatorStaffProfile | null;
}

