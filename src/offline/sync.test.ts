import "fake-indexeddb/auto";

import MockAdapter from "axios-mock-adapter";

import { http } from "../api/client";
import { enqueueScans, queuedScans, resetConductorDbForTests } from "./conductorDb";
import { isNetworkError, syncTrip } from "./sync";

const mock = new MockAdapter(http);
const scan = (id: string) => ({
  client_scan_id: id,
  tripId: "trip-1",
  passenger_id: `p-${id}`,
  status: "boarded" as const,
  scanned_at: "2030-01-01T00:00:00Z",
});

describe("offline scan sync", () => {
  beforeEach(async () => {
    mock.reset();
    await resetConductorDbForTests();
  });

  it("keeps scans queued while the network is down, then clears them once the server answers", async () => {
    await enqueueScans([scan("1"), scan("2")]);

    mock.onPost("/boarding/trips/trip-1/sync/").networkErrorOnce();
    const failure = await syncTrip("trip-1").catch((error) => error);
    expect(isNetworkError(failure)).toBe(true);
    expect(await queuedScans("trip-1")).toHaveLength(2); // nothing lost

    mock.onPost("/boarding/trips/trip-1/sync/").reply(200, [
      { client_scan_id: "1", passenger_id: "p-1", result: "applied" },
      { client_scan_id: "2", passenger_id: "p-2", result: "duplicate" },
    ]);
    const outcome = await syncTrip("trip-1");
    expect(outcome).toEqual({ sent: 2, applied: 1, rejected: [] });
    expect(await queuedScans("trip-1")).toEqual([]);
  });

  it("does nothing when the queue is empty", async () => {
    expect(await syncTrip("trip-1")).toEqual({ sent: 0, applied: 0, rejected: [] });
    expect(mock.history.post).toHaveLength(0);
  });
});
