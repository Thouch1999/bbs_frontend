import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// Filled in during Step 13 (booking flow) — scaffolded now so
// SeatSelectionPage/CheckoutPage can be built against a stable shape.
export interface PendingPassenger {
  seatId: string;
  fullName: string;
  age: number;
  gender: "male" | "female" | "other";
}

export interface PendingBooking {
  tripId: string | null;
  holdToken: string | null;
  holdExpiresAt: string | null;
  seatIds: string[];
  passengers: PendingPassenger[];
  promoCode: string | null;
  boardingStopId: string | null;
  dropStopId: string | null;
}

const EMPTY_BOOKING: PendingBooking = {
  tripId: null,
  holdToken: null,
  holdExpiresAt: null,
  seatIds: [],
  passengers: [],
  promoCode: null,
  boardingStopId: null,
  dropStopId: null,
};

interface BookingContextValue {
  booking: PendingBooking;
  setBooking: (update: Partial<PendingBooking>) => void;
  resetBooking: () => void;
}

const BookingContext = createContext<BookingContextValue | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [booking, setBookingState] = useState<PendingBooking>(EMPTY_BOOKING);

  const setBooking = useCallback((update: Partial<PendingBooking>) => {
    setBookingState((current) => ({ ...current, ...update }));
  }, []);

  const resetBooking = useCallback(() => setBookingState(EMPTY_BOOKING), []);

  const value = useMemo(() => ({ booking, setBooking, resetBooking }), [booking, setBooking, resetBooking]);

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): BookingContextValue {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error("useBooking must be used within a BookingProvider");
  }
  return context;
}
