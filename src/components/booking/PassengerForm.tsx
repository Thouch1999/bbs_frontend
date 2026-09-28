import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useSavedPassengers } from "../../api/passengers";
import { useAuth } from "../../context/AuthContext";

const GENDERS = ["male", "female", "other"] as const;

interface PassengerFormProps {
  index: number;
  seatNumber: string;
}

export function PassengerForm({ index, seatNumber }: PassengerFormProps) {
  const { t } = useTranslation("booking");
  const { isAuthenticated } = useAuth();
  const { data: savedPassengers } = useSavedPassengers();
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext();
  const passengerErrors = (errors.passengers as Array<Record<string, { message?: string }>> | undefined)?.[
    index
  ];
  const gender = watch(`passengers.${index}.gender`);

  function applySaved(publicId: string) {
    const saved = savedPassengers?.find((p) => p.public_id === publicId);
    if (!saved) return;
    setValue(`passengers.${index}.full_name`, saved.full_name);
    setValue(`passengers.${index}.age`, saved.age ?? undefined);
    setValue(`passengers.${index}.gender`, saved.gender);
    setValue(`passengers.${index}.phone`, saved.phone);
    setValue(`passengers.${index}.id_document_number`, saved.id_document_number);
  }

  return (
    <div className="border rounded-3 p-3 mb-3">
      <div className="d-flex align-items-center justify-content-between pb-2 mb-3 border-bottom">
        <div className="d-flex align-items-center gap-2">
          <span
            className="bg-bbms-tint text-primary rounded-3 d-inline-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: "2rem", height: "2rem" }}
            aria-hidden="true"
          >
            <i className="fas fa-chair" />
          </span>
          <h2 className="h6 mb-0">{t("checkout.passenger_number", { number: index + 1, seat: seatNumber })}</h2>
        </div>
        <span className="badge bg-light text-dark border">
          {index === 0 ? t("checkout.primary_passenger") : t("checkout.co_traveler")}
        </span>
      </div>

      {isAuthenticated && savedPassengers && savedPassengers.length > 0 && (
        <div className="mb-3">
          <div className="small fw-semibold text-muted mb-1">{t("checkout.use_saved_passenger")}</div>
          <div className="d-flex flex-wrap gap-2">
            {savedPassengers.map((saved) => (
              <button
                key={saved.public_id}
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => applySaved(saved.public_id)}
              >
                <i className="fas fa-user me-1" aria-hidden="true" />
                {saved.full_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label">{t("checkout.full_name")}</label>
          <input className="form-control" {...register(`passengers.${index}.full_name` as const)} />
          {passengerErrors?.full_name && (
            <div className="text-danger small">{passengerErrors.full_name.message}</div>
          )}
        </div>
        <div className="col-md-2">
          <label className="form-label">{t("checkout.age")}</label>
          <input type="number" className="form-control" {...register(`passengers.${index}.age` as const)} />
        </div>
        <div className="col-md-4">
          <label className="form-label">{t("checkout.gender")}</label>
          <div className="btn-group w-100" role="group">
            {GENDERS.map((value) => (
              <button
                key={value}
                type="button"
                className={`btn btn-sm ${gender === value ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setValue(`passengers.${index}.gender`, value, { shouldValidate: true })}
              >
                {t(`checkout.gender_${value}`)}
              </button>
            ))}
          </div>
          <input type="hidden" {...register(`passengers.${index}.gender` as const)} />
        </div>
        <div className="col-md-6">
          <label className="form-label">{t("checkout.phone_optional")}</label>
          <div className="input-group">
            <span className="input-group-text">+855</span>
            <input className="form-control" {...register(`passengers.${index}.phone` as const)} />
          </div>
        </div>
        <div className="col-md-6">
          <div className="d-flex justify-content-between">
            <label className="form-label">{t("checkout.id_document_optional")}</label>
            <span className="small text-muted">{t("checkout.id_optional_badge")}</span>
          </div>
          <input className="form-control" {...register(`passengers.${index}.id_document_number` as const)} />
          <div className="form-text">{t("checkout.id_helper")}</div>
        </div>
        {isAuthenticated && (
          <div className="col-12">
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id={`save-to-profile-${index}`}
                {...register(`passengers.${index}.save_to_profile` as const)}
              />
              <label className="form-check-label" htmlFor={`save-to-profile-${index}`}>
                {t("checkout.save_to_profile")}
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
