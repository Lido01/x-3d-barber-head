import { useState } from "react";
import { ExternalLink, Lock, Scissors } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import Alert from "../../components/ui/Alert";
import Spinner from "../../components/ui/Spinner";
import { AdminButton, AdminField, AdminInput } from "../../components/admin/AdminUi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { staffDashboardPath } from "../../utils/staffRole";

/**
 * Staff sign-in against POST /api/accounts/login/ (JWT).
 *
 * The old layout vertically centred a `py-32` card in a 100svh
 * container, which on a 667px-tall phone pushed the sign-in button
 * below the fold and left the form scrolling behind a lot of empty
 * space. This is a plain top-aligned scrolling column under a compact
 * header, with a 48px-tall button - the screen staff open first thing,
 * often one-handed while holding a coffee.
 *
 * It uses the console's own field components rather than the
 * storefront's dark inputs, because the surface behind this form is the
 * console surface, and a dark-on-dark field on a light panel is the
 * kind of thing that is invisible until someone fails to type into it.
 */
export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const { signIn, isAuthenticated } = useAdminAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const destination = location.state?.from;

  if (isAuthenticated) {
    // Falls back to the role's own dashboard rather than `undefined`,
    // which would render a Navigate with no target.
    return <Navigate to={destination || "/admin"} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const data = await signIn({
        username: username.trim(),
        password,
      });

      navigate(destination || staffDashboardPath(data.user?.staff_role), {
        replace: true,
      });
    } catch (apiError) {
      setError(apiError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[var(--viewport-height)] flex-col bg-console text-console-ink">
      <header className="border-b border-console-line bg-console-raised px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-console-accent text-console-on-accent">
            <Scissors size={16} />
          </span>

          <p className="font-serif text-sm font-bold tracking-[0.12em] text-console-ink">
            NOIR
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-console-accent">
              Staff console
            </span>
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mt-2 font-serif text-3xl leading-tight text-console-ink sm:text-4xl">
          Sign in
        </h1>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 grid gap-5  border border-console-line bg-console-raised p-5 sm:p-6"
        >
          <AdminField
            label="Username"
            htmlFor="admin-username"
            error={error?.fieldErrors?.username}
          >
            <AdminInput
              id="admin-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              disabled={submitting}
              invalid={Boolean(error?.fieldErrors?.username)}
            />
          </AdminField>

          <AdminField
            label="Password"
            htmlFor="admin-password"
            error={error?.fieldErrors?.password}
          >
            <AdminInput
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={submitting}
              invalid={Boolean(error?.fieldErrors?.password)}
            />
          </AdminField>

          {error && (
            <Alert
              tone="error"
              title="Could not sign you in"
              details={error.fieldErrors}
            >
              {error.message}
            </Alert>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-12 w-full items-center justify-center gap-3 border border-console-accent bg-console-accent px-6 py-3 text-sm font-semibold text-console-on-accent transition hover:bg-console-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Spinner size={15} label="Signing in" /> : "Sign in"}
          </button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-3 text-center">
          <Link
            to="/login"
            className="text-xs font-semibold text-console-accent hover:underline"
          >
            Customer sign-in
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs text-console-muted hover:text-console-ink"
          >
            <ExternalLink size={13} />
            Back to the website
          </Link>
        </div>
      </div>

      <footer className="border-t border-console-line px-4 py-4 sm:px-6">
        <p className="mx-auto flex max-w-md items-center justify-center gap-2 text-[11px] text-console-faint">
          <Lock size={12} />
          Sessions last 30 minutes and refresh on their own.
        </p>
      </footer>
    </div>
  );
}
