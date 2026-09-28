import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const WARNING_THRESHOLD_MS = 2 * 60 * 1000;

interface HoldTimerProps {
  expiresAt: string;
  onExpire: () => void;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function HoldTimer({ expiresAt, onExpire }: HoldTimerProps) {
  const { t } = useTranslation("booking");
  const expiryTime = useRef(new Date(expiresAt).getTime());
  const hasExpired = useRef(false);
  const [remainingMs, setRemainingMs] = useState(() => expiryTime.current - Date.now());

  useEffect(() => {
    expiryTime.current = new Date(expiresAt).getTime();
    hasExpired.current = false;

    const tick = () => {
      const remaining = expiryTime.current - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0 && !hasExpired.current) {
        hasExpired.current = true;
        onExpire();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onExpire is expected to be stable per mount
  }, [expiresAt]);

  const isWarning = remainingMs <= WARNING_THRESHOLD_MS && remainingMs > 0;

  return (
    <div className={`d-flex align-items-center gap-2 ${isWarning ? "text-warning fw-semibold" : "text-muted"}`}>
      <span>{t("hold_timer.label")}</span>
      <span className="fs-5 font-monospace">{formatRemaining(remainingMs)}</span>
      {isWarning && <span>{t("hold_timer.warning")}</span>}
    </div>
  );
}
