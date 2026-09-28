import { useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { TripSeat } from "../../types";

interface SeatMapProps {
  seats: TripSeat[];
  selectedSeatIds: string[];
  onChangeSelection: (seatIds: string[]) => void;
  maxSeats?: number;
}

function seatClassName(seat: TripSeat, isSelected: boolean): string {
  const classes = ["bbms-seat-button"];
  if (isSelected) classes.push("is-selected");
  else if (seat.status === "held") classes.push("is-held");
  else if (seat.status === "booked") classes.push("is-booked");
  if (seat.seat.is_female_only) classes.push("is-female-only");
  return classes.join(" ");
}

export function SeatMap({ seats, selectedSeatIds, onChangeSelection, maxSeats }: SeatMapProps) {
  const { t } = useTranslation("booking");
  const decks = useMemo(() => Array.from(new Set(seats.map((s) => s.seat.deck))).sort(), [seats]);
  const [activeDeck, setActiveDeck] = useState(decks[0] ?? 1);

  const deckSeats = seats.filter((s) => s.seat.deck === activeDeck);
  const cols = Math.max(1, ...deckSeats.map((s) => s.seat.col_position));

  function toggleSeat(seat: TripSeat) {
    if (seat.status !== "available") return;
    const seatId = seat.seat.public_id;
    if (selectedSeatIds.includes(seatId)) {
      onChangeSelection(selectedSeatIds.filter((id) => id !== seatId));
    } else {
      if (maxSeats !== undefined && selectedSeatIds.length >= maxSeats) return;
      onChangeSelection([...selectedSeatIds, seatId]);
    }
  }

  return (
    <div>
      {decks.length > 1 && (
        <div className="btn-group mb-3" role="group">
          {decks.map((deck) => (
            <button
              key={deck}
              type="button"
              className={`btn btn-outline-primary ${activeDeck === deck ? "active" : ""}`}
              onClick={() => setActiveDeck(deck)}
            >
              {deck === 1 ? t("seat_map.deck_lower") : t("seat_map.deck_upper")}
            </button>
          ))}
        </div>
      )}
      <div className="bbms-seat-map" style={{ "--bbms-seat-cols": cols } as CSSProperties}>
        {deckSeats.map((seat) => {
          const isSelected = selectedSeatIds.includes(seat.seat.public_id);
          const atCapacity = !isSelected && maxSeats !== undefined && selectedSeatIds.length >= maxSeats;
          return (
            <button
              key={seat.public_id}
              type="button"
              className={seatClassName(seat, isSelected)}
              disabled={seat.status !== "available" || atCapacity}
              onClick={() => toggleSeat(seat)}
              aria-pressed={isSelected}
              aria-label={seat.seat.seat_number}
              style={{
                gridColumn: seat.seat.col_position,
                gridRow: seat.seat.row_position,
              }}
            >
              {seat.seat.seat_number}
            </button>
          );
        })}
      </div>
    </div>
  );
}
