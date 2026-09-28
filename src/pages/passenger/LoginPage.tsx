import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useLogin } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import { decodeJwt } from "../../api/tokenStore";

const passwordLoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Required"),
});
type PasswordLoginValues = z.infer<typeof passwordLoginSchema>;

/** Staff land in their back office, passengers on their bookings. */
function landingFor(access: string): string {
  const role = decodeJwt(access)?.role;
  return role === "operator_staff" ? "/operator" : role === "admin" ? "/admin" : "/my-bookings";
}

export function LoginPage() {
  const { t } = useTranslation(["account", "common"]);
  const navigate = useNavigate();
  const { login } = useAuth();

  const passwordForm = useForm<PasswordLoginValues>({ resolver: zodResolver(passwordLoginSchema) });
  const loginMutation = useLogin();

  function onPasswordSubmit(values: PasswordLoginValues) {
    loginMutation.mutate(values, {
      onSuccess: (tokens) => {
        login(tokens);
        navigate(landingFor(tokens.access), { replace: true });
      },
    });
  }

  return (
    <div className="container py-5 d-flex justify-content-center">
      <div className="card" style={{ maxWidth: "480px", width: "100%" }}>
        <div className="card-body">
          <h1 className="h4 text-center mb-4">{t("auth.login_title")}</h1>

          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
            <div className="mb-3">
              <label className="form-label">{t("auth.email")}</label>
              <input type="email" className="form-control" {...passwordForm.register("email")} />
            </div>
            <div className="mb-3">
              <label className="form-label">{t("auth.password")}</label>
              <input type="password" className="form-control" {...passwordForm.register("password")} />
            </div>
            {loginMutation.isError && (
              <p className="text-danger small">{loginMutation.error.message}</p>
            )}
            <button type="submit" className="btn bbms-cta w-100" disabled={loginMutation.isPending}>
              {t("auth.login_with_password")}
            </button>
          </form>

          <hr />
          <div className="d-flex justify-content-between small">
            <span>
              {t("auth.no_account")} <Link to="/register">{t("auth.register_link")}</Link>
            </span>
            <Link to="/forgot-password">{t("auth.forgot_password_link")}</Link>
          </div>
          <div className="text-center mt-3">
            <Link to="/">{t("auth.book_as_guest")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
