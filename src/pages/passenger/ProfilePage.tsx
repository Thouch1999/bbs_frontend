import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useCreateSavedPassenger,
  useDeleteSavedPassenger,
  useSavedPassengers,
  useUpdateSavedPassenger,
  type SavedPassenger,
} from "../../api/passengers";
import { useProfile, useUpdateProfile } from "../../api/profile";
import { useLocale } from "../../context/LocaleContext";

type Pane = "personal" | "saved_passengers" | "language";

function PersonalPane() {
  const { t } = useTranslation("account");
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  if (!profile) return null;

  return (
    <div>
      <h2 className="h5">{t("profile.nav_personal")}</h2>
      <div className="mb-3">
        <label className="form-label">{t("profile.full_name")}</label>
        <input className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="mb-3">
        <label className="form-label">{t("profile.email")}</label>
        <input className="form-control" value={profile.email} disabled />
      </div>
      <div className="mb-3">
        <label className="form-label">{t("profile.phone")}</label>
        <input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {updateProfile.isSuccess && <p className="text-success small">{t("profile.saved_ok")}</p>}
      <button
        type="button"
        className="btn bbms-cta"
        disabled={updateProfile.isPending}
        onClick={() => updateProfile.mutate({ full_name: fullName, phone })}
      >
        {t("profile.save")}
      </button>
    </div>
  );
}

function SavedPassengerRow({ passenger }: { passenger: SavedPassenger }) {
  const { t } = useTranslation("account");
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(passenger.full_name);
  const updatePassenger = useUpdateSavedPassenger();
  const deletePassenger = useDeleteSavedPassenger();

  if (isEditing) {
    return (
      <tr>
        <td colSpan={2}>
          <div className="d-flex gap-2">
            <input className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <button
              type="button"
              className="btn btn-sm bbms-cta"
              onClick={() =>
                updatePassenger.mutate(
                  { publicId: passenger.public_id, full_name: fullName },
                  { onSuccess: () => setIsEditing(false) }
                )
              }
            >
              {t("profile.save")}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{passenger.full_name}</td>
      <td className="text-end">
        <button type="button" className="btn btn-sm btn-link" onClick={() => setIsEditing(true)}>
          {t("profile.edit")}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-link text-danger"
          onClick={() => deletePassenger.mutate(passenger.public_id)}
          disabled={deletePassenger.isPending}
        >
          {t("profile.delete")}
        </button>
      </td>
    </tr>
  );
}

function SavedPassengersPane() {
  const { t } = useTranslation("account");
  const { data: passengers } = useSavedPassengers();
  const createPassenger = useCreateSavedPassenger();
  const [newName, setNewName] = useState("");

  return (
    <div>
      <h2 className="h5">{t("profile.nav_saved_passengers")}</h2>
      {passengers && passengers.length > 0 ? (
        <table className="table">
          <tbody>
            {passengers.map((p) => (
              <SavedPassengerRow key={p.public_id} passenger={p} />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted">{t("profile.no_saved_passengers")}</p>
      )}
      <div className="d-flex gap-2">
        <input
          className="form-control"
          placeholder={t("checkout.full_name", { ns: "booking" })}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-outline-primary text-nowrap"
          disabled={!newName || createPassenger.isPending}
          onClick={() =>
            createPassenger.mutate(
              { full_name: newName, age: null, gender: "", phone: "", id_document_number: "" },
              { onSuccess: () => setNewName("") }
            )
          }
        >
          {t("profile.add_passenger")}
        </button>
      </div>
    </div>
  );
}

function LanguagePane() {
  const { t } = useTranslation("account");
  const { language, setLanguage, currency, setCurrency } = useLocale();
  const updateProfile = useUpdateProfile();

  return (
    <div>
      <h2 className="h5">{t("profile.language_currency_title")}</h2>
      <div className="btn-group mb-3 d-block">
        {(["km", "en"] as const).map((lng) => (
          <button
            key={lng}
            type="button"
            className={`btn btn-outline-primary ${language === lng ? "active" : ""}`}
            onClick={() => {
              setLanguage(lng);
              updateProfile.mutate({ preferred_language: lng });
            }}
          >
            {lng === "km" ? "ខ្មែរ" : "EN"}
          </button>
        ))}
      </div>
      <div className="btn-group d-block">
        {(["KHR", "USD"] as const).map((cur) => (
          <button
            key={cur}
            type="button"
            className={`btn btn-outline-primary ${currency === cur ? "active" : ""}`}
            onClick={() => {
              setCurrency(cur);
              updateProfile.mutate({ preferred_currency: cur });
            }}
          >
            {cur === "KHR" ? "៛ KHR" : "$ USD"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { t } = useTranslation("account");
  const [pane, setPane] = useState<Pane>("personal");

  const panes: { key: Pane; label: string }[] = [
    { key: "personal", label: t("profile.nav_personal") },
    { key: "saved_passengers", label: t("profile.nav_saved_passengers") },
    { key: "language", label: t("profile.nav_language") },
  ];

  return (
    <div className="container py-4">
      <h1 className="h4 mb-4">{t("profile.title")}</h1>
      <div className="row">
        <div className="col-md-3">
          <ul className="nav flex-column nav-pills">
            {panes.map((p) => (
              <li className="nav-item" key={p.key}>
                <button
                  type="button"
                  className={`nav-link w-100 text-start ${pane === p.key ? "active" : ""}`}
                  onClick={() => setPane(p.key)}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-md-9">
          {pane === "personal" && <PersonalPane />}
          {pane === "saved_passengers" && <SavedPassengersPane />}
          {pane === "language" && <LanguagePane />}
        </div>
      </div>
    </div>
  );
}
