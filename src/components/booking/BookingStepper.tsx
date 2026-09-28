import { useTranslation } from "react-i18next";

// Shared 5-step booking progress indicator (Stitch reference: search ->
// seats -> boarding/drop-off stops -> passenger details -> payment),
// replacing what each page used to hand-roll on its own.
const STEP_KEYS = ["search", "seats", "stops", "passengers", "payment"] as const;

export type BookingStep = 1 | 2 | 3 | 4 | 5;

interface BookingStepperProps {
  current: BookingStep;
}

export function BookingStepper({ current }: BookingStepperProps) {
  const { t } = useTranslation("booking");

  return (
    <nav aria-label={t("stepper.search")} className="d-flex align-items-center justify-content-center flex-wrap gap-2 py-3">
      {STEP_KEYS.map((key, index) => {
        const stepNumber = index + 1;
        const isDone = stepNumber < current;
        const isActive = stepNumber === current;
        const stateClass = isDone
          ? "bbms-stepper-node-done"
          : isActive
            ? "bbms-stepper-node-active"
            : "bbms-stepper-node-pending";

        return (
          <div key={key} className="d-flex align-items-center">
            <div
              className={`bbms-stepper-node d-flex align-items-center justify-content-center rounded-circle fw-bold ${stateClass}`}
              aria-current={isActive ? "step" : undefined}
            >
              {isDone ? <i className="fas fa-check" aria-hidden="true" /> : stepNumber}
            </div>
            <span className={`ms-2 small d-none d-sm-inline ${isActive ? "fw-semibold text-primary" : "text-muted"}`}>
              {t(`stepper.${key}`)}
            </span>
            {stepNumber < STEP_KEYS.length && <div className="bbms-stepper-line mx-2" aria-hidden="true" />}
          </div>
        );
      })}
    </nav>
  );
}
