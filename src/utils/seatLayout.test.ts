import {
  asPreviewTripSeats,
  clampToGrid,
  generateSeats,
  gridSizeOf,
  moveSeat,
  toggleSeatAt,
  validateSeats,
} from "./seatLayout";

describe("seat layout builder", () => {
  it("generates a grid with an aisle column, like the backend build action", () => {
    const seats = generateSeats(2, "AB_C");
    expect(seats.map((s) => [s.seat_number, s.row_position, s.col_position])).toEqual([
      ["A1", 1, 1],
      ["B1", 1, 2],
      ["C1", 1, 4],
      ["A2", 2, 1],
      ["B2", 2, 2],
      ["C2", 2, 4],
    ]);
    expect(gridSizeOf(seats)).toEqual({ rows: 2, columns: 4 });
  });

  it("prefixes upper-deck seat numbers", () => {
    const seats = generateSeats(1, "A", 2);
    expect(seats.map((s) => `${s.deck}:${s.seat_number}`)).toEqual(["1:A1", "2:UA1"]);
  });

  it("toggles seats on and off with a non-colliding number", () => {
    let seats = generateSeats(1, "AB");
    seats = toggleSeatAt(seats, 1, 1, 2); // remove B1
    expect(seats.map((s) => s.seat_number)).toEqual(["A1"]);
    seats = toggleSeatAt(seats, 1, 2, 1); // add at row 2 col 1
    expect(seats.find((s) => s.row_position === 2)?.seat_number).toBe("A2");
  });

  it("moves a seat and swaps with an occupied target", () => {
    const seats = generateSeats(1, "AB");
    const moved = moveSeat(seats, { deck: 1, row: 1, col: 1 }, { deck: 1, row: 1, col: 2 });
    expect(moved.map((s) => [s.seat_number, s.col_position])).toEqual([
      ["A1", 2],
      ["B1", 1],
    ]);
  });

  it("drops seats outside a shrunk grid", () => {
    const seats = generateSeats(3, "ABC");
    expect(clampToGrid(seats, { rows: 2, columns: 2 }, 1)).toHaveLength(4);
  });

  it("flags duplicate numbers and positions the backend would reject", () => {
    const seats = generateSeats(1, "AB");
    seats[1] = { ...seats[1], seat_number: "a1" };
    expect(validateSeats(seats)).toEqual([{ kind: "duplicate_number", seatNumber: "A1" }]);
    expect(validateSeats([])).toEqual([{ kind: "empty" }]);
  });

  it("renders the draft as available passenger TripSeats with the same positions", () => {
    const [seat] = asPreviewTripSeats([
      { seat_number: "c1", deck: 1, row_position: 3, col_position: 4, seat_type: "vip", is_female_only: true },
    ]);
    expect(seat.status).toBe("available");
    expect(seat.seat).toMatchObject({ seat_number: "C1", row_position: 3, col_position: 4, is_female_only: true });
  });
});
