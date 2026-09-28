import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useConfirmPasswordReset, useRequestPasswordReset } from "../../api/auth";

const requestSchema = z.object({ email: z.string().email("Enter a valid email") });
type RequestValues = z.infer<typeof requestSchema>;

const confirmSchema = z.object({
  code: z.string().min(6, "Enter the 6-digit code"),
  new_password: z.string().min(8, "At least 8 characters"),
});
type ConfirmValues = z.infer<typeof confirmSchema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation(["account", "common"]);
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  const requestForm = useForm<RequestValues>({ resolver: zodResolver(requestSchema) });
  const confirmForm = useForm<ConfirmValues>({ resolver: zodResolver(confirmSchema) });
  const requestReset = useRequestPasswordReset();
  const confirmReset = useConfirmPasswordReset();

  function onRequest(values: RequestValues) {
    requestReset.mutate(values, { onSuccess: () => setEmail(values.email) });
  }

  function onConfirm(values: ConfirmValues) {
    if (!email) return;
    confirmReset.mutate(
      { email, ...values },
      { onSuccess: () => navigate("/login", { replace: true }) }
    );
  }

  return (
    <div className="container py-5 d-flex justify-content-center">
      <div className="card" style={{ maxWidth: "480px", width: "100%" }}>
        <div className="card-body">
          <h1 className="h4 text-center mb-4">{t("auth.forgot_password_title")}</h1>

          {!email ? (
            <form onSubmit={requestForm.handleSubmit(onRequest)}>
              <div className="mb-3">
                <label className="form-label">{t("auth.email")}</label>
                <input type="email" className="form-control" {...requestForm.register("email")} />
              </div>
              <button type="submit" className="btn bbms-cta w-100" disabled={requestReset.isPending}>
                {t("auth.send_code")}
              </button>
            </form>
          ) : (
            <form onSubmit={confirmForm.handleSubmit(onConfirm)}>
              <p className="text-muted small">{t("auth.reset_sent")}</p>
              <div className="mb-3">
                <label className="form-label">{t("auth.otp_code")}</label>
                <input className="form-control" {...confirmForm.register("code")} />
              </div>
              <div className="mb-3">
                <label className="form-label">{t("auth.new_password")}</label>
                <input type="password" className="form-control" {...confirmForm.register("new_password")} />
              </div>
              {confirmReset.isError && <p className="text-danger small">{confirmReset.error.message}</p>}
              <button type="submit" className="btn bbms-cta w-100" disabled={confirmReset.isPending}>
                {t("auth.reset_submit")}
              </button>
            </form>
          )}

          <div className="text-center mt-3">
            <Link to="/login">{t("auth.back_to_login")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
