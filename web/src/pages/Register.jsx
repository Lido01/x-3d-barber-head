import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import AuthShell from "../components/account/AuthShell";
import {
  INPUT,
  LABEL,
  PRIMARY_BUTTON,
} from "../components/account/authStyles";
import Alert from "../components/ui/Alert";
import FieldError from "../components/ui/FieldError";
import Spinner from "../components/ui/Spinner";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * Customer registration — POST /api/accounts/register/ followed by a
 * login, so the customer lands back on the review form signed in.
 *
 * The API decides what a valid account is: username and email must be
 * unique, the two passwords must match, and the password has to clear
 * Django's validators. Field errors come back keyed by field name and
 * are rendered under the right input rather than collapsed into one
 * banner.
 */
export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { signUp, isAuthenticated } = useCustomerAuth();

  const [form, setForm] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    password: "",
    passwordConfirm: "",
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const destination = location.state?.from || "/#testimonials";

  const update = (key) => (event) =>
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));

  if (isAuthenticated) {
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await signUp(form);
      navigate(destination, { replace: true });
    } catch (apiError) {
      setError(apiError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow={t("account.eyebrow")}
      title={t("account.signUpTitle")}
      lead={t("account.signUpLead")}
      footer={
        <p className="text-center text-sm text-white/45">
          {t("account.haveAccount")}{" "}
          <Link
            to="/login"
            state={location.state}
            className="font-semibold text-[#d6a85f] transition hover:text-[#e5bd7a]"
          >
            {t("account.signInInstead")}
          </Link>
        </p>
      }
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-5 border border-white/10 bg-[#111] p-5 sm:p-7"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="register-username">
              {t("account.form.username")}
            </label>

            <input
              id="register-username"
              value={form.username}
              onChange={update("username")}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              disabled={submitting}
              className={INPUT}
            />

            <FieldError message={error?.fieldErrors?.username} />
          </div>

          <div>
            <label className={LABEL} htmlFor="register-email">
              {t("account.form.email")}
            </label>

            <input
              id="register-email"
              type="email"
              value={form.email}
              onChange={update("email")}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck="false"
              disabled={submitting}
              className={INPUT}
            />

            <FieldError message={error?.fieldErrors?.email} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="register-first-name">
              {t("account.form.firstName")}
            </label>

            <input
              id="register-first-name"
              value={form.firstName}
              onChange={update("firstName")}
              autoComplete="given-name"
              disabled={submitting}
              className={INPUT}
            />

            <FieldError message={error?.fieldErrors?.first_name} />
          </div>

          <div>
            <label className={LABEL} htmlFor="register-last-name">
              {t("account.form.lastName")}
            </label>

            <input
              id="register-last-name"
              value={form.lastName}
              onChange={update("lastName")}
              autoComplete="family-name"
              disabled={submitting}
              className={INPUT}
            />

            <FieldError message={error?.fieldErrors?.last_name} />
          </div>
        </div>

        <div>
          <label className={LABEL} htmlFor="register-phone">
            {t("account.form.phone")}
          </label>

          <input
            id="register-phone"
            type="tel"
            value={form.phone}
            onChange={update("phone")}
            autoComplete="tel"
            disabled={submitting}
            className={INPUT}
          />

          <FieldError message={error?.fieldErrors?.phone} />
        </div>

        <div>
          <label className={LABEL} htmlFor="register-password">
            {t("account.form.password")}
          </label>

          <input
            id="register-password"
            type="password"
            value={form.password}
            onChange={update("password")}
            autoComplete="new-password"
            disabled={submitting}
            aria-describedby="register-password-hint"
            className={INPUT}
          />

          <p
            id="register-password-hint"
            className="mt-2 text-[11px] leading-5 text-white/30"
          >
            {t("account.form.passwordHint")}
          </p>

          <FieldError message={error?.fieldErrors?.password} />
        </div>

        <div>
          <label className={LABEL} htmlFor="register-password-confirm">
            {t("account.form.passwordConfirm")}
          </label>

          <input
            id="register-password-confirm"
            type="password"
            value={form.passwordConfirm}
            onChange={update("passwordConfirm")}
            autoComplete="new-password"
            disabled={submitting}
            className={INPUT}
          />

          <FieldError message={error?.fieldErrors?.password_confirm} />
        </div>

        {error && !Object.keys(error.fieldErrors || {}).length && (
          <Alert tone="error" title={t("account.form.errorTitle")}>
            {error.message}
          </Alert>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={PRIMARY_BUTTON}
        >
          {submitting ? (
            <>
              <Spinner size={15} label={t("account.form.submitting")} />
              {t("account.form.submitting")}
            </>
          ) : (
            t("account.form.submitSignUp")
          )}
        </button>
      </form>
    </AuthShell>
  );
}
