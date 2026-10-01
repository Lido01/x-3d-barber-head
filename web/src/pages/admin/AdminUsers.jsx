import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Pencil,
  RefreshCw,
  ShieldCheck,
  UserCog,
  UserPlus,
} from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminCheck,
  AdminChip,
  AdminEmpty,
  AdminField,
  AdminFilterTabs,
  AdminInput,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  AdminSearch,
  AdminSheet,
} from "../../components/admin/AdminUi";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { EMPTY_LIST, invalidateQuery, useQuery } from "../../hooks/useQuery";
import {
  createManagedUser,
  listManagedUsers,
  resetManagedUserPassword,
  updateManagedUser,
} from "../../services/authApi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { ASSIGNABLE_ROLES, CAPABILITIES, staffRoleLabel } from "../../utils/staffRole";

/**
 * User management — the whole account directory, editable in place.
 *
 * Every account is a row, and opening one expands an editor for its
 * profile, its role and its capabilities. That is the whole screen in
 * one place on purpose: a shop promoting someone and correcting a
 * phone number are the same two minutes, and making that a trip to a
 * separate "team" page is how the two drift apart.
 *
 * Adding someone is a first-class action here rather than a trip to the
 * public sign-up form. Onboarding a barber before their shift is two
 * fields and a role; making it a register-then-promote journey across
 * two screens is how new staff end up waiting a day for access.
 *
 * The server decides what is allowed and says so in a 400. The three
 * things it refuses are surfaced here as disabled controls with the
 * reason attached, so an owner looking at the last administrator sees
 * why that button will not move rather than a failure after tapping:
 *
 *   - the owner account, which is not editable from the console
 *   - your own account's role and capabilities
 *   - the last remaining administrator
 *
 * Every form opens in a sheet: a full-height panel on a phone, a
 * centred dialog on a desktop. Inline expansion was tried and is wrong
 * for both - on a phone it pushes the row you were reading off screen,
 * and on a desktop it moves the page under the cursor.
 */

const FILTERS = [
  { key: "", label: "All" },
  { key: "customer", label: "Customers" },
  { key: "reception", label: "Reception" },
  { key: "staff", label: "Staff" },
  { key: "admin", label: "Admins" },
  { key: "owner", label: "Owner" },
];

const BLANK = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  password: "",
  role: "customer",
  permissions: [],
};

/** Blank form state for an account being edited. */
function draftFor(user) {
  return {
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    email: user.email || "",
    phone: user.phone || "",
    role: user.role === "owner" ? "owner" : user.role || "customer",
    permissions: [...(user.permissions || [])].filter((item) => item !== "*"),
  };
}

