// S2 — boarding validation at the bus door. Works fully offline (SRS 3.4):
// today's trips and each trip's manifest are cached in IndexedDB, tickets are
// checked against the cached manifest (PNR + SHA-256 token fingerprint) when
// there's no network, scans queue locally and sync — idempotently — when
// connectivity returns. Online, the server validates (precise reasons:
// wrong trip / cancelled / unpaid) and the cache is updated to match.
import "@fortawesome/fontawesome-free/css/all.min.css";
import "../../styles/conductor.scss";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { http } from "../../api/client";
import type { ApiError } from "../../api/types";
import { playCue } from "../../components/conductor/feedback";
import { QrScanner } from "../../components/conductor/QrScanner";
import { useOnline } from "../../components/conductor/useOnline";
import { useLocale } from "../../context/LocaleContext";
import {
  enqueueScans,
  loadManifest,
  loadTrips,
  queuedScans,
  saveManifest,
  saveTrips,
  type CachedManifest,
  type ConductorManifestRow,
  type QueuedScan,
} from "../../offline/conductorDb";
import { fetchManifest, isNetworkError, syncAndRefresh } from "../../offline/sync";
import { newScanId, validatePnrLocally, validateTokenLocally, withPending, type LocalResult } from "../../offline/validate";
import type { OperatorTrip, Paginated } from "../../types/operator";
import { formatTime, localDateISO } from "../../utils/time";

type Panel =
  | { kind: "valid"; pnr: string; rows: ConductorManifestRow[]; offline: boolean }
  | { kind: "already"; pnr: string; rows: ConductorManifestRow[]; firstScannedAt: string | null }
  | { kind: "invalid"; reason: string; pnr?: string };

type ListFilter = "all" | "waiting" | "boarded" | "no_show";

const TRIP_KEY = "bbms.conductor.trip";

function readStoredTrip(): string | null {
  try {
    return localStorage.getItem(TRIP_KEY);
  } catch {
    return null;
  }
}

function storeTrip(id: string | null) {
  try {
    if (id) localStorage.setItem(TRIP_KEY, id);
    else localStorage.removeItem(TRIP_KEY);
  } catch {
    // private mode — the picker just shows again next time
  }
}

