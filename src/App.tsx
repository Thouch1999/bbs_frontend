import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "./context/AuthContext";
import { BookingProvider } from "./context/BookingContext";
import { LocaleProvider } from "./context/LocaleContext";
import { AppRoutes } from "./routes/AppRoutes";

// Defaults tuned for a low-bandwidth mobile network (SRS): don't hammer a
// flaky connection with retries, but keep a short staleTime so navigating
// back to a screen doesn't always show a loading spinner.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AuthProvider>
          <BookingProvider>
            <AppRoutes />
          </BookingProvider>
        </AuthProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
