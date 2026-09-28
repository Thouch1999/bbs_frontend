import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useRegister } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";

const registerSchema = z.object({
  full_name: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});
type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { t } = useTranslation(["account", "common"]);
  const navigate = useNavigate();
  const { login } = useAuth();
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });
  const registerMutation = useRegister();

  function onSubmit(values: RegisterValues) {
    registerMutation.mutate(values, {
      onSuccess: (tokens) => {
        login(tokens);
        navigate("/profile", { replace: true });
      },
    });
  }

  return (
    <div className="container py-5 d-flex justify-content-center">
      <div className="card" style={{ maxWidth: "480px", width: "100%" }}>
        <div className="card-body">
          <h1 className="h4 text-center mb-4">{t("auth.register_title")}</h1>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="mb-3">
              <label className="form-label">{t("auth.full_name")}</label>
              <input className="form-control" {...form.register("full_name")} />
              {form.formState.errors.full_name && (
                <div className="text-danger small">{form.formState.errors.full_name.message}</div>
              )}
            </div>
            <div className="mb-3">
              <label className="form-label">{t("auth.email")}</label>
              <input type="email" className="form-control" {...form.register("email")} />
              {form.formState.errors.email && (
                <div className="text-danger small">{form.formState.errors.email.message}</div>
              )}
            </div>
            <div className="mb-3">
              <label className="form-label">{t("auth.password")}</label>
              <input type="password" className="form-control" {...form.register("password")} />
              {form.formState.errors.password && (
                <div className="text-danger small">{form.formState.errors.password.message}</div>
              )}
            </div>
            {registerMutation.isError && (
              <p className="text-danger small">{registerMutation.error.message}</p>
            )}
            <button type="submit" className="btn bbms-cta w-100" disabled={registerMutation.isPending}>
              {t("auth.register_submit")}
            </button>
          </form>
          <div className="text-center mt-3">
            <Link to="/login">{t("auth.back_to_login")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
