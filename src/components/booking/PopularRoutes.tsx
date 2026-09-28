import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useUpcomingTrips } from "../../api/trips";
import { useLocale } from "../../context/LocaleContext";
import type { City } from "../../types";
import { formatMoney } from "../../utils/money";

interface RouteAggregate {
  routePublicId: string;
  origin: City;
  destination: City;
  tripCount: number;
  minFareUsd: number;
  minFareKhr: number;
  operators: string[];
}

const MAX_ROUTES = 6;
const MAX_OPERATORS = 8;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PopularRoutes() {
  const { t } = useTranslation();
  const { language } = useLocale();
  const { data: trips } = useUpcomingTrips();

  const routes = useMemo<RouteAggregate[]>(() => {
    if (!trips?.length) return [];
    const byRoute = new Map<string, RouteAggregate>();
    for (const trip of trips) {
      const existing = byRoute.get(trip.route.public_id);
      const fareUsd = Number(trip.base_fare_usd);
      const fareKhr = Number(trip.base_fare_khr);
      if (!existing) {
        byRoute.set(trip.route.public_id, {
          routePublicId: trip.route.public_id,
          origin: trip.route.origin_city,
          destination: trip.route.destination_city,
          tripCount: 1,
          minFareUsd: fareUsd,
          minFareKhr: fareKhr,
          operators: [trip.operator_name],
        });
      } else {
        existing.tripCount += 1;
        existing.minFareUsd = Math.min(existing.minFareUsd, fareUsd);
        existing.minFareKhr = Math.min(existing.minFareKhr, fareKhr);
        if (!existing.operators.includes(trip.operator_name)) existing.operators.push(trip.operator_name);
      }
    }
    return [...byRoute.values()].sort((a, b) => b.tripCount - a.tripCount).slice(0, MAX_ROUTES);
  }, [trips]);

  const operators = useMemo(() => {
    if (!trips?.length) return [];
    return [...new Set(trips.map((trip) => trip.operator_name))].slice(0, MAX_OPERATORS);
  }, [trips]);

  if (!routes.length) return null;

  function cityName(city: City): string {
    return language === "km" ? city.name_km : city.name_en;
  }

  return (
    <div className="mb-5">
      <div className="mb-3">
        <h2 className="h3 fw-bold mb-1">{t("home.popular_routes_title")}</h2>
        <p className="text-muted mb-0">{t("home.popular_routes_subtitle")}</p>
      </div>

      <div className="row g-4 mb-4">
        {routes.map((route) => (
          <div key={route.routePublicId} className="col-12 col-md-6 col-lg-4">
            <div className="border rounded-3 p-3 h-100 d-flex flex-column justify-content-between">
              <div>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="badge rounded-pill bg-bbms-tint text-primary">{route.operators[0]}</span>
                  <span className="small text-muted">
                    {t("home.trips_count", { count: route.tripCount })}
                  </span>
                </div>
                <div className="d-flex align-items-center justify-content-between fw-bold fs-5">
                  <span>{cityName(route.origin)}</span>
                  <i className="fas fa-arrow-right text-primary mx-2" aria-hidden="true" />
                  <span>{cityName(route.destination)}</span>
                </div>
              </div>
              <div className="d-flex align-items-center justify-content-between mt-3 pt-3 border-top">
                <div>
                  <div className="small text-muted">{t("home.price_from")}</div>
                  <div className="fw-bold text-primary">
                    {formatMoney(String(route.minFareKhr), "KHR", language)}{" "}
                    <span className="small text-muted fw-normal">
                      ({formatMoney(String(route.minFareUsd), "USD", language)})
                    </span>
                  </div>
                </div>
                <Link
                  to={`/search?origin=${route.origin.public_id}&destination=${route.destination.public_id}&date=${today()}&passengers=1`}
                  className="btn btn-sm btn-outline-primary"
                >
                  {t("home.view_schedule")}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {operators.length > 0 && (
        <div className="text-center">
          <h3 className="h5 fw-bold mb-1">{t("home.operators_title")}</h3>
          <p className="text-muted small mb-3">{t("home.operators_subtitle")}</p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            {operators.map((name) => (
              <span key={name} className="badge rounded-pill text-bg-light border d-inline-flex align-items-center gap-2 px-3 py-2">
                <i className="fas fa-bus text-primary" aria-hidden="true" />
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
