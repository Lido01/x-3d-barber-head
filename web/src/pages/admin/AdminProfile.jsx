import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  KeyRound,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminChip,
  AdminDetails,
  AdminField,
  AdminInput,
  AdminPageHeader,
  AdminReadOnly,
  AdminSection,
} from "../../components/admin/AdminUi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { CAPABILITIES, staffRoleLabel } from "../../utils/staffRole";
import { changePassword, updateStaffAccount } from "../../services/authApi";

/**
 * Your own account — /admin/profile
 *
 * Two things a member of staff needs and had nowhere to do:
 *
 *   1. Correct their own details. A barber whose phone number on the
 *      console is wrong is a barber the shop cannot ring, and the fix was
 *      previously "an owner opens user management and finds you in a list
 *      of everyone" — a two-minute job that needs a second pair of hands.
 *   2. Change their own password. The console lives on a tablet in the
 *      shop that stays signed in between customers, so a shared password
 *      written on a card is the normal arrangement. Changing it must be
 *      something the person can do without asking anyone.
 *
 * ## What is deliberately not editable here
 *
 * Username, role and capabilities are shown but not editable, and the
 * screen says so rather than leaving disabled inputs looking like an
 * oversight. The reason is a permission boundary: role and capabilities
 * are what decide who may edit this page, so letting a page reachable by
 * every staff account also *write* them would mean any account could
 * promote itself. They are changed through the user directory, which is
 * gated on people management — see AdminUsers.
 *
 * ## The password form asks for the current one
 *
 * Because the tablets are unattended between customers. An endpoint that
 * only wanted a token would let anyone who walked past a logged-in tablet
 * take the account over, and "I locked myself out" is the failure that
 * costs a shop a shift.
 */
