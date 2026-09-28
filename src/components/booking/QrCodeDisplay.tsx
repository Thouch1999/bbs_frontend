import { QRCodeSVG } from "qrcode.react";

export function QrCodeDisplay({ value, size = 180 }: { value: string; size?: number }) {
  return (
    <div className="d-flex justify-content-center bg-white p-2">
      <QRCodeSVG value={value} size={size} level="M" />
    </div>
  );
}
