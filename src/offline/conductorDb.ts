// IndexedDB cache for the conductor screen (SRS 3.4): today's trips, each
// trip's manifest, and the queue of scans made while offline. Everything the
// scanner needs to validate a ticket with the network switched off lives here.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { OperatorTrip } from "../types/operator";

export interface ConductorManifestRow {
  booking_public_id: string;
  pnr: string;
  passenger_public_id: string;
  full_name: string;
  seat_number: string;
  boarded: boolean;
  phone: string;
  boarding_stop_name_en: string;
  boarding_stop_name_km: string;
  boarding_status: "" | "boarded" | "no_show";
  scanned_at: string | null;
  qr_token_sha256: string;
}

export interface CachedManifest {
  tripId: string;
  trip: OperatorTrip;
  rows: ConductorManifestRow[];
  fetchedAt: string;
}

export interface QueuedScan {
  client_scan_id: string;
  tripId: string;
  passenger_id: string;
  status: "boarded" | "no_show";
  scanned_at: string;
}

interface ConductorSchema extends DBSchema {
  trips: { key: string; value: { day: string; trips: OperatorTrip[]; fetchedAt: string } };
  manifests: { key: string; value: CachedManifest };
  queue: { key: string; value: QueuedScan; indexes: { byTrip: string } };
}

const DB_NAME = "bbms-conductor";
let dbPromise: Promise<IDBPDatabase<ConductorSchema>> | null = null;

export function conductorDb(): Promise<IDBPDatabase<ConductorSchema>> {
  dbPromise ??= openDB<ConductorSchema>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore("trips");
      db.createObjectStore("manifests", { keyPath: "tripId" });
      db.createObjectStore("queue", { keyPath: "client_scan_id" }).createIndex("byTrip", "tripId");
    },
  });
  return dbPromise;
}

/** Test hook: close and delete the database. The connection must be closed
 * first — an open handle blocks deleteDatabase() indefinitely. */
export async function resetConductorDbForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveTrips(day: string, trips: OperatorTrip[]): Promise<void> {
  await (await conductorDb()).put("trips", { day, trips, fetchedAt: new Date().toISOString() }, day);
}

export async function loadTrips(day: string) {
  return (await conductorDb()).get("trips", day);
}

export async function saveManifest(manifest: CachedManifest): Promise<void> {
  await (await conductorDb()).put("manifests", manifest);
}

export async function loadManifest(tripId: string): Promise<CachedManifest | undefined> {
  return (await conductorDb()).get("manifests", tripId);
}

export async function enqueueScans(scans: QueuedScan[]): Promise<void> {
  const db = await conductorDb();
  const tx = db.transaction("queue", "readwrite");
  await Promise.all([...scans.map((scan) => tx.store.put(scan)), tx.done]);
}

export async function queuedScans(tripId: string): Promise<QueuedScan[]> {
  return (await conductorDb()).getAllFromIndex("queue", "byTrip", tripId);
}

export async function removeQueued(ids: string[]): Promise<void> {
  const db = await conductorDb();
  const tx = db.transaction("queue", "readwrite");
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}