export default function AdminProfile() {
  const { account, updateAccount } = useAdminAuth();

  // Seeded from the session once, then owned by the form. Re-seeding on
  // every render of the context would overwrite half-typed input whenever
  // something else in the console re-reads the account.
  const [details, setDetails] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [detailsSaved, setDetailsSaved] = useState(false);

  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    if (!account) {
      return;
    }

    setDetails({
      first_name: account.first_name || "",
      last_name: account.last_name || "",
      email: account.email || "",
      phone: account.phone || "",
    });
  }, [account]);

  /**
   * What the person actually wants to hear after pressing Save.
   *
   * Blank for an unchanged email is not a change, and sending it would
   * trip the serializer's uniqueness check against the account's own row
   * on every visit.
   */
  const detailsPatch = useMemo(() => {
    const patch = {};

    if (details.first_name !== (account?.first_name || "")) {
      patch.first_name = details.first_name.trim();
    }

    if (details.last_name !== (account?.last_name || "")) {
      patch.last_name = details.last_name.trim();
    }

    if (details.email.trim() !== (account?.email || "")) {
      patch.email = details.email.trim();
    }

    if (details.phone.trim() !== (account?.phone || "")) {
      patch.phone = details.phone.trim();
    }

    return patch;
  }, [details, account]);

  const emailError =
    detailsError?.fieldErrors?.email ||
    (details.email.trim() && !details.email.trim().includes("@")
      ? "Enter a valid email address."
      : null);

  const passwordChecks = useMemo(() => {
    const checks = [];

    if (!password.currentPassword) {
      checks.push({ key: "current", label: "Enter your current password." });
    }

    if (password.newPassword.length < 8) {
      checks.push({
        key: "new",
        label: "The new password needs at least 8 characters.",
      });
    }

    if (
      password.confirmPassword &&
      password.newPassword !== password.confirmPassword
    ) {
      checks.push({ key: "confirm", label: "The two passwords do not match." });
    }

    return checks;
  }, [password]);

  const handleSaveDetails = async (event) => {
    event.preventDefault();

    if (savingDetails || Object.keys(detailsPatch).length === 0) {
      return;
    }

    setSavingDetails(true);
    setDetailsError(null);
    setDetailsSaved(false);

    try {
      const saved = await updateStaffAccount(detailsPatch);

      /*
       * Merged into the session rather than set from the response.
       * PATCH /accounts/me/ answers with the profile fields alone — the
       * role and capabilities only come with the GET — so a bare
       * `setAccount(saved)` would strip the account's staff role and empty
       * the console's own navigation.
       */
      updateAccount(saved);

      setDetailsSaved(true);
    } catch (apiError) {
      setDetailsError(apiError);
    } finally {
      setSavingDetails(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    if (savingPassword || passwordChecks.length > 0) {
      return;
    }

    setSavingPassword(true);
    setPasswordError(null);
    setPasswordSaved(false);

    try {
      await changePassword({
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
        confirmPassword: password.confirmPassword,
      });

      // Cleared rather than left filled in, so the new password is not
      // sitting in a visible input on a shop tablet after the change.
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordSaved(true);
    } catch (apiError) {
      setPasswordError(apiError);
    } finally {
      setSavingPassword(false);
    }
  };

  const role = staffRoleLabel(account?.staff_role);
  const granted = account?.permissions || [];

  // An owner/administrator resolves to "*" server-side rather than a list,
  // so naming the catalog for them would be a lie about what is stored.
  const holdsEverything = granted.includes("*");

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow={`${role} console`}
        title="Your profile"
        description="Your own account. Nobody else can edit this page."
        meta={
          <div className="mt-3 flex flex-wrap gap-2">
            <AdminChip tone="accent">
              <ShieldCheck size={11} />
              {role}
            </AdminChip>

            {account?.is_active === false && (
              <AdminChip tone="bad">Disabled</AdminChip>
            )}
          </div>
        }
      />

      {/* ----------------------------------------------------------------
          Identity
          ---------------------------------------------------------------- */}
      <AdminSection
        title="Sign-in"
        description="The username is the login identity and cannot be changed from here."
      >
        <AdminDetails columns={2}>
          <AdminDetailIcon
            icon={UserRound}
            label="Username"
            value={account?.username || "—"}
            mono
          />
          <AdminDetailIcon
            icon={Mail}
            label="Email"
            value={account?.email || "—"}
          />
        </AdminDetails>
      </AdminSection>

      {/* ----------------------------------------------------------------
          Details
          ---------------------------------------------------------------- */}
      <AdminSection
        title="Your details"
        description="How the shop reaches you, and the name that appears on bookings you handle."
        actions={
          detailsSaved ? (
            <AdminChip tone="good">
              <BadgeCheck size={11} />
              Saved
            </AdminChip>
          ) : null
        }
      >
        <form onSubmit={handleSaveDetails} noValidate className="space-y-4">
          {detailsError && (
            <Alert
              tone="error"
              title="Could not save your details"
              details={detailsError.fieldErrors}
            >
              {detailsError.message}
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="First name" htmlFor="profile-first-name">
              <AdminInput
                id="profile-first-name"
                value={details.first_name}
                onChange={(event) =>
                  setDetails((current) => ({
                    ...current,
                    first_name: event.target.value,
                  }))
                }
                autoComplete="given-name"
                maxLength={150}
              />
            </AdminField>

            <AdminField label="Last name" htmlFor="profile-last-name">
              <AdminInput
                id="profile-last-name"
                value={details.last_name}
                onChange={(event) =>
                  setDetails((current) => ({
                    ...current,
                    last_name: event.target.value,
                  }))
                }
                autoComplete="family-name"
                maxLength={150}
              />
            </AdminField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField
              label="Email"
              htmlFor="profile-email"
              error={emailError}
              hint="Used to sign in. Must be unique in the shop."
            >
              <AdminInput
                id="profile-email"
                type="email"
                inputMode="email"
                value={details.email}
                onChange={(event) =>
                  setDetails((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                autoComplete="email"
                invalid={Boolean(emailError)}
              />
            </AdminField>

            <AdminField
              label="Phone"
              htmlFor="profile-phone"
              hint="Optional. The number the shop rings you on."
            >
              <AdminInput
                id="profile-phone"
                type="tel"
                inputMode="tel"
                value={details.phone}
                onChange={(event) =>
                  setDetails((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                autoComplete="tel"
                maxLength={30}
              />
            </AdminField>
          </div>

          <AdminButton
            type="submit"
            tone="primary"
            icon={Save}
            loading={savingDetails}
            disabled={Object.keys(detailsPatch).length === 0}
            block
            className="sm:w-auto"
          >
            Save details
          </AdminButton>
        </form>
      </AdminSection>

      {/* ----------------------------------------------------------------
          Access
          ---------------------------------------------------------------- */}
      <AdminSection
        title="What you can do"
        description="Granted by an owner or administrator. Only they can change it."
      >
        {holdsEverything ? (
          <Alert tone="info" title="Everything">
            Your role holds every capability in the console, so there is
            nothing to list.
          </Alert>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {(granted.length
              ? CAPABILITIES.filter((item) => granted.includes(item.value))
              : []
            ).map((item) => (
              <li key={item.value}>
                <AdminChip tone="good">{item.label}</AdminChip>
              </li>
            ))}

            {granted.length === 0 && (
              <li className="text-sm text-console-muted">
                No capabilities granted. You can still read this profile and
                change your password.
              </li>
            )}
          </ul>
        )}
      </AdminSection>

      {/* ----------------------------------------------------------------
          Password
          ---------------------------------------------------------------- */}
      <AdminSection
        title="Change your password"
        description="Choose something you do not write on a card next to the tablet."
        actions={
          passwordSaved ? (
            <AdminChip tone="good">
              <BadgeCheck size={11} />
              Changed
            </AdminChip>
          ) : null
        }
      >
        <form onSubmit={handleChangePassword} noValidate className="space-y-4">
          {passwordError && (
            <Alert
              tone="error"
              title="Could not change your password"
              details={passwordError.fieldErrors}
            >
              {passwordError.message}
            </Alert>
          )}

          {passwordSaved && (
            <Alert tone="success" title="Password changed">
              Use it the next time you sign in. This session stays signed in
              until it ends.
            </Alert>
          )}

          <AdminField
            label="Current password"
            htmlFor="password-current"
            error={passwordError?.fieldErrors?.current_password}
          >
            <AdminInput
              id="password-current"
              type="password"
              value={password.currentPassword}
              onChange={(event) =>
                setPassword((current) => ({
                  ...current,
                  currentPassword: event.target.value,
                }))
              }
              autoComplete="current-password"
              invalid={Boolean(passwordError?.fieldErrors?.current_password)}
            />
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField
              label="New password"
              htmlFor="password-new"
              error={passwordError?.fieldErrors?.new_password}
              hint="At least 8 characters."
            >
              <AdminInput
                id="password-new"
                type="password"
                value={password.newPassword}
                onChange={(event) =>
                  setPassword((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
                autoComplete="new-password"
                invalid={Boolean(passwordError?.fieldErrors?.new_password)}
              />
            </AdminField>

            <AdminField
              label="Confirm new password"
              htmlFor="password-confirm"
              error={passwordError?.fieldErrors?.new_password_confirm}
            >
              <AdminInput
                id="password-confirm"
                type="password"
                value={password.confirmPassword}
                onChange={(event) =>
                  setPassword((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                autoComplete="new-password"
                invalid={Boolean(passwordError?.fieldErrors?.new_password_confirm)}
              />
            </AdminField>
          </div>

          {/* The same list style as the booking form's "still needed": say
              what is missing before the button is pressed, not after. */}
          {passwordChecks.length > 0 && (
            <ul className="space-y-1.5">
              {passwordChecks.map((check) => (
                <li
                  key={check.key}
                  className="flex items-start gap-2 text-[11px] leading-5 text-console-muted"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-console-accent" />
                  {check.label}
                </li>
              ))}
            </ul>
          )}

          <AdminButton
            type="submit"
            tone="primary"
            icon={KeyRound}
            loading={savingPassword}
            disabled={passwordChecks.length > 0}
            block
            className="sm:w-auto"
          >
            Change password
          </AdminButton>

          <p className="flex items-start gap-2 text-[11px] leading-5 text-console-faint">
            <Lock size={12} className="mt-0.5 shrink-0" />
            Forgotten it, and cannot sign in? An owner or administrator can
            set a new one from the user directory.
          </p>
        </form>
      </AdminSection>
    </div>
  );
}

/** One read-only identity row with an icon, for the Sign-in panel. */
function AdminDetailIcon({ icon: Icon, label, value, mono = false }) {
  return (
    <AdminReadOnly label={label}>
      <span className="flex min-w-0 items-center gap-2">
        <Icon size={14} className="shrink-0 text-console-faint" />
        <span className={`truncate ${mono ? "font-mono text-xs" : ""}`}>
          {value}
        </span>
      </span>
    </AdminReadOnly>
  );
}