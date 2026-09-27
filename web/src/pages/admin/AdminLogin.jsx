import { useState } from "react";
import { ExternalLink, Lock } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import Alert from "../../components/ui/Alert";
import FieldError from "../../components/ui/FieldError";
import Spinner from "../../components/ui/Spinner";
import { useAdminAuth } from "../../context/AdminAuthContext";

/**
 * Staff sign-in against POST /api/accounts/login/ (JWT).
 *
 * The old layout vertically centred a `py-32` card in a 100svh
 * container, which on a 667px-tall phone pushed the sign-in button
 * below the fold and left the form scrolling behind a lot of empty
 * space. This is a plain top-aligned scrolling column under a compact
 * sticky header, with a 48px-tall button - the screen staff open first
 * thing, often one-handed while holding a coffee.
 */

const LABEL =
  "block text-[10px] uppercase tracking-[0.25em] text-white/35";

const INPUT =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50 sm:text-sm";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const { signIn, isAuthenticated } = useAdminAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const destination = location.state?.from || "/admin/payments";

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
      await signIn({ username: username.trim(), password });
      navigate(destination, { replace: true });
    } catch (apiError) {
      setError(apiError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#090909]">
      <header className="border-b border-white/10 bg-[#0d0d0d] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#181818]">
            <Lock size={15} className="text-[#d6a85f]" />
          </span>

          <p className="font-serif text-sm font-bold tracking-[0.12em] text-white">
            NOIR · STAFF
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
          Staff only
        </p>

        <h1 className="mt-3 font-serif text-3xl leading-tight text-white sm:text-4xl">
          Sign in
        </h1>

        <p className="mt-3 text-sm leading-6 text-white/45">
          Verify payments, work the booking list and moderate reviews.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-7 grid gap-5 rounded-[2rem] border border-white/10 bg-[#111] p-5 sm:p-8"
        >
          <div>
            <label
              className={LABEL}
              htmlFor="admin-username"
            >
              Username
            </label>

            <input
              id="admin-username"
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
            <label
              className={LABEL}
              htmlFor="admin-password"
            >
              Password
            </label>

            <input
              id="admin-password"
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
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-[#d6a85f] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Spinner size={15} label="Signing in" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] leading-6 text-white/25">
          Customers never sign in here. They create an account from the
          review form on the site to leave a review.
        </p>

        <Link
          to="/"
          className="mx-auto mt-5 flex w-fit items-center gap-2 text-xs text-white/35 transition hover:text-white/70"
        >
          <ExternalLink size={13} />
          Back to the website
        </Link>
      </div>
    </div>
  );
}