export default function AdminUsers() {
  const { account: viewer } = useAdminAuth();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [resetFor, setResetFor] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [issued, setIssued] = useState(null);

  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState(null);

  /**
   * The account just created, held onto only so its one-time password
   * can be shown. Kept apart from `created` (the form draft) because
   * closing the form must not throw the password away before anyone
   * has read it.
   */
  const [issuedAccount, setIssuedAccount] = useState(null);

  // Search and role narrowing are done by the server. Debouncing the text
  // keeps a request per keystroke from becoming a request per character,
  // and because the term is part of the cache key, going back to an
  // earlier search shows its results with no request at all.
  const search = useDebouncedValue(query, 300);

  const {
    data: users,
    error,
    isFetching: refreshing,
    refetch,
  } = useQuery(
    "/accounts/users/",
    (signal) => listManagedUsers({ query: search, role: filter, signal }),
    {
      params: { q: search, role: filter },
      scope: "staff",
      staleMs: 30 * 1000,
    }
  );

  const rows = users || EMPTY_LIST;

  const counts = useMemo(() => {
    const tally = { "": rows.length };

    for (const option of FILTERS) {
      if (!option.key) {
        continue;
      }

      tally[option.key] = rows.filter((user) => user.role === option.key).length;
    }

    return tally;
  }, [rows]);

  /**
   * A role or profile edit changes what the whole directory shows, and
   * the team screen reads the same accounts, so both are dropped.
   */
  const refreshAccounts = () => {
    invalidateQuery("accounts/users");
    invalidateQuery("accounts/staff");
    invalidateQuery("accounts/customers");
    invalidateQuery("accounts/me");
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setDraft(draftFor(user));
    setActionError(null);
    setNotice(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setActionError(null);
  };

  const togglePermission = (capability) => {
    setDraft((value) => ({
      ...value,
      permissions: value.permissions.includes(capability)
        ? value.permissions.filter((item) => item !== capability)
        : [...value.permissions, capability],
    }));
  };

  const save = async (user) => {
    setSaving(true);
    setActionError(null);

    try {
      const updated = await updateManagedUser(user.id, {
        first_name: draft.first_name,
        last_name: draft.last_name,
        email: draft.email,
        phone: draft.phone,
        role: draft.role,
        permissions: draft.permissions,
      });

      refreshAccounts();
      cancelEdit();
      setNotice(`Saved changes to ${updated.username}.`);
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Enable or disable an account.
   *
   * The confirmation is a native prompt because on a phone this button
   * often sits under a thumb, and disabling a colleague's account
   * locks them out mid-shift.
   */
  const toggleActive = async (user) => {
    const nextActive = !user.is_active;

    if (
      !nextActive &&
      !window.confirm(
        `Disable ${user.username}? They will be signed out and unable to sign in until this is undone.`
      )
    ) {
      return;
    }

    setActionError(null);

    try {
      const updated = await updateManagedUser(user.id, {
        is_active: nextActive,
      });

      refreshAccounts();
      setNotice(
        `${updated.username} is now ${updated.is_active ? "active" : "disabled"}.`
      );
    } catch (apiError) {
      setActionError(apiError);
    }
  };

  const submitCreate = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setActionError(null);

    try {
      const account = await createManagedUser({
        username: created.username,
        email: created.email,
        firstName: created.first_name,
        lastName: created.last_name,
        phone: created.phone,
        password: created.password,
        role: created.role,
        permissions: created.permissions,
      });

      refreshAccounts();

      // Close the form but hold the account, so the one-time password
      // survives into the sheet that shows it.
      setCreated(null);
      setAdding(false);
      setIssuedAccount(account);
      setNotice(`${account.username} can now sign in.`);
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setSaving(false);
    }
  };

  const submitReset = async (event) => {
    event.preventDefault();
    setResetting(true);
    setActionError(null);

    try {
      const data = await resetManagedUserPassword(
        resetFor.id,
        newPassword.trim()
      );

      setIssued({
        username: data.temporary_password ? resetFor.username : null,
        password: data.temporary_password,
      });
      setNewPassword("");
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setResetting(false);
    }
  };

  const closeReset = () => {
    setResetFor(null);
    setNewPassword("");
    setIssued(null);
    setActionError(null);
  };

  const openAdd = () => {
    setCreated({ ...BLANK });
    setActionError(null);
    setAdding(true);
  };
  /**
   * Why the editor's controls are unavailable, if they are.
   *
   * Mirrors the server's rules so the reason is visible before the
   * attempt rather than after it. The server still enforces all of it.
   */
  const lockReason = (user) => {
    if (user.is_superuser) {
      return "The owner account is managed outside the console.";
    }

    if (user.id === viewer?.id) {
      return "You cannot change your own role, capabilities or access.";
    }

    return null;
  };

  const fieldError = (name) => actionError?.fieldErrors?.[name];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="People"
        title="User management"
        description="Every customer and team account. Add someone, edit a profile, change a role, set what they may do, or disable an account without losing its history."
        actions={
          <>
            <AdminButton onClick={refetch} icon={RefreshCw} loading={refreshing}>
              Refresh
            </AdminButton>

            <AdminButton tone="primary" icon={UserPlus} onClick={openAdd}>
              Add user
            </AdminButton>
          </>
        }
      />

      {error && (
        <Alert
          tone="error"
          title="Could not load accounts"
          details={error.fieldErrors}
          onRetry={refetch}
        >
          {error.message}
        </Alert>
      )}

      {actionError && !adding && !editingId && !resetFor && (
        <Alert tone="error" title="Action failed" details={actionError.fieldErrors}>
          {actionError.message}
        </Alert>
      )}

      {notice && !actionError && (
        <Alert tone="success" title={notice}>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <AdminSearch
          value={query}
          onChange={setQuery}
          placeholder="Search name, username, email or phone"
        />

        <div className="hidden shrink-0 items-center gap-2 text-xs text-console-muted sm:flex">
          <span>
            {rows.length} {rows.length === 1 ? "account" : "accounts"}
          </span>
        </div>
      </div>

      <AdminFilterTabs
        options={FILTERS.map((option) => ({
          key: option.key,
          label: option.label,
          count: counts[option.key] ?? 0,
        }))}
        value={filter}
        onChange={setFilter}
      />

      {!users && !error && <AdminLoading label="Loading all accounts..." />}

      {users && rows.length === 0 && (
        <AdminEmpty
          title="No accounts here"
          body={
            search || filter
              ? `No accounts match "${search || filter}".`
              : "No accounts of this kind yet."
          }
          onRetry={refetch}
          action={
            <AdminButton tone="primary" icon={UserPlus} onClick={openAdd}>
              Add the first one
            </AdminButton>
          }
        />
      )}

      {users && rows.length > 0 && (
        <ul className="grid gap-3">
          {rows.map((user) => {
            const locked = lockReason(user);

            return (
              <li key={user.id}>
                <AdminPanel>
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-console-accent-soft text-console-accent-strong">
                        <UserCog size={17} />
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-console-ink">
                          {user.first_name || user.last_name
                            ? `${user.first_name} ${user.last_name}`.trim()
                            : user.username}
                          {user.username !==
                            `${user.first_name} ${user.last_name}`.trim() && (
                            <span className="ml-2 font-normal text-console-muted">
                              {user.username}
                            </span>
                          )}
                        </p>

                        <p className="mt-1 truncate text-xs text-console-muted">
                          {[user.email, user.phone]
                            .filter(Boolean)
                            .join(" · ") || "No contact details on file"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <AdminChip
                        tone={
                          user.role === "admin" || user.role === "owner"
                            ? "info"
                            : user.role === "customer"
                              ? "neutral"
                              : "good"
                        }
                      >
                        {staffRoleLabel(user.role)}
                      </AdminChip>

                      {!user.is_active && <AdminChip tone="bad">Disabled</AdminChip>}

                      {user.id === viewer?.id && (
                        <AdminChip tone="warn">You</AdminChip>
                      )}
                    </div>
                  </div>

                  {user.permissions?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {user.permissions.slice(0, 6).map((permission) => (
                        <AdminChip key={permission}>{permission}</AdminChip>
                      ))}

                      {user.permissions.length > 6 && (
                        <AdminChip>
                          +{user.permissions.length - 6} more
                        </AdminChip>
                      )}
                    </div>
                  )}

                  {locked && (
                    <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-console-muted">
                      <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                      {locked}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-console-line pt-4">
                    <AdminButton
                      icon={Pencil}
                      disabled={Boolean(locked)}
                      onClick={() => startEdit(user)}
                    >
                      Edit
                    </AdminButton>

                    {!user.is_superuser && (
                      <>
                        <AdminButton
                          icon={KeyRound}
                          onClick={() => {
                            setResetFor(user);
                            setIssued(null);
                            setActionError(null);
                          }}
                        >
                          Reset password
                        </AdminButton>

                        <AdminButton
                          tone={user.is_active ? "danger" : "neutral"}
                          disabled={user.id === viewer?.id}
                          onClick={() => toggleActive(user)}
                        >
                          {user.is_active ? "Disable" : "Enable"}
                        </AdminButton>
                      </>
                    )}
                  </div>
                </AdminPanel>
              </li>
            );
          })}
        </ul>
      )}

      {/* --- Edit an existing account ------------------------------- */}
      <AdminSheet
        open={Boolean(editingId && draft)}
        onClose={cancelEdit}
        title="Edit account"
        description="Profile, role and what this account may do."
        footer={
          <>
            <AdminButton onClick={cancelEdit} disabled={saving}>
              Cancel
            </AdminButton>

            <AdminButton
              tone="primary"
              icon={Check}
              loading={saving}
              onClick={() => {
                const user = rows.find((row) => row.id === editingId);

                if (user) {
                  save(user);
                }
              }}
            >
              Save changes
            </AdminButton>
          </>
        }
      >
        {draft && (
          <form onSubmit={save} className="space-y-5">
            {actionError && (
              <Alert tone="error" title="Could not save" details={actionError.fieldErrors}>
                {actionError.message}
              </Alert>
            )}

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted">
                Profile
              </legend>

              <AdminField label="First name" error={fieldError("first_name")}>
                <AdminInput
                  value={draft.first_name}
                  onChange={(event) =>
                    setDraft({ ...draft, first_name: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Last name" error={fieldError("last_name")}>
                <AdminInput
                  value={draft.last_name}
                  onChange={(event) =>
                    setDraft({ ...draft, last_name: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Email" error={fieldError("email")}>
                <AdminInput
                  type="email"
                  value={draft.email}
                  onChange={(event) =>
                    setDraft({ ...draft, email: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Phone" error={fieldError("phone")}>
                <AdminInput
                  type="tel"
                  value={draft.phone}
                  onChange={(event) =>
                    setDraft({ ...draft, phone: event.target.value })
                  }
                />
              </AdminField>
            </fieldset>

            <fieldset>
              <legend className="text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted">
                Role
              </legend>

              <p className="mt-1.5 text-[11px] leading-5 text-console-muted">
                A customer has no console access. Reception, staff and
                administrator accounts are limited to the capabilities
                ticked below — an administrator holds all of them
                regardless.
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {ASSIGNABLE_ROLES.map((option) => (
                  <label
                    key={option.value}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition ${
                      draft.role === option.value
                        ? "border-console-accent bg-console-accent-soft font-semibold text-console-accent-strong"
                        : "border-console-line text-console-body hover:border-console-line-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="admin-edit-role"
                      value={option.value}
                      checked={draft.role === option.value}
                      onChange={() => setDraft({ ...draft, role: option.value })}
                      className="accent-console-accent"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {draft.role !== "customer" && (
              <fieldset>
                <legend className="text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted">
                  Capabilities
                </legend>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {CAPABILITIES.map((capability) => (
                    <AdminCheck
                      key={capability.value}
                      label={capability.label}
                      description={capability.value}
                      checked={draft.permissions.includes(capability.value)}
                      onChange={() => togglePermission(capability.value)}
                    />
                  ))}
                </div>
              </fieldset>
            )}

            {draft.role === "admin" && (
              <p className="flex items-start gap-2 rounded-xl border border-console-accent/30 bg-console-accent-soft p-3 text-[11px] leading-5 text-console-accent-strong">
                <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                An administrator manages every account, service, payment and
                booking without ticking anything above. Ticked capabilities
                are still stored, so they are what this account falls back
                to if the role is ever changed.
              </p>
            )}

            {/* Lets Enter submit from any field, without a visible
                duplicate of the footer's Save button. */}
            <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
          </form>
        )}
      </AdminSheet>

      {/* --- Add a new account -------------------------------------- */}
      <AdminSheet
        open={adding}
        onClose={() => {
          setAdding(false);
          setCreated(null);
          setActionError(null);
        }}
        title="Add a user"
        description="Creates the account and decides what it may do, in one step."
        footer={
          <>
            <AdminButton
              onClick={() => {
                setAdding(false);
                setCreated(null);
                setActionError(null);
              }}
              disabled={saving}
            >
              Cancel
            </AdminButton>

            <AdminButton
              tone="primary"
              icon={UserPlus}
              loading={saving}
              onClick={submitCreate}
            >
              Create account
            </AdminButton>
          </>
        }
      >
        {created && (
          <form onSubmit={submitCreate} className="space-y-5">
            {actionError && (
              <Alert tone="error" title="Could not create the account" details={actionError.fieldErrors}>
                {actionError.message}
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField
                label="Username"
                required
                error={fieldError("username")}
                hint="What they type to sign in. Cannot be changed later."
              >
                <AdminInput
                  value={created.username}
                  autoCapitalize="none"
                  autoComplete="off"
                  invalid={Boolean(fieldError("username"))}
                  onChange={(event) =>
                    setCreated({ ...created, username: event.target.value })
                  }
                />
              </AdminField>

              <AdminField
                label="Email"
                required
                error={fieldError("email")}
              >
                <AdminInput
                  type="email"
                  value={created.email}
                  invalid={Boolean(fieldError("email"))}
                  onChange={(event) =>
                    setCreated({ ...created, email: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="First name" error={fieldError("first_name")}>
                <AdminInput
                  value={created.first_name}
                  onChange={(event) =>
                    setCreated({ ...created, first_name: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Last name" error={fieldError("last_name")}>
                <AdminInput
                  value={created.last_name}
                  onChange={(event) =>
                    setCreated({ ...created, last_name: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Phone" error={fieldError("phone")}>
                <AdminInput
                  type="tel"
                  value={created.phone}
                  onChange={(event) =>
                    setCreated({ ...created, phone: event.target.value })
                  }
                />
              </AdminField>

              <AdminField
                label="Password"
                error={fieldError("password")}
                hint="Leave blank and one is generated. Shown once."
              >
                <AdminInput
                  value={created.password}
                  autoComplete="new-password"
                  invalid={Boolean(fieldError("password"))}
                  onChange={(event) =>
                    setCreated({ ...created, password: event.target.value })
                  }
                />
              </AdminField>
            </div>

            <fieldset>
              <legend className="text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted">
                Role
              </legend>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {ASSIGNABLE_ROLES.map((option) => (
                  <label
                    key={option.value}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition ${
                      created.role === option.value
                        ? "border-console-accent bg-console-accent-soft font-semibold text-console-accent-strong"
                        : "border-console-line text-console-body hover:border-console-line-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="admin-create-role"
                      value={option.value}
                      checked={created.role === option.value}
                      onChange={() =>
                        setCreated({ ...created, role: option.value })
                      }
                      className="accent-console-accent"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {created.role !== "customer" && created.role !== "admin" && (
              <fieldset>
                <legend className="text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted">
                  Capabilities
                </legend>

                <p className="mt-1.5 text-[11px] leading-5 text-console-muted">
                  Exactly what this account may do. Tick nothing to grant
                  nothing — an account that can see nothing can be filled
                  in later from the same screen.
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {CAPABILITIES.map((capability) => (
                    <AdminCheck
                      key={capability.value}
                      label={capability.label}
                      description={capability.value}
                      checked={created.permissions.includes(capability.value)}
                      onChange={(checked) =>
                        setCreated({
                          ...created,
                          permissions: checked
                            ? [...created.permissions, capability.value]
                            : created.permissions.filter(
                                (item) => item !== capability.value
                              ),
                        })
                      }
                    />
                  ))}
                </div>
              </fieldset>
            )}

            {created.role === "admin" && (
              <p className="flex items-start gap-2 rounded-xl border border-console-accent/30 bg-console-accent-soft p-3 text-[11px] leading-5 text-console-accent-strong">
                <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                An administrator can manage every account, service, payment
                and booking. That includes creating and disabling other
                administrators.
              </p>
            )}

            <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
          </form>
        )}
      </AdminSheet>

      {/* --- The generated password, shown once --------------------- */}
      <AdminSheet
        open={Boolean(issuedAccount?.temporary_password)}
        onClose={() => setIssuedAccount(null)}
        title="Account created"
        description="This password is shown once and cannot be retrieved again."
        footer={
          <AdminButton tone="primary" block onClick={() => setIssuedAccount(null)}>
            Done
          </AdminButton>
        }
      >
        {issuedAccount?.temporary_password && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-console-body">
              <Check size={15} className="shrink-0 text-console-good" />
              <span>
                <strong className="font-semibold">{issuedAccount.username}</strong>{" "}
                can sign in as{" "}
                {staffRoleLabel(issuedAccount.role).toLowerCase()}.
              </span>
            </div>

            <div className=" rounded-xl border border-console-accent/30 bg-console-accent-soft p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-console-accent-strong">
                Temporary password
              </p>

              <p className="mt-2 select-all break-all font-mono text-lg text-console-ink">
                {issuedAccount.temporary_password}
              </p>
            </div>

            <AdminButton
              block
              icon={Copy}
              onClick={() => {
                navigator.clipboard?.writeText(issuedAccount.temporary_password);
              }}
            >
              Copy to clipboard
            </AdminButton>

            <p className="text-xs leading-6 text-console-muted">
              Write it down and hand it over in person. The shop has no
              outbound mail, so there is no reset link waiting in an inbox —
              if it is lost, use Reset password on their row.
            </p>
          </div>
        )}
      </AdminSheet>

      {/* --- Password reset ---------------------------------------- */}
      <AdminSheet
        open={Boolean(resetFor)}
        onClose={closeReset}
        title="Reset password"
        description={
          resetFor
            ? `Set a password for ${resetFor.username}, or leave it blank to generate one. It is shown once and cannot be retrieved again.`
            : ""
        }
        footer={
          issued?.password ? (
            <AdminButton tone="primary" block onClick={closeReset}>
              Done
            </AdminButton>
          ) : (
            <>
              <AdminButton onClick={closeReset} disabled={resetting}>
                Cancel
              </AdminButton>

              <AdminButton
                tone="primary"
                icon={KeyRound}
                loading={resetting}
                onClick={submitReset}
              >
                Reset password
              </AdminButton>
            </>
          )
        }
      >
        {resetFor &&
          (issued?.password ? (
            <div className=" rounded-xl border border-console-accent/30 bg-console-accent-soft p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-console-accent-strong">
                Temporary password
              </p>

              <p className="mt-2 select-all break-all font-mono text-lg text-console-ink">
                {issued.password}
              </p>

              <AdminButton
                className="mt-3"
                block
                icon={Copy}
                onClick={() => {
                  navigator.clipboard?.writeText(issued.password);
                }}
              >
                Copy to clipboard
              </AdminButton>
            </div>
          ) : (
            <form onSubmit={submitReset} className="space-y-4">
              {actionError && (
                <Alert tone="error" title="Could not reset" details={actionError.fieldErrors}>
                  {actionError.message}
                </Alert>
              )}

              <AdminField
                label="New password"
                hint="Leave blank to generate a strong one."
                error={fieldError("password")}
              >
                <AdminInput
                  value={newPassword}
                  autoComplete="new-password"
                  invalid={Boolean(fieldError("password"))}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </AdminField>

              <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
            </form>
          ))}
      </AdminSheet>
    </div>
  );
}
