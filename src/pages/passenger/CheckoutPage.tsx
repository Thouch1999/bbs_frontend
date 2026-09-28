import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { useCreateSavedPassenger } from "../../api/passengers";
import { useInitiatePayment } from "../../api/payments";
import { useTripStops } from "../../api/routes";
import { useCreateBooking } from "../../api/bookings";
import { useReleaseSeats, useTrip, useTripSeats } from "../../api/trips";
import { BookingStepper } from "../../components/booking/BookingStepper";
import { FareSummary } from "../../components/booking/FareSummary";
import { HoldTimer } from "../../components/booking/HoldTimer";
import { PassengerForm } from "../../components/booking/PassengerForm";
import { PaymentMethodSelect } from "../../components/booking/PaymentMethodSelect";
import { TripSummaryCard } from "../../components/booking/TripSummaryCard";
import { useAuth } from "../../context/AuthContext";
import { useBooking } from "../../context/BookingContext";
import { useLocale } from "../../context/LocaleContext";
import type { PaymentProvider } from "../../types";

// Loosely mirrors apps.accounts.services.normalize_phone's acceptance
// (0-prefixed, 855-prefixed, or +855-prefixed, 8-9 national digits) —
// the server is authoritative, this is just early feedback.
const PHONE_REGEX = /^(?:\+855|855|0)\d{8,9}$/;

const passengerSchema = z.object({
  full_name: z.string().min(1, "Required"),
  age: z.coerce.number().min(0).max(120).optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other", ""]).optional(),
  phone: z.string().optional(),
  id_document_number: z.string().optional(),
  save_to_profile: z.boolean().optional(),
});

