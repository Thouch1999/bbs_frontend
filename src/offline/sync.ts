// Queue upload + manifest refresh for the conductor screen. The server's
// /boarding/trips/{id}/sync/ is idempotent (one BoardingRecord per
// passenger), so retrying after a dropped response can never double-board.
import { http } from "../api/client";
import type { ApiError } from "../api/types";
import type { OperatorTrip } from "../types/operator";
import {
  loadManifest,
  queuedScans,
  removeQueued,
  saveManifest,
  type CachedManifest,
  type ConductorManifestRow,
} from "./conductorDb";

export interface SyncOutcome {
  sent: number;
  applied: number;
  rejected: { passenger_id: string; reason: string }[];
}

interface SyncResultRow {
  client_scan_id: string;
  passenger_id: string;
  result: "applied" | "duplicate" | "superseded" | "rejected";
  reason?: string;
}

/** True when the request never reached the server (offline / DNS / timeout). */
export function isNetworkError(error: unknown): boolean {
  const e = error as ApiError | undefined;
  return !e?.status;
}

export async function fetchManifest(trip: OperatorTrip): Promise<CachedManifest> {
  const { data } = await http.get<ConductorManifestRow[]>(`/boarding/trips/${trip.public_id}/manifest/`);
  const manifest = { tripId: trip.public_id, trip, rows: data, fetchedAt: new Date().toISOString() };
  await saveManifest(manifest);
  return manifest;
}

/**
 * Uploads every queued scan for the trip. Any answer from the server —
 * applied, duplicate, superseded or rejected — is final for that scan, so it
 * leaves the queue; only a network failure keeps it queued for next time.
 */
export async function syncTrip(tripId: string): Promise<SyncOutcome> {
  const queue = await queuedScans(tripId);
  if (queue.length === 0) return { sent: 0, applied: 0, rejected: [] };
  const { data } = await http.post<SyncResultRow[]>(`/boarding/trips/${tripId}/sync/`, {
    scans: queue.map(({ client_scan_id, passenger_id, status, scanned_at }) => ({
      client_scan_id,
      passenger_id,
      status,
      scanned_at,
    })),
  });
  await removeQueued(data.map((row) => row.client_scan_id));
  return {
    sent: queue.length,
    applied: data.filter((row) => row.result === "applied").length,
    rejected: data
      .filter((row) => row.result === "rejected")
      .map((row) => ({ passenger_id: row.passenger_id, reason: row.reason ?? "" })),
  };
}

/** Sync, then refresh the cached manifest (keeps the cached copy if offline). */
export async function syncAndRefresh(trip: OperatorTrip): Promise<{ manifest: CachedManifest | undefined; outcome: SyncOutcome | null }> {
  let outcome: SyncOutcome | null = null;
  try {
    outcome = await syncTrip(trip.public_id);
    return { manifest: await fetchManifest(trip), outcome };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    return { manifest: await loadManifest(trip.public_id), outcome };
  }
}
