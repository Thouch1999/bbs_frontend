// Offline ticket validation against the cached manifest — pure functions, so
// the rules are unit-tested and identical whether the check came from a QR
// scan or a typed PNR.
import type { ConductorManifestRow, QueuedScan } from "./conductorDb";
import { decodeQrPayload, sha256Hex } from "./qr";

export type LocalReason = "not_a_ticket" | "not_on_this_trip" | "tampered";

export type LocalResult =
  | { kind: "valid"; pnr: string; rows: ConductorManifestRow[] }
  | { kind: "already"; pnr: string; rows: ConductorManifestRow[]; firstScannedAt: string | null }
  | { kind: "invalid"; reason: LocalReason; pnr?: string };

/** Rows with any queued, not-yet-synced change applied on top. */
export function withPending(rows: ConductorManifestRow[], queue: QueuedScan[]): ConductorManifestRow[] {
  const latest = new Map<string, QueuedScan>();
  for (const scan of queue) {
    const current = latest.get(scan.passenger_id);
    // "boarded" always wins over "no_show", matching the server's sync rule.
    if (!current || (scan.status === "boarded" && current.status !== "boarded")) latest.set(scan.passenger_id, scan);
  }
  return rows.map((row) => {
    const scan = latest.get(row.passenger_public_id);
    if (!scan || row.boarding_status === "boarded") return row;
    return {
      ...row,
      boarding_status: scan.status,
      boarded: scan.status === "boarded",
      scanned_at: scan.scanned_at,
    };
  });
}

function checkBooking(rows: ConductorManifestRow[], pnr: string): LocalResult {
  const bookingRows = rows.filter((row) => row.pnr === pnr);
  if (bookingRows.length === 0) return { kind: "invalid", reason: "not_on_this_trip", pnr };
  const boarded = bookingRows.filter((row) => row.boarding_status === "boarded");
  if (boarded.length === bookingRows.length) {
    const firstScannedAt = boarded.map((row) => row.scanned_at).filter(Boolean).sort()[0] ?? null;
    return { kind: "already", pnr, rows: bookingRows, firstScannedAt };
  }
  return { kind: "valid", pnr, rows: bookingRows };
}

export async function validateTokenLocally(token: string, rows: ConductorManifestRow[]): Promise<LocalResult> {
  const payload = decodeQrPayload(token);
  if (!payload) return { kind: "invalid", reason: "not_a_ticket" };
  const result = checkBooking(rows, payload.pnr.toUpperCase());
  if (result.kind === "invalid") return result;
  // A real PNR inside a forged/edited token: the fingerprint won't match.
  const fingerprint = await sha256Hex(token.trim());
  if (!result.rows.some((row) => row.qr_token_sha256 === fingerprint)) {
    return { kind: "invalid", reason: "tampered", pnr: result.pnr };
  }
  return result;
}

export function validatePnrLocally(pnr: string, rows: ConductorManifestRow[]): LocalResult {
  const cleaned = pnr.trim().toUpperCase();
  if (!cleaned) return { kind: "invalid", reason: "not_a_ticket" };
  return checkBooking(rows, cleaned);
}

export function newScanId(): string {
  // The DOM typings declare randomUUID unconditionally; browsers only expose
  // it in a secure context, so check at runtime.
  if (globalThis.isSecureContext && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Otherwise an RFC 4122 v4 UUID from getRandomValues (available everywhere).
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
