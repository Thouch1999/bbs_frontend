// Pure seat-layout-builder logic (no React), shared by the builder UI and its
// tests. The builder's output is exactly the Seat shape the passenger
// SeatMap already renders from (deck / row_position / col_position — an
// empty column is an aisle), so a saved layout needs no translation layer.
import type { SeatInput } from "../types/operator";
import type { TripSeat } from "../types";

export const MAX_ROWS = 20;
export const MAX_COLUMNS = 10;

export interface GridSize {
  rows: number;
  columns: number;
}

export function positionKey(deck: number, row: number, col: number): string {
  return `${deck}:${row}:${col}`;
}

export function gridSizeOf(seats: SeatInput[]): GridSize {
  return {
    rows: Math.max(1, ...seats.map((s) => s.row_position)),
    columns: Math.max(1, ...seats.map((s) => s.col_position)),
  };
}

/**
 * A fresh grid like the backend's `build` action: `pattern` is one row's
 * left-to-right slots, a letter per seat column and "_" for an aisle
 * ("AB_CD"). Deck 2 seat numbers get a "U" prefix so they never collide.
 */
export function generateSeats(rows: number, pattern: string, decks = 1): SeatInput[] {
  const seats: SeatInput[] = [];
  const slots = pattern.toUpperCase().split("");
  for (let deck = 1; deck <= decks; deck += 1) {
    for (let row = 1; row <= rows; row += 1) {
      slots.forEach((slot, index) => {
        if (slot === "_" || slot === " ") return;
        seats.push({
          seat_number: `${deck === 2 ? "U" : ""}${slot}${row}`,
          deck,
          row_position: row,
          col_position: index + 1,
          seat_type: "normal",
          is_female_only: false,
        });
      });
    }
  }
  return seats;
}

function nextFreeNumber(seats: SeatInput[], deck: number, row: number, col: number): string {
  const taken = new Set(seats.map((s) => s.seat_number));
  const base = `${deck === 2 ? "U" : ""}${String.fromCharCode(64 + Math.min(col, 26))}${row}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Click on an empty grid cell adds a seat; on a seat removes it. */
export function toggleSeatAt(seats: SeatInput[], deck: number, row: number, col: number): SeatInput[] {
  const existing = seats.find((s) => s.deck === deck && s.row_position === row && s.col_position === col);
  if (existing) return seats.filter((s) => s !== existing);
  return [
    ...seats,
    {
      seat_number: nextFreeNumber(seats, deck, row, col),
      deck,
      row_position: row,
      col_position: col,
      seat_type: "normal",
      is_female_only: false,
    },
  ];
}

/** Drag-and-drop: move a seat to a cell, swapping with whatever is there. */
export function moveSeat(
  seats: SeatInput[],
  from: { deck: number; row: number; col: number },
  to: { deck: number; row: number; col: number }
): SeatInput[] {
  const at = (p: { deck: number; row: number; col: number }) => (s: SeatInput) =>
    s.deck === p.deck && s.row_position === p.row && s.col_position === p.col;
  const moving = seats.find(at(from));
  if (!moving) return seats;
  const occupant = seats.find(at(to));
  return seats.map((s) => {
    if (s === moving) return { ...s, deck: to.deck, row_position: to.row, col_position: to.col };
    if (s === occupant) return { ...s, deck: from.deck, row_position: from.row, col_position: from.col };
    return s;
  });
}

/** Drops seats that fall outside a shrunk grid. */
export function clampToGrid(seats: SeatInput[], size: GridSize, decks: number): SeatInput[] {
  return seats.filter((s) => s.row_position <= size.rows && s.col_position <= size.columns && s.deck <= decks);
}

export type LayoutProblem =
  | { kind: "empty" }
  | { kind: "missing_number" }
  | { kind: "duplicate_number"; seatNumber: string }
  | { kind: "duplicate_position"; seatNumber: string };

/** Mirrors apps.fleet.services.replace_layout_seats's validation, so the
 * builder can flag problems before the save round-trip. */
export function validateSeats(seats: SeatInput[]): LayoutProblem[] {
  if (seats.length === 0) return [{ kind: "empty" }];
  const problems: LayoutProblem[] = [];
  const numbers = new Set<string>();
  const positions = new Set<string>();
  for (const seat of seats) {
    const number = seat.seat_number.trim().toUpperCase();
    if (!number) {
      problems.push({ kind: "missing_number" });
      continue;
    }
    if (numbers.has(number)) problems.push({ kind: "duplicate_number", seatNumber: number });
    const key = positionKey(seat.deck, seat.row_position, seat.col_position);
    if (positions.has(key)) problems.push({ kind: "duplicate_position", seatNumber: number });
    numbers.add(number);
    positions.add(key);
  }
  return problems;
}

/** The draft as passenger-site TripSeats (all available) — so the builder's
 * preview IS the passenger SeatMap component, not a look-alike. */
export function asPreviewTripSeats(seats: SeatInput[]): TripSeat[] {
  return seats.map((seat) => {
    const id = `preview-${positionKey(seat.deck, seat.row_position, seat.col_position)}`;
    return {
      public_id: id,
      status: "available",
      seat: { public_id: id, ...seat, seat_number: seat.seat_number.trim().toUpperCase() },
    };
  });
}