export function ScanValidatePage() {
  const { t } = useTranslation("conductor");
  const { language, setLanguage } = useLocale();
  const browserOnline = useOnline();
  const [networkDown, setNetworkDown] = useState(false);
  const online = browserOnline && !networkDown;
  const today = localDateISO();

  const [trips, setTrips] = useState<OperatorTrip[] | null>(null);
  const [tripId, setTripId] = useState<string | null>(readStoredTrip);
  const [manifest, setManifest] = useState<CachedManifest | null>(null);
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [mode, setMode] = useState<"scan" | "list">("scan");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [pnr, setPnr] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const busyRef = useRef(false);

  const markNetwork = useCallback((error: unknown) => {
    if (isNetworkError(error)) setNetworkDown(true);
    return isNetworkError(error);
  }, []);

  // A fresh 'online' event clears our own "the last request failed" flag.
  useEffect(() => {
    if (browserOnline) setNetworkDown(false);
  }, [browserOnline]);

  // --- trips: cache first, then network ------------------------------------
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await loadTrips(today);
      if (cached && !cancelled) setTrips(cached.trips);
      try {
        const { data } = await http.get<Paginated<OperatorTrip>>("/operator/trips/", {
          params: { date_from: today, date_to: today, status: "scheduled,delayed", page_size: 100 },
        });
        if (cancelled) return;
        setTrips(data.results);
        await saveTrips(today, data.results);
      } catch (error) {
        if (!cancelled) {
          markNetwork(error);
          if (!cached) setTrips([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [today, markNetwork]);

  const trip = trips?.find((candidate) => candidate.public_id === tripId) ?? manifest?.trip ?? null;

  const refreshQueue = useCallback(async (id: string) => setQueue(await queuedScans(id)), []);

  const sync = useCallback(
    async (current: OperatorTrip) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setSyncing(true);
      try {
        const { manifest: fresh, outcome } = await syncAndRefresh(current);
        if (fresh) setManifest(fresh);
        await refreshQueue(current.public_id);
        if (outcome?.rejected.length) setMessage(t("sync.rejected", { count: outcome.rejected.length }));
        setLastSyncAt(new Date().toISOString());
        setNetworkDown(false);
      } catch (error) {
        markNetwork(error);
      } finally {
        busyRef.current = false;
        setSyncing(false);
      }
    },
    [markNetwork, refreshQueue, t]
  );

  // --- manifest: cache first, then sync + refresh ----------------------------
  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    void (async () => {
      const cached = await loadManifest(tripId);
      if (cancelled) return;
      if (cached) setManifest(cached);
      await refreshQueue(tripId);
      const current = trips?.find((candidate) => candidate.public_id === tripId) ?? cached?.trip;
      if (!current) return;
      try {
        setManifest(await fetchManifest(current));
        void sync(current);
      } catch (error) {
        // 403 = this staff account isn't allowed to scan tickets.
        if (!markNetwork(error) && (error as ApiError).status === 403) setForbidden(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the trip (or trip list) changes
  }, [tripId, trips?.length]);

  // Sync when the network comes back, and every 30 s while scans are queued.
  useEffect(() => {
    if (!trip || !browserOnline) return;
    void sync(trip);
    const id = window.setInterval(() => {
      if (queue.length) void sync(trip);
    }, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trip identity is its public_id
  }, [browserOnline, trip?.public_id, queue.length > 0]);

  const rows = useMemo(() => withPending(manifest?.rows ?? [], queue), [manifest, queue]);
  const pendingIds = useMemo(() => new Set(queue.map((scan) => scan.passenger_id)), [queue]);
  const boardedCount = rows.filter((row) => row.boarding_status === "boarded").length;

  function show(result: Panel) {
    setPanel(result);
    playCue(result.kind);
  }

  async function markServerBoarded(bookingPnr: string) {
    if (!manifest) return;
    const now = new Date().toISOString();
    const updated = {
      ...manifest,
      rows: manifest.rows.map((row) =>
        row.pnr === bookingPnr ? { ...row, boarding_status: "boarded" as const, boarded: true, scanned_at: now } : row
      ),
    };
    setManifest(updated);
    await saveManifest(updated);
  }

  async function boardOffline(result: Extract<LocalResult, { kind: "valid" }>) {
    if (!trip) return;
    const scannedAt = new Date().toISOString();
    await enqueueScans(
      result.rows
        .filter((row) => row.boarding_status !== "boarded")
        .map((row) => ({
          client_scan_id: newScanId(),
          tripId: trip.public_id,
          passenger_id: row.passenger_public_id,
          status: "boarded" as const,
          scanned_at: scannedAt,
        }))
    );
    await refreshQueue(trip.public_id);
    show({ kind: "valid", pnr: result.pnr, rows: result.rows, offline: true });
  }

  function showLocal(result: LocalResult) {
    if (result.kind === "valid") void boardOffline(result);
    else if (result.kind === "already") show(result);
    else show({ kind: "invalid", reason: result.reason, pnr: result.pnr });
  }

  function serverFailure(error: ApiError): Panel {
    const code = error.code;
    if (code === "already_boarded") {
      const details = error.details as { first_scanned_at?: string } | undefined;
      return { kind: "already", pnr: "", rows: [], firstScannedAt: details?.first_scanned_at ?? null };
    }
    return { kind: "invalid", reason: code };
  }

  async function handleToken(token: string) {
    if (!trip || panel) return;
    if (online) {
      try {
        const { data } = await http.post<{ pnr: string }>(`/boarding/trips/${trip.public_id}/validate-qr/`, { qr_token: token });
        await markServerBoarded(data.pnr);
        show({ kind: "valid", pnr: data.pnr, rows: rows.filter((row) => row.pnr === data.pnr), offline: false });
        return;
      } catch (error) {
        if (!markNetwork(error)) {
          const failure = serverFailure(error as ApiError);
          if (failure.kind === "already") {
            const local = await validateTokenLocally(token, rows);
            if (local.kind !== "invalid") failure.pnr = local.pnr;
            failure.rows = local.kind === "invalid" ? [] : local.rows;
          }
          show(failure);
          return;
        }
      }
    }
    showLocal(await validateTokenLocally(token, rows));
  }

  async function handlePnr(event: React.FormEvent) {
    event.preventDefault();
    const value = pnr.trim().toUpperCase();
    if (!trip || !value) return;
    setPnr("");
    if (online) {
      try {
        await http.post(`/boarding/trips/${trip.public_id}/board-pnr/`, { pnr: value });
        await markServerBoarded(value);
        show({ kind: "valid", pnr: value, rows: rows.filter((row) => row.pnr === value), offline: false });
        return;
      } catch (error) {
        if (!markNetwork(error)) {
          show(serverFailure(error as ApiError));
          return;
        }
      }
    }
    showLocal(validatePnrLocally(value, rows));
  }

  async function markRow(row: ConductorManifestRow, status: "boarded" | "no_show") {
    if (!trip) return;
    await enqueueScans([
      {
        client_scan_id: newScanId(),
        tripId: trip.public_id,
        passenger_id: row.passenger_public_id,
        status,
        scanned_at: new Date().toISOString(),
      },
    ]);
    await refreshQueue(trip.public_id);
    if (online) void sync(trip);
  }

  function chooseTrip(id: string | null) {
    setTripId(id);
    storeTrip(id);
    setManifest(null);
    setPanel(null);
  }

  // --- render ------------------------------------------------------------------
  const offlineBanner = !online && (
    <div className="bbms-offline-banner" role="alert">
      <i className="fas fa-plug-circle-xmark fs-3" aria-hidden="true" />
      <div>
        <strong>{t("offline.title")}</strong>
        <div>{t("offline.body", { count: queue.length })}</div>
      </div>
    </div>
  );

  if (!tripId || (!manifest && trips && !trip)) {
    return (
      <div className="bbms-conductor">
        <header className="bbms-conductor-bar">
          <strong>{t("title")}</strong>
          <LanguageToggle language={language} onChange={setLanguage} />
        </header>
        {offlineBanner}
        <main className="p-3">
          <h1 className="h4">{t("pick.title", { date: today })}</h1>
          {trips === null && <p className="text-muted">{t("loading")}</p>}
          {trips?.length === 0 && <p className="text-muted">{t("pick.none")}</p>}
          <div className="d-grid gap-2">
            {[...(trips ?? [])]
              .sort((a, b) => a.departure_at.localeCompare(b.departure_at))
              .map((candidate) => (
                <button key={candidate.public_id} type="button" className="bbms-trip-choice" onClick={() => chooseTrip(candidate.public_id)}>
                  <span className="bbms-trip-time">{formatTime(candidate.departure_at, language)}</span>
                  <span className="flex-grow-1 text-start">
                    <strong>{candidate.route.name}</strong>
                    <br />
                    <small>
                      {candidate.bus_plate_number} · {t("pick.sold", { sold: candidate.seats_sold, total: candidate.seats_total })}
                    </small>
                  </span>
                  <i className="fas fa-chevron-right" aria-hidden="true" />
                </button>
              ))}
          </div>
          <Link to="/" className="d-inline-block mt-4">
            {t("back_to_site")}
          </Link>
        </main>
      </div>
    );
  }

  const visibleRows = rows
    .filter((row) =>
      filter === "all"
        ? true
        : filter === "waiting"
          ? row.boarding_status === ""
          : row.boarding_status === filter
    )
    .filter((row) => {
      const term = search.trim().toLowerCase();
      return !term || row.full_name.toLowerCase().includes(term) || row.pnr.toLowerCase().includes(term) || row.seat_number.toLowerCase() === term;
    });
  const stopName = (row: ConductorManifestRow) =>
    (language === "km" ? row.boarding_stop_name_km || row.boarding_stop_name_en : row.boarding_stop_name_en || row.boarding_stop_name_km) || "";

  return (
    <div className="bbms-conductor">
      <header className="bbms-conductor-bar">
        <button type="button" className="btn btn-link text-white p-0 me-1" onClick={() => chooseTrip(null)} aria-label={t("change_trip")}>
          <i className="fas fa-arrow-left fs-5" aria-hidden="true" />
        </button>
        <div className="flex-grow-1 lh-sm">
          <strong>{trip?.route.name}</strong>
          <div className="small">
            {trip && formatTime(trip.departure_at, language)} · {trip?.bus_plate_number}
          </div>
        </div>
        <button
          type="button"
          className={`bbms-sync-chip ${online ? (queue.length ? "is-pending" : "is-ok") : "is-offline"}`}
          onClick={() => trip && void sync(trip)}
          disabled={syncing || !online}
        >
          <i className={`fas ${online ? (syncing ? "fa-sync fa-spin" : "fa-cloud") : "fa-plug-circle-xmark"} me-1`} aria-hidden="true" />
          {online
            ? queue.length
              ? t("sync.pending", { count: queue.length })
              : t("sync.synced")
            : t("sync.offline", { count: queue.length })}
        </button>
        <LanguageToggle language={language} onChange={setLanguage} />
      </header>
      {offlineBanner}

      <div className="px-3 pt-3">
        <div className="d-flex justify-content-between small fw-semibold">
          <span>{t("progress", { boarded: boardedCount, total: rows.length })}</span>
          {lastSyncAt && <span className="text-muted">{t("sync.last", { time: formatTime(lastSyncAt, language) })}</span>}
        </div>
        <div className="progress bbms-board-progress" role="progressbar" aria-valuenow={boardedCount} aria-valuemin={0} aria-valuemax={rows.length}>
          <div className="progress-bar bg-success" style={{ width: `${rows.length ? (boardedCount / rows.length) * 100 : 0}%` }} />
        </div>
        {manifest && (
          <div className="small text-muted mt-1">{t("cached_at", { time: formatTime(manifest.fetchedAt, language) })}</div>
        )}
        {message && (
          <div className="alert alert-warning py-2 mt-2 d-flex justify-content-between" role="status">
            {message}
            <button type="button" className="btn-close" aria-label={t("dismiss")} onClick={() => setMessage(null)} />
          </div>
        )}

        <div className="bbms-segmented my-3" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "scan"} className={mode === "scan" ? "active" : ""} onClick={() => setMode("scan")}>
            <i className="fas fa-qrcode me-2" aria-hidden="true" />
            {t("mode.scan")}
          </button>
          <button type="button" role="tab" aria-selected={mode === "list"} className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}>
            <i className="fas fa-list me-2" aria-hidden="true" />
            {t("mode.list")}
          </button>
        </div>
      </div>

      {forbidden && (
        <div className="alert alert-danger mx-3" role="alert">
          {t("forbidden")}
        </div>
      )}

      {mode === "scan" ? (
        <main className="px-3 pb-4">
          {!manifest ? (
            <p className="text-muted">{t("loading")}</p>
          ) : (
            <>
              <QrScanner paused={Boolean(panel)} onScan={(text) => void handleToken(text)} />
              <p className="text-center fw-semibold mt-2">{t("scan.instruction")}</p>
              <form className="d-flex gap-2" onSubmit={(event) => void handlePnr(event)}>
                <input
                  className="form-control form-control-lg text-uppercase"
                  placeholder={t("scan.pnr_placeholder")}
                  aria-label={t("scan.pnr_placeholder")}
                  value={pnr}
                  maxLength={8}
                  autoCapitalize="characters"
                  onChange={(event) => setPnr(event.target.value)}
                />
                <button type="submit" className="btn bbms-cta btn-lg" disabled={!pnr.trim()}>
                  {t("scan.check")}
                </button>
              </form>
            </>
          )}
        </main>
      ) : (
        <main className="px-3 pb-4">
          <input
            type="search"
            className="form-control form-control-lg mb-2"
            placeholder={t("list.search")}
            aria-label={t("list.search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="d-flex flex-wrap gap-2 mb-2" role="group">
            {(["all", "waiting", "boarded", "no_show"] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={`btn bbms-chip ${filter === key ? "active" : ""}`}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {t(`list.filter.${key}`)}
              </button>
            ))}
          </div>
          {visibleRows.length === 0 && <p className="text-muted">{t("list.empty")}</p>}
          <ul className="list-unstyled mb-0">
            {visibleRows.map((row) => (
              <li key={row.passenger_public_id} className="bbms-pax-row">
                <span className="bbms-seat-pill">{row.seat_number}</span>
                <div className="flex-grow-1 min-w-0">
                  <div className="fw-semibold text-truncate">
                    {row.full_name}
                    {pendingIds.has(row.passenger_public_id) && (
                      <span className="bbms-pending-dot" title={t("list.pending_sync")} aria-label={t("list.pending_sync")} />
                    )}
                  </div>
                  <div className="small text-muted text-truncate">
                    {row.pnr}
                    {row.phone && ` · ${row.phone}`}
                    {stopName(row) && ` · ${stopName(row)}`}
                  </div>
                </div>
                {row.boarding_status === "boarded" ? (
                  <i className="fas fa-check-circle text-success fs-2" aria-label={t("status.boarded")} />
                ) : (
                  <div className="d-flex gap-2">
                    <button type="button" className="btn bbms-cta" onClick={() => void markRow(row, "boarded")}>
                      {t("list.board")}
                    </button>
                    <button
                      type="button"
                      className={`btn ${row.boarding_status === "no_show" ? "btn-secondary" : "btn-outline-secondary"}`}
                      onClick={() => void markRow(row, "no_show")}
                      disabled={row.boarding_status === "no_show"}
                    >
                      {t("list.no_show")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </main>
      )}

      {panel && (
        <ResultPanel panel={panel} language={language} officePhone={trip?.operator_phone ?? ""} onNext={() => setPanel(null)} />
      )}
    </div>
  );
}

function LanguageToggle({ language, onChange }: { language: "km" | "en"; onChange: (l: "km" | "en") => void }) {
  return (
    <button type="button" className="btn btn-sm btn-outline-light ms-2" onClick={() => onChange(language === "km" ? "en" : "km")}>
      {language === "km" ? "EN" : "ខ្មែរ"}
    </button>
  );
}

function ResultPanel({
  panel,
  language,
  officePhone,
  onNext,
}: {
  panel: Panel;
  language: "km" | "en";
  officePhone: string;
  onNext: () => void;
}) {
  const { t } = useTranslation("conductor");
  const first = panel.kind !== "invalid" ? panel.rows[0] : undefined;
  const stop = first ? (language === "km" ? first.boarding_stop_name_km || first.boarding_stop_name_en : first.boarding_stop_name_en) : "";
  return (
    <div className={`bbms-result is-${panel.kind}`} role="alertdialog" aria-live="assertive" aria-label={t(`result.${panel.kind}`)}>
      <div className="bbms-result-card">
        <i
          className={`fas ${panel.kind === "valid" ? "fa-check-circle" : panel.kind === "already" ? "fa-exclamation-triangle" : "fa-times-circle"} bbms-result-icon`}
          aria-hidden="true"
        />
        <h2>{t(`result.${panel.kind}`)}</h2>
        {panel.kind !== "invalid" && panel.pnr && <div className="fs-5">PNR {panel.pnr}</div>}
        {panel.kind !== "invalid" &&
          panel.rows.map((row) => (
            <div key={row.passenger_public_id} className="d-flex align-items-center justify-content-center gap-2 mt-2">
              <span className="bbms-seat-pill is-large">{row.seat_number}</span>
              <span className="fs-4 fw-semibold">{row.full_name}</span>
            </div>
          ))}
        {stop && <div className="mt-2">{t("result.boarding_point", { stop })}</div>}
        {panel.kind === "valid" && panel.offline && <div className="bbms-result-note">{t("result.saved_offline")}</div>}
        {panel.kind === "already" && panel.firstScannedAt && (
          <div className="mt-2 fs-5">{t("result.first_scan", { time: formatTime(panel.firstScannedAt, language) })}</div>
        )}
        {panel.kind === "invalid" && <div className="mt-2 fs-5">{t(`reason.${panel.reason}`, { defaultValue: t("reason.unknown") })}</div>}
        <div className="d-grid gap-2 mt-4">
          <button type="button" className="btn btn-light btn-lg fw-bold" onClick={onNext} autoFocus>
            {panel.kind === "invalid" ? t("result.scan_again") : t("result.next")}
          </button>
          {panel.kind === "invalid" && officePhone && (
            <a className="btn btn-outline-light btn-lg" href={`tel:${officePhone}`}>
              <i className="fas fa-phone me-2" aria-hidden="true" />
              {t("result.call_office")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
