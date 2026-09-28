import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { City } from "../../types";
import { CityAutocomplete } from "./CityAutocomplete";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SearchForm() {
  const { t } = useTranslation(["common", "booking"]);
  const navigate = useNavigate();
  const [origin, setOrigin] = useState<City | null>(null);
  const [destination, setDestination] = useState<City | null>(null);
  const [date, setDate] = useState(today());
  const [passengers, setPassengers] = useState(1);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!origin || !destination) return;
    const params = new URLSearchParams({
      origin: origin.public_id,
      destination: destination.public_id,
      date,
      passengers: String(passengers),
    });
    navigate(`/search?${params.toString()}`);
  }

  function handleSwap() {
    setOrigin(destination);
    setDestination(origin);
  }

  return (
    <form className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-3" onSubmit={handleSubmit}>
      <div className="flex-fill">
        <CityAutocomplete
          icon="fas fa-circle-dot"
          label={t("search.origin")}
          placeholder={t("booking:search.origin_placeholder")}
          value={origin}
          onChange={setOrigin}
        />
      </div>

      <div className="d-flex justify-content-center">
        <button
          type="button"
          className="btn btn-outline-secondary rounded-circle p-0 d-flex align-items-center justify-content-center"
          style={{ width: "2.5rem", height: "2.5rem" }}
          onClick={handleSwap}
          title={t("booking:search.swap")}
          aria-label={t("booking:search.swap")}
        >
          <i className="fas fa-arrow-right-arrow-left" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-fill">
        <CityAutocomplete
          icon="fas fa-location-dot"
          label={t("search.destination")}
          placeholder={t("booking:search.destination_placeholder")}
          value={destination}
          onChange={setDestination}
        />
      </div>

      <div style={{ minWidth: "10rem" }}>
        <label className="form-label d-flex align-items-center gap-1" htmlFor="search-date">
          <i className="fas fa-calendar-days text-primary" aria-hidden="true" />
          {t("search.date")}
        </label>
        <input
          id="search-date"
          type="date"
          className="form-control"
          value={date}
          min={today()}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </div>

      <div style={{ minWidth: "9rem" }}>
        <label className="form-label d-flex align-items-center gap-1" htmlFor="search-passengers">
          <i className="fas fa-users text-primary" aria-hidden="true" />
          {t("search.passengers")}
        </label>
        <div className="d-flex align-items-center justify-content-between border rounded-2 px-2" style={{ height: "calc(1.5em + 0.75rem + 2px)" }}>
          <button
            type="button"
            className="btn btn-sm p-0 px-2"
            onClick={() => setPassengers((count) => Math.max(1, count - 1))}
            aria-label="-"
          >
            −
          </button>
          <span id="search-passengers" className="fw-semibold">
            {passengers}
          </span>
          <button
            type="button"
            className="btn btn-sm p-0 px-2"
            onClick={() => setPassengers((count) => Math.min(10, count + 1))}
            aria-label="+"
          >
            +
          </button>
        </div>
      </div>

      <button type="submit" className="btn bbms-cta d-flex align-items-center justify-content-center gap-2 px-4" disabled={!origin || !destination}>
        <i className="fas fa-magnifying-glass" aria-hidden="true" />
        {t("search.submit")}
      </button>
    </form>
  );
}
