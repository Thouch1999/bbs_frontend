import { useTranslation } from "react-i18next";

const ITEMS = [
  { key: "legend_available", swatchClass: "bbms-seat-swatch-available", icon: null },
  { key: "legend_selected", swatchClass: "bbms-seat-swatch-selected", icon: "fas fa-check text-white" },
  { key: "legend_held", swatchClass: "bbms-seat-swatch-held", icon: "fas fa-hourglass-half" },
  { key: "legend_booked", swatchClass: "bbms-seat-swatch-booked", icon: "fas fa-xmark text-white" },
  { key: "legend_female_only", swatchClass: "bbms-seat-swatch-female", icon: "fas fa-venus text-danger" },
] as const;

export function SeatLegend() {
  const { t } = useTranslation("booking");

  return (
    <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-5 g-2">
      {ITEMS.map((item) => (
        <div className="col d-flex align-items-center gap-2" key={item.key}>
          <span
            className={`bbms-seat-swatch ${item.swatchClass} d-inline-flex align-items-center justify-content-center`}
            style={{ width: "1.5rem", height: "1.5rem" }}
            aria-hidden="true"
          >
            {item.icon && <i className={`${item.icon}`} style={{ fontSize: "0.7rem" }} />}
          </span>
          <span className="small">{t(`seat_map.${item.key}`)}</span>
        </div>
      ))}
    </div>
  );
}
