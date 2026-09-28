// Camera QR reader (html5-qrcode). Camera access needs a secure context
// (https or localhost) — anywhere else it says so, and the manual PNR box
// next to it is the fallback (playbook S2).
import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface QrScannerProps {
  paused: boolean;
  onScan: (text: string) => void;
}

export function QrScanner({ paused, onScan }: QrScannerProps) {
  const { t } = useTranslation("conductor");
  const regionId = `qr-${useId().replace(/:/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const lastRef = useRef<{ text: string; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices) {
      setError("insecure");
      return;
    }
    const scanner = new Html5Qrcode(regionId, { verbose: false });
    scannerRef.current = scanner;
    let stopped = false;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.7, height: Math.min(w, h) * 0.7 }) },
        (text) => {
          // Ignore the same code held in front of the camera for a few seconds.
          const now = Date.now();
          if (lastRef.current && lastRef.current.text === text && now - lastRef.current.at < 4000) return;
          lastRef.current = { text, at: now };
          onScanRef.current(text);
        },
        () => undefined
      )
      .catch(() => {
        if (!stopped) setError("camera");
      });
    return () => {
      stopped = true;
      if (scanner.isScanning) void scanner.stop().catch(() => undefined);
    };
  }, [regionId]);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner?.isScanning) return;
    try {
      if (paused) scanner.pause(true);
      else scanner.resume();
    } catch {
      // pause/resume throw if the state already matches
    }
  }, [paused]);

  return (
    <div className="bbms-scan-viewport">
      <div id={regionId} className="bbms-scan-video" />
      <span className="bbms-scan-corner tl" aria-hidden="true" />
      <span className="bbms-scan-corner tr" aria-hidden="true" />
      <span className="bbms-scan-corner bl" aria-hidden="true" />
      <span className="bbms-scan-corner br" aria-hidden="true" />
      {error && (
        <div className="bbms-scan-message">
          <i className="fas fa-video-slash fs-1 mb-2" aria-hidden="true" />
          <div>{error === "insecure" ? t("scan.camera_insecure") : t("scan.camera_error")}</div>
        </div>
      )}
    </div>
  );
}
