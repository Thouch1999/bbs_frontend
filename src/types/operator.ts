// Back-office (operator) response shapes — hand-written to match the Step 15
// serializers in apps/trips, apps/fleet, apps/routes, apps/bookings,
// apps/boarding, apps/operators and apps/reports, same convention as
// ./index.ts. Regenerate ./generated.ts (`npm run types:gen`) after a
// backend serializer change and update these by hand to match.
import type { Booking, BusType, Route, Seat, SeatType, Stop, Trip, TripStatus } from "./index";

export type StaffRole = "owner" | "manager" | "counter_agent" | "conductor";
export type Currency = "KHR" | "USD";

export interface OperatorStaffProfile {
  operator_public_id: string;
  operator_name: string;
  operator_name_km: string;
  operator_status: "pending" | "approved" | "rejected" | "suspended";
  staff_role: StaffRole;
  can_create_bookings: boolean;
  can_validate_tickets: boolean;
}

export interface PublicConfig {
  khr_per_usd: string;
  seat_hold_minutes: number;
  counter_payment_deadline_minutes: number;
  booking_fee_usd: string;
  booking_fee_khr: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// --- Trips ----------------------------------------------------------------
export interface OperatorTrip extends Trip {
  bus_public_id: string;
  operator_phone: string;
  seats_total: number;
  seats_sold: number;
  bookings_count: number;
  revenue_usd: string;
  revenue_khr: string;
  driver_name: string;
  driver_phone: string;
  conductor_id: string | null;
  conductor_name: string | null;
}

export interface TripWrite {
  route_id: string;
  bus_id: string;
  departure_at: string;
  arrival_at: string;
  base_fare_usd: string;
  base_fare_khr: string;
  driver_name?: string;
  driver_phone?: string;
  conductor_id?: string | null;
}

export interface RecurringTripWrite {
  route_id: string;
  bus_id: string;
  start_date: string;
  end_date: string;
  weekdays: number[];
  departure_time: string;
  duration_minutes?: number;
  base_fare_usd: string;
  base_fare_khr: string;
  peak_start_date?: string | null;
  peak_end_date?: string | null;
  peak_multiplier?: string | null;
  driver_name?: string;
  driver_phone?: string;
  conductor_id?: string | null;
}

export interface OperatorTripQuery {
  date_from?: string;
  date_to?: string;
  route?: string;
  bus?: string;
  status?: string;
  unassigned?: boolean;
  page?: number;
  page_size?: number;
}

export type TripStatusChange = "scheduled" | "delayed" | "cancelled";

export interface TripStatusUpdate {
  status: TripStatusChange;
  delay_minutes?: number;
  cancellation_reason?: string;
}

export interface TripStatusPreview {
  bookings_count: number;
  passengers_count: number;
  channels: Record<string, number>;
  messages: Partial<Record<"km" | "en", string>>;
}

export interface ManifestRow {
  booking_public_id: string;
  pnr: string;
  passenger_public_id: string;
  full_name: string;
  age: number | null;
  gender: string;
  phone: string;
  seat_number: string;
  seat_public_id: string;
  boarding_stop_name_en: string;
  boarding_stop_name_km: string;
  booking_status: string;
  booking_channel: "web" | "counter" | "telegram";
  payment_status: "paid" | "pay_at_counter" | "pending";
  boarding_status: "" | "boarded" | "no_show";
  boarded: boolean;
}

// --- Fleet ----------------------------------------------------------------
export interface SeatLayout {
  public_id: string;
  name: string;
  bus_type: BusType;
  deck_count: number;
  seats: Seat[];
  in_use: boolean;
  bus_count: number;
  created_at: string;
}

export interface SeatInput {
  seat_number: string;
  deck: number;
  row_position: number;
  col_position: number;
  seat_type: SeatType;
  is_female_only: boolean;
}

export type BusStatus = "active" | "maintenance" | "retired";
export type Amenity = "ac" | "wifi" | "usb" | "toilet" | "blanket" | "water";

export interface Bus {
  public_id: string;
  plate_number: string;
  seat_layout: SeatLayout;
  amenities: Amenity[];
  photo: string | null;
  status: BusStatus;
  registration_expires_on: string | null;
  insurance_expires_on: string | null;
}

export interface BusWrite {
  plate_number: string;
  seat_layout_id: string;
  amenities: Amenity[];
  status: BusStatus;
  registration_expires_on: string | null;
  insurance_expires_on: string | null;
}

// --- Routes ---------------------------------------------------------------
export interface OperatorRoute extends Route {
  stops_count: number;
}

export interface RouteWrite {
  name: string;
  origin_city_id: string;
  destination_city_id: string;
  distance_km: string | null;
  estimated_duration_minutes: number | null;
  is_active: boolean;
}

export interface RouteStopItem {
  route_stop_id?: string | null;
  stop_id: string;
  offset_minutes: number;
}

export interface StopWrite {
  city_id: string;
  name_en: string;
  name_km: string;
  address?: string;
}

export type { Stop };

// --- Bookings -------------------------------------------------------------
export interface OperatorBooking extends Booking {
  route_name: string;
  bus_plate_number: string;
  trip_status: TripStatus;
  boarding_stop_name_en: string;
  boarding_stop_name_km: string;
  drop_stop_name_en: string;
  drop_stop_name_km: string;
  booked_by_staff_name: string;
  payment_provider: string;
  pending_counter_payment_id: string | null;
}

export interface OperatorBookingQuery {
  trip?: string;
  status?: string;
  channel?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  pending_counter?: boolean;
  page?: number;
  page_size?: number;
}

export interface ReturningCustomer {
  contact_phone: string;
  contact_email: string | null;
  bookings_count: number;
  passengers: { full_name: string; age: number | null; gender: string; phone: string }[];
}

// --- Staff ----------------------------------------------------------------
export interface StaffMember {
  public_id: string;
  email: string;
  full_name: string;
  staff_role: StaffRole;
  can_create_bookings: boolean;
  can_validate_tickets: boolean;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface StaffCreate {
  email: string;
  full_name: string;
  password: string;
  staff_role: "counter_agent" | "conductor";
  can_create_bookings?: boolean | null;
  can_validate_tickets?: boolean | null;
}

export type StaffUpdate = Partial<
  Pick<StaffMember, "full_name" | "can_create_bookings" | "can_validate_tickets" | "is_active"> & {
    staff_role: "counter_agent" | "conductor";
  }
>;

// --- Reports --------------------------------------------------------------
export type RevenueGroupBy = "route" | "bus" | "payment_method" | "channel" | "day";

export interface RevenueRow {
  route_public_id?: string;
  route_name?: string;
  bus_public_id?: string;
  plate_number?: string;
  provider?: string;
  channel?: string;
  date?: string;
  currency: Currency;
  total_amount: string;
  commission_amount: string;
  net_amount: string;
  payment_count: number;
}

export interface OccupancyRow {
  public_id: string;
  departure_at: string;
  route_public_id: string;
  route_name: string;
  total_seats: number;
  booked_seats: number;
  occupancy_rate: string;
}

export interface CancellationSummary {
  cancelled_count: number;
  total_refund_usd: string;
  total_refund_khr: string;
}

export interface DashboardTrip {
  public_id: string;
  route_name: string;
  plate_number: string;
  departure_at: string;
  status: TripStatus;
  delay_minutes: number | null;
}

export interface OperatorDashboard {
  date: string;
  trips_today: number;
  trips_remaining_today: number;
  bookings_today: number;
  seats_sold_today: number;
  seats_total_today: number;
  occupancy_rate_today: string;
  revenue_today: { usd: string; khr: string };
  delayed_trips: DashboardTrip[];
  departing_soon: DashboardTrip[];
  attention: {
    pending_counter_payments: number;
    refunds_to_process: number;
    unassigned_trips: number;
    expiring_bus_documents: number;
  };
  revenue_series: { date: string; currency: Currency; total_amount: string }[];
  top_routes: { public_id: string; name: string; seats_sold: number }[];
}

export interface DateRange {
  date_from: string;
  date_to: string;
}
