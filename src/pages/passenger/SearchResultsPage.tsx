import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { useTripSearch } from "../../api/trips";
import { DatePager } from "../../components/booking/DatePager";
import { TripCard } from "../../components/booking/TripCard";
import { BannerStrip } from "../../components/shared/SiteContent";
import { useLocale } from "../../context/LocaleContext";
import type { BusType, Trip } from "../../types";
import { formatDate } from "../../utils/time";
import { formatMoney } from "../../utils/money";

type SortKey = "price" | "departure" | "duration";
type TimeBucket = "early" | "morning" | "afternoon" | "night";

const BUS_TYPES: BusType[] = ["seated", "sleeper", "mixed"];
const TIME_BUCKETS: TimeBucket[] = ["early", "morning", "afternoon", "night"];
const CAMBODIA_TZ = "Asia/Phnom_Penh";

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function departureHour(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: CAMBODIA_TZ, hour: "2-digit", hourCycle: "h23" }).formatToParts(
    new Date(iso)
  );
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0);
}

function timeBucketOf(iso: string): TimeBucket {
  const hour = departureHour(iso);
  if (hour < 6) return "early";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "night";
}

function durationMinutes(trip: Trip): number {
  return (new Date(trip.arrival_at).getTime() - new Date(trip.departure_at).getTime()) / 60000;
}

