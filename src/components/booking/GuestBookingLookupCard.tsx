import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export function GuestBookingLookupCard() {
  const { t } = useTranslation("account");
  const navigate = useNavigate();
  const [pnr, setPnr] = useState("");
  const [phone, setPhone] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!pnr || !phone) return;
    navigate(`/ticket?pnr=${encodeURIComponent(pnr)}&phone=${encodeURIComponent(phone)}`);
  }

  return (
    <div className="card mx-auto" style={{ maxWidth: "480px" }}>
      <div className="card-body">
        <h1 className="h5 text-center mb-3">{t("my_bookings.guest_lookup_title")}</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">{t("my_bookings.guest_lookup_pnr")}</label>
            <input
              className="form-control text-uppercase"
              value={pnr}
              onChange={(event) => setPnr(event.target.value)}
              maxLength={8}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">{t("my_bookings.guest_lookup_phone")}</label>
            <input className="form-control" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <button type="submit" className="btn bbms-cta w-100">
            {t("my_bookings.guest_lookup_submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
