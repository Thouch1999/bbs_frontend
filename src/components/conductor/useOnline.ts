import { useEffect, useState } from "react";

/** navigator.onLine, kept live. The conductor screen also flips itself to
 * offline when a request fails without a response (captive portals and dead
 * mobile data often still report "online"). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