const checkoutSchema = z.object({
  passengers: z.array(passengerSchema),
  contact_phone: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => PHONE_REGEX.test(v), "Enter a valid Cambodian phone number"),
  contact_email: z.string().email().optional().or(z.literal("")),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export function CheckoutPage() {
  const { t } = useTranslation(["booking", "common"]);
  const navigate = useNavigate();
  const { booking, resetBooking } = useBooking();
  const { language, currency } = useLocale();
  const { isAuthenticated } = useAuth();

  const { tripId, holdToken, holdExpiresAt, seatIds, boardingStopId, dropStopId } = booking;
  const isHoldValid = Boolean(tripId && holdToken && holdExpiresAt && new Date(holdExpiresAt) > new Date());

  const { data: trip } = useTrip(tripId ?? undefined);
  const { data: seats } = useTripSeats(tripId ?? undefined);
  const { data: stops } = useTripStops(tripId);
  const releaseSeats = useReleaseSeats(tripId ?? undefined);
  const createBooking = useCreateBooking();
  const initiatePayment = useInitiatePayment();
  const createSavedPassenger = useCreateSavedPassenger();

  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>("demo");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [promoCode, setPromoCode] = useState<string | null>(null);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      passengers: seatIds.map(() => ({ full_name: "", age: "", gender: "", phone: "", id_document_number: "" })),
      contact_phone: "",
      contact_email: "",
    },
  });
  useFieldArray({ control: form.control, name: "passengers" });

  useEffect(() => {
    if (!isHoldValid) {
      navigate("/", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check on mount / hold change
  }, [isHoldValid]);

  if (!isHoldValid || !trip) {
    return null;
  }

  const fare = currency === "KHR" ? trip.base_fare_khr : trip.base_fare_usd;
  const subtotal = Number(fare) * seatIds.length;
  const boardingStop = stops?.find((s) => s.public_id === boardingStopId);
  const dropStop = stops?.find((s) => s.public_id === dropStopId);

  function handleExpire() {
    if (tripId && seatIds.length > 0) {
      releaseSeats.mutate(seatIds);
    }
    resetBooking();
    navigate("/", { replace: true, state: { message: t("hold_timer.expired") } });
  }

  function seatNumberFor(seatId: string): string {
    return seats?.find((s) => s.seat.public_id === seatId)?.seat.seat_number ?? "";
  }

  async function onSubmit(values: CheckoutFormValues) {
    if (!tripId || !holdToken) return;

    try {
      const createdBooking = await createBooking.mutateAsync({
        trip_id: tripId,
        hold_token: holdToken,
        passengers: values.passengers.map((p) => ({
          full_name: p.full_name,
          age: p.age === "" ? undefined : Number(p.age),
          gender: p.gender || undefined,
          phone: p.phone || undefined,
          id_document_number: p.id_document_number || undefined,
        })),
        contact_phone: values.contact_phone,
        contact_email: values.contact_email || undefined,
        currency,
        boarding_stop_id: boardingStopId || undefined,
        drop_stop_id: dropStopId || undefined,
        promo_code: promoCode || undefined,
      });

      if (isAuthenticated) {
        values.passengers
          .filter((p) => p.save_to_profile)
          .forEach((p) => {
            createSavedPassenger.mutate({
              full_name: p.full_name,
              age: p.age === "" ? null : Number(p.age),
              gender: p.gender ?? "",
              phone: p.phone ?? "",
              id_document_number: p.id_document_number ?? "",
            });
          });
      }

      const payment = await initiatePayment.mutateAsync({
        booking_id: createdBooking.public_id,
        provider: paymentProvider,
      });

      resetBooking();
      navigate("/payment-result", {
        state: {
          pnr: createdBooking.pnr,
          contactPhone: createdBooking.contact_phone,
          provider: paymentProvider,
          gateway: payment.gateway,
          operatorName: trip?.operator_name ?? "",
        },
      });
    } catch {
      // createBooking/initiatePayment errors surface inline via their own
      // isError/error state below — nothing further to do here.
    }
  }

  return (
    <div className="container py-4">
      <BookingStepper current={4} />
      <TripSummaryCard trip={trip} />

      <div className="bbms-no-print mb-3">
        <HoldTimer expiresAt={holdExpiresAt!} onExpire={handleExpire} />
      </div>

      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <h1 className="h4">{t("checkout.title")}</h1>

          {seatIds.length > 1 && (
            <div className="form-check mb-3">
              <input
                type="checkbox"
                className="form-check-input"
                id="copy-to-all"
                onChange={(event) => {
                  if (!event.target.checked) return;
                  const first = form.getValues("passengers.0");
                  seatIds.forEach((_, index) => {
                    if (index === 0) return;
                    form.setValue(`passengers.${index}.full_name`, first.full_name);
                    form.setValue(`passengers.${index}.age`, first.age);
                    form.setValue(`passengers.${index}.gender`, first.gender);
                    form.setValue(`passengers.${index}.phone`, first.phone);
                    form.setValue(`passengers.${index}.id_document_number`, first.id_document_number);
                  });
                  event.target.checked = false;
                }}
              />
              <label className="form-check-label" htmlFor="copy-to-all">
                {t("checkout.copy_to_all")}
              </label>
            </div>
          )}

          {seatIds.map((seatId, index) => (
            <PassengerForm key={seatId} index={index} seatNumber={seatNumberFor(seatId)} />
          ))}

          <div className="card mb-3">
            <div className="card-body row g-2">
              <div className="col-md-6">
                <label className="form-label">{t("checkout.contact_phone")}</label>
                <input className="form-control" {...form.register("contact_phone")} />
                {form.formState.errors.contact_phone && (
                  <div className="text-danger small">{form.formState.errors.contact_phone.message}</div>
                )}
              </div>
              <div className="col-md-6">
                <label className="form-label">{t("checkout.contact_email_optional")}</label>
                <input className="form-control" {...form.register("contact_email")} />
              </div>
              <div className="col-12">
                <div className="small text-muted">
                  <i className="fas fa-circle-info me-1" aria-hidden="true" />
                  {t("ticket.sent_notice")}
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-3 p-3 mb-3">
            <h2 className="h6 fw-bold">{t("checkout.recap_title")}</h2>
            <div className="row g-2 small">
              <div className="col-6">
                <div className="text-muted">{t("stops.review_boarding")}</div>
                <div className="fw-semibold">
                  {boardingStop
                    ? language === "km"
                      ? boardingStop.stop.name_km
                      : boardingStop.stop.name_en
                    : "—"}
                </div>
              </div>
              <div className="col-6">
                <div className="text-muted">{t("stops.review_dropoff")}</div>
                <div className="fw-semibold">
                  {dropStop ? (language === "km" ? dropStop.stop.name_km : dropStop.stop.name_en) : "—"}
                </div>
              </div>
              <div className="col-12">
                <div className="text-muted">{t("results.seats_left", { count: seatIds.length })}</div>
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {seatIds.map((seatId) => (
                    <span key={seatId} className="badge bbms-cta">
                      {seatNumberFor(seatId)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <FareSummary
            tripId={tripId!}
            numSeats={seatIds.length}
            subtotal={subtotal}
            currency={currency}
            language={language}
            contactPhone={form.watch("contact_phone")}
            discountAmount={discountAmount}
            promoCode={promoCode}
            onDiscountChange={(amount, code) => {
              setDiscountAmount(amount);
              setPromoCode(code);
            }}
          />

          <PaymentMethodSelect value={paymentProvider} onChange={setPaymentProvider} />

          {(createBooking.isError || initiatePayment.isError) && (
            <p className="text-danger">{createBooking.error?.message ?? initiatePayment.error?.message}</p>
          )}

          <button
            type="submit"
            className="btn bbms-cta w-100"
            disabled={createBooking.isPending || initiatePayment.isPending}
          >
            {t("checkout.continue_to_payment")}
          </button>
        </form>
      </FormProvider>
    </div>
  );
}
