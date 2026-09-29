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
 * Customer sign-in — POST /api/accounts/login/ with the customer
 * session's token store.
 *
 * The usual reason to land here is the review form: a visitor taps
 * "sign in to review" and comes back to the page they left, which is
 * what `location.state.from` carries.
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { signIn, isAuthenticated } = useCustomerAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const destination = location.state?.from || "/#testimonials";

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
      await signIn({ username, password });
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
      title={t("account.signInTitle")}
      lead={t("account.signInLead")}
      footer={
        <div className="space-y-3 text-center text-sm text-white/45">
          <p>
          {t("account.noAccount")}{" "}
          <Link
            to="/register"
            state={location.state}
            className="font-semibold text-[#d6a85f] transition hover:text-[#e5bd7a]"
          >
            {t("account.createOne")}
          </Link>
          </p>
        </div>
      }
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-5 border-white/10 bg-[#111] p-5 sm:p-7"
      >
        <div>
          <label className={LABEL} htmlFor="customer-username">
            {t("account.form.username")}
          </label>

          <input
            id="customer-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            disabled={submitting}
            className={INPUT}
          />

          <FieldError message={error?.fieldErrors?.username} />
        </div>

        <div>
          <label className={LABEL} htmlFor="customer-password">
            {t("account.form.password")}
          </label>

          <input
            id="customer-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={submitting}
            className={INPUT}
          />

          <FieldError message={error?.fieldErrors?.password} />
        </div>

        {error && (
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
            t("account.form.submitSignIn")
          )}
        </button>
      </form>
    </AuthShell>
  );
}