export function SearchResultsPage() {
  const { t } = useTranslation(["booking", "common"]);
  const { language } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>("departure");
  const [busType, setBusType] = useState<BusType | "">("");
  const [operators, setOperators] = useState<Set<string>>(new Set());
  const [amenities, setAmenities] = useState<Set<string>>(new Set());
  const [timeBuckets, setTimeBuckets] = useState<Set<TimeBucket>>(new Set());
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const origin = searchParams.get("origin") ?? undefined;
  const destination = searchParams.get("destination") ?? undefined;
  const date = searchParams.get("date") ?? undefined;
  const passengers = Number(searchParams.get("passengers") ?? 1);

  const { data, isLoading, isError } = useTripSearch({ origin, destination, date, page });

  const allResults = useMemo(() => data?.results ?? [], [data]);
  const operatorCounts = useMemo(() => countBy(allResults, (trip) => trip.operator_name), [allResults]);
  const busTypeCounts = useMemo(() => countBy(allResults, (trip) => trip.bus_type), [allResults]);
  const timeBucketCounts = useMemo(() => countBy(allResults, (trip) => timeBucketOf(trip.departure_at)), [allResults]);
  const amenityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const trip of allResults) {
      for (const amenity of trip.amenities) counts.set(amenity, (counts.get(amenity) ?? 0) + 1);
    }
    return counts;
  }, [allResults]);

  const priceBounds = useMemo(() => {
    const fares = allResults.map((trip) => Number(trip.base_fare_usd));
    if (!fares.length) return null;
    return { min: Math.floor(Math.min(...fares)), max: Math.ceil(Math.max(...fares)) };
  }, [allResults]);

  // Reset paging/date-scoped filters whenever the searched date changes —
  // a page or price ceiling from a previous day's results won't apply here.
  useEffect(() => {
    setPage(1);
    setMaxPrice(null);
  }, [date]);

  const filteredResults = useMemo(() => {
    return allResults.filter(
      (trip) =>
        (!busType || trip.bus_type === busType) &&
        (operators.size === 0 || operators.has(trip.operator_name)) &&
        (amenities.size === 0 || [...amenities].every((a) => trip.amenities.includes(a))) &&
        (timeBuckets.size === 0 || timeBuckets.has(timeBucketOf(trip.departure_at))) &&
        (maxPrice === null || Number(trip.base_fare_usd) <= maxPrice)
    );
  }, [allResults, busType, operators, amenities, timeBuckets, maxPrice]);

  const sortedResults = useMemo(() => {
    const sorted = [...filteredResults];
    if (sortKey === "price") {
      sorted.sort((a, b) => Number(a.base_fare_usd) - Number(b.base_fare_usd));
    } else if (sortKey === "duration") {
      sorted.sort((a, b) => durationMinutes(a) - durationMinutes(b));
    } else {
      sorted.sort((a, b) => new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime());
    }
    return sorted;
  }, [filteredResults, sortKey]);

  const hasFilters =
    Boolean(busType) || operators.size > 0 || amenities.size > 0 || timeBuckets.size > 0 || maxPrice !== null;
  const firstTrip: Trip | undefined = allResults[0];

  function clearFilters() {
    setBusType("");
    setOperators(new Set());
    setAmenities(new Set());
    setTimeBuckets(new Set());
    setMaxPrice(null);
  }

  function selectDate(nextDate: string) {
    const next = new URLSearchParams(searchParams);
    next.set("date", nextDate);
    setSearchParams(next);
  }

  return (
    <div>
      <div className="bg-primary text-white">
        <div className="container py-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <i className="fas fa-location-arrow" aria-hidden="true" />
              {firstTrip ? (
                <span className="fw-bold">
                  {language === "km" ? firstTrip.route.origin_city.name_km : firstTrip.route.origin_city.name_en}
                  <i className="fas fa-arrow-right mx-2 small" aria-hidden="true" />
                  {language === "km" ? firstTrip.route.destination_city.name_km : firstTrip.route.destination_city.name_en}
                </span>
              ) : (
                <span className="fw-bold">{t("common.loading")}</span>
              )}
              {date && <span className="opacity-75">· {formatDate(date, language)}</span>}
              <span className="opacity-75">· {t("results.passengers_count", { count: passengers })}</span>
            </div>
            <Link to="/" className="btn btn-outline-light btn-sm">
              <i className="fas fa-calendar-days me-1" aria-hidden="true" />
              {t("results.modify_search")}
            </Link>
          </div>

          {date && <DatePager origin={origin} destination={destination} date={date} onSelect={selectDate} />}
        </div>
      </div>

      <div className="container py-4">
        <BannerStrip placement="search" />

        <div className="row g-4">
          <aside className="col-12 col-lg-3">
            <div className="border rounded-3 p-3">
              <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                <span className="fw-bold">
                  <i className="fas fa-filter text-primary me-1" aria-hidden="true" />
                  {t("results.filter_bus_type")}
                </span>
                {hasFilters && (
                  <button type="button" className="btn btn-link btn-sm p-0" onClick={clearFilters}>
                    {t("results.clear_filters")}
                  </button>
                )}
              </div>

              {timeBucketCounts.size > 0 && (
                <div className="mb-3">
                  <div className="fw-semibold small mb-1">{t("results.filter_departure_time")}</div>
                  <div className="d-flex flex-column gap-1">
                    {TIME_BUCKETS.filter((bucket) => timeBucketCounts.has(bucket)).map((bucket) => (
                      <label key={bucket} className="d-flex align-items-center justify-content-between small">
                        <span className="d-flex align-items-center gap-2">
                          <input
                            type="checkbox"
                            className="form-check-input m-0"
                            checked={timeBuckets.has(bucket)}
                            onChange={() => setTimeBuckets((current) => toggle(current, bucket))}
                          />
                          {t(`results.time_${bucket}`)}
                        </span>
                        <span className="badge bg-light text-dark border">{timeBucketCounts.get(bucket)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <div className="fw-semibold small mb-1">{t("results.filter_bus_type")}</div>
                <div className="d-flex flex-column gap-1">
                  {BUS_TYPES.filter((type) => busTypeCounts.has(type)).map((type) => (
                    <label key={type} className="d-flex align-items-center justify-content-between small">
                      <span className="d-flex align-items-center gap-2">
                        <input
                          type="radio"
                          className="form-check-input m-0"
                          checked={busType === type}
                          onChange={() => setBusType(type)}
                        />
                        {t(`bus_type.${type}`)}
                      </span>
                      <span className="badge bg-light text-dark border">{busTypeCounts.get(type)}</span>
                    </label>
                  ))}
                  {busType && (
                    <button type="button" className="btn btn-link btn-sm p-0 text-start" onClick={() => setBusType("")}>
                      {t("results.filter_all")}
                    </button>
                  )}
                </div>
              </div>

              {priceBounds && priceBounds.max > priceBounds.min && (
                <div className="mb-3">
                  <div className="fw-semibold small mb-1">{t("results.filter_price")}</div>
                  <input
                    type="range"
                    className="form-range"
                    min={priceBounds.min}
                    max={priceBounds.max}
                    value={maxPrice ?? priceBounds.max}
                    onChange={(event) => setMaxPrice(Number(event.target.value))}
                  />
                  <div className="small text-muted">
                    {t("results.price_up_to", { amount: formatMoney(String(maxPrice ?? priceBounds.max), "USD", language) })}
                  </div>
                </div>
              )}

              {operatorCounts.size > 0 && (
                <div className="mb-3">
                  <div className="fw-semibold small mb-1">{t("results.filter_operators")}</div>
                  <div className="d-flex flex-column gap-1">
                    {[...operatorCounts.entries()].map(([name, count]) => (
                      <label key={name} className="d-flex align-items-center justify-content-between small">
                        <span className="d-flex align-items-center gap-2">
                          <input
                            type="checkbox"
                            className="form-check-input m-0"
                            checked={operators.has(name)}
                            onChange={() => setOperators((current) => toggle(current, name))}
                          />
                          {name}
                        </span>
                        <span className="badge bg-light text-dark border">{count}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {amenityCounts.size > 0 && (
                <div>
                  <div className="fw-semibold small mb-1">{t("results.filter_amenities")}</div>
                  <div className="d-flex flex-column gap-1">
                    {[...amenityCounts.entries()].map(([amenity, count]) => (
                      <label key={amenity} className="d-flex align-items-center justify-content-between small">
                        <span className="d-flex align-items-center gap-2">
                          <input
                            type="checkbox"
                            className="form-check-input m-0"
                            checked={amenities.has(amenity)}
                            onChange={() => setAmenities((current) => toggle(current, amenity))}
                          />
                          {t(`amenities.${amenity}`, { defaultValue: amenity })}
                        </span>
                        <span className="badge bg-light text-dark border">{count}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          <main className="col-12 col-lg-9">
            <div className="border rounded-3 p-3 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
              <span className="fw-semibold">{t("results.found_count", { count: filteredResults.length })}</span>
              <div className="btn-group btn-group-sm" role="group">
                <button
                  type="button"
                  className={`btn ${sortKey === "price" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setSortKey("price")}
                >
                  {t("results.sort_price")}
                </button>
                <button
                  type="button"
                  className={`btn ${sortKey === "departure" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setSortKey("departure")}
                >
                  {t("results.sort_departure")}
                </button>
                <button
                  type="button"
                  className={`btn ${sortKey === "duration" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setSortKey("duration")}
                >
                  {t("results.sort_fastest")}
                </button>
              </div>
            </div>

            {isLoading && <p className="text-muted">{t("common.loading")}</p>}
            {isError && <p className="text-danger">{t("common.error")}</p>}
            {!isLoading && !isError && sortedResults.length === 0 && (
              <p className="text-muted">{t("results.empty")}</p>
            )}
            {sortedResults.map((trip: Trip) => (
              <TripCard key={trip.public_id} trip={trip} passengers={passengers} />
            ))}

            {(data?.previous || data?.next) && (
              <div className="d-flex justify-content-between align-items-center mt-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={!data?.previous}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <i className="fas fa-chevron-left me-1" aria-hidden="true" />
                  {t("results.previous_page")}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={!data?.next}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t("results.next_page")}
                  <i className="fas fa-chevron-right ms-1" aria-hidden="true" />
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
