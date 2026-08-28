import { useState } from "react";
import { Lock } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import Alert from "../../components/ui/Alert";
import FieldError from "../../components/ui/FieldError";
import { useAdminAuth } from "../../context/AdminAuthContext";

/** Staff sign-in against POST /api/accounts/login/ (JWT). */

const INPUT =
  "w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

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
    <div className="flex min-h-screen items-center justify-center bg-[#090909] px-5 py-32">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#181818]">
            <Lock size={16} className="text-[#d6a85f]" />
          </span>

          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
              Staff only
            </p>

            <h1 className="mt-1 font-serif text-2xl text-white">
              Sign in
            </h1>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 rounded-[2rem] border border-white/10 bg-[#111] p-6 sm:p-8"
        >
          <div className="grid gap-5">
            <div>
              <label
                className="text-[10px] uppercase tracking-[0.25em] text-white/35"
                htmlFor="admin-username"
              >
                Username
              </label>

              <input
                id="admin-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                disabled={submitting}
                className={`${INPUT} mt-3`}
              />

              <FieldError message={error?.fieldErrors?.username} />
            </div>

            <div>
              <label
                className="text-[10px] uppercase tracking-[0.25em] text-white/35"
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
                className={`${INPUT} mt-3`}
              />

              <FieldError message={error?.fieldErrors?.password} />
            </div>

            {error && (
              <Alert tone="error" title="Could not sign you in">
                {error.message}
              </Alert>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#d6a85f] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-[11px] leading-6 text-white/25">
          Customers never sign in. This screen is only for shop staff
          verifying payments.
        </p>
      </div>
    </div>
  );
}
