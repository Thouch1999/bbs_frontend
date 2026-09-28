import "fake-indexeddb/auto";

import { enqueueScans, queuedScans, removeQueued, resetConductorDbForTests, type ConductorManifestRow } from "./conductorDb";
import { decodeQrPayload, sha256Hex, sha256HexSync } from "./qr";
import { validatePnrLocally, validateTokenLocally, withPending } from "./validate";

// A token shaped exactly like Django's TimestampSigner output.
function tokenFor(pnr: string, signature = "sig123"): string {
  const payload = btoa(JSON.stringify({ pnr, booking_id: 7 })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${payload}:1abcde:${signature}`;
}

async function rowsFor(token: string, pnr: string, count = 2): Promise<ConductorManifestRow[]> {
  const fingerprint = await sha256Hex(token);
  return Array.from({ length: count }, (_, i) => ({
    booking_public_id: "b1",
    pnr,
    passenger_public_id: `p${i}`,
    full_name: `Passenger ${i}`,
    seat_number: `A${i + 1}`,
    boarded: false,
    phone: "",
    boarding_stop_name_en: "",
    boarding_stop_name_km: "",
    boarding_status: "",
    scanned_at: null,
    qr_token_sha256: fingerprint,
  }));
}

describe("offline ticket validation", () => {
  it("reads the PNR out of a signed token", () => {
    expect(decodeQrPayload(tokenFor("ABCD2345"))?.pnr).toBe("ABCD2345");
    expect(decodeQrPayload("not a ticket")).toBeNull();
  });

  it("pure-JS SHA-256 matches WebCrypto (used when crypto.subtle is missing)", async () => {
    for (const text of ["", "abc", tokenFor("ABCD2345"), "x".repeat(200)]) {
      expect(sha256HexSync(text)).toBe(await sha256Hex(text));
    }
    expect(sha256HexSync("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("accepts a genuine ticket and rejects a forged one with the same PNR", async () => {
    const token = tokenFor("ABCD2345");
    const rows = await rowsFor(token, "ABCD2345");
    expect((await validateTokenLocally(token, rows)).kind).toBe("valid");
    const forged = await validateTokenLocally(tokenFor("ABCD2345", "forged"), rows);
    expect(forged).toMatchObject({ kind: "invalid", reason: "tampered" });
    expect(await validateTokenLocally(tokenFor("ZZZZ9999"), rows)).toMatchObject({ reason: "not_on_this_trip" });
  });

  it("reports already-boarded with the first scan time, via queued offline scans too", async () => {
    const rows = await rowsFor(tokenFor("ABCD2345"), "ABCD2345");
    const queue = rows.map((row, i) => ({
      client_scan_id: `s${i}`,
      tripId: "t1",
      passenger_id: row.passenger_public_id,
      status: "boarded" as const,
      scanned_at: `2030-01-01T0${i}:00:00Z`,
    }));
    const result = validatePnrLocally("abcd2345", withPending(rows, queue));
    expect(result).toMatchObject({ kind: "already", firstScannedAt: "2030-01-01T00:00:00Z" });
  });

  it("boarded beats a later offline no-show", async () => {
    const rows = await rowsFor(tokenFor("ABCD2345"), "ABCD2345", 1);
    const merged = withPending(rows, [
      { client_scan_id: "a", tripId: "t", passenger_id: "p0", status: "boarded", scanned_at: "2030-01-01T00:00:00Z" },
      { client_scan_id: "b", tripId: "t", passenger_id: "p0", status: "no_show", scanned_at: "2030-01-01T00:05:00Z" },
    ]);
    expect(merged[0].boarding_status).toBe("boarded");
  });
});

describe("IndexedDB scan queue", () => {
  beforeEach(async () => {
    await resetConductorDbForTests();
  });

  it("queues per trip and removes synced scans", async () => {
    await enqueueScans([
      { client_scan_id: "1", tripId: "t1", passenger_id: "p1", status: "boarded", scanned_at: "2030-01-01T00:00:00Z" },
      { client_scan_id: "2", tripId: "t2", passenger_id: "p2", status: "boarded", scanned_at: "2030-01-01T00:00:00Z" },
    ]);
    expect((await queuedScans("t1")).map((s) => s.client_scan_id)).toEqual(["1"]);
    await removeQueued(["1"]);
    expect(await queuedScans("t1")).toEqual([]);
    expect(await queuedScans("t2")).toHaveLength(1);
  });
});
