import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  KeyRound,
  Pencil,
  Search,
  ShieldCheck,
  UserCog,
  X,
} from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminEmpty,
  AdminFilterTabs,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from "../../components/admin/AdminUi";
import {
  listManagedUsers,
  resetManagedUserPassword,
  updateManagedUser,
} from "../../services/authApi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import {
  ASSIGNABLE_ROLES,
  CAPABILITIES,
  staffRoleLabel,
} from "../../utils/staffRole";

/**
 * User management — the whole account directory, editable in place.
 *
 * Every account is a row, and opening one expands an editor for its
 * profile, its role and its capabilities. That is the whole screen in
 * one place on purpose: a shop promoting someone and correcting a
 * phone number are the same two minutes, and making that a trip to a
 * separate "team" page is how the two drift apart.
 *
 * The server decides what is allowed and says so in a 400. The three
 * things it refuses are surfaced here as disabled controls with the
 * reason attached, so an owner looking at the last administrator sees
 * why that button will not move rather than a failure after tapping:
 *
 *   - the owner account, which is not editable from the console
 *   - your own account's role and capabilities
 *   - the last remaining administrator
 */

const SEARCH =
  "w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

const FILTERS = [
  { key: "", label: "All" },
  { key: "customer", label: "Customers" },
  { key: "reception", label: "Reception" },
  { key: "staff", label: "Staff" },
  { key: "admin", label: "Admins" },
  { key: "owner", label: "Owner" },
];

const LABEL_CLASS = "block text-[10px] uppercase tracking-[0.2em] text-white/35";

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

  const [users, setUsers] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [resetFor, setResetFor] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [issued, setIssued] = useState(null);

  const load = useCallback(
    async (nextQuery = query, nextFilter = filter) => {
      setRefreshing(true);

      try {
        setUsers(await listManagedUsers({ query: nextQuery, role: nextFilter }));
        setError(null);
      } catch (apiError) {
        setError(apiError);
      } finally {
        setRefreshing(false);
      }
    },
    [query, filter]
  );

  // The first load deliberately runs with no filters rather than
  // re-running whenever the debounced search text changes, so the list
  // is not refetched on every keystroke.
  useEffect(() => {
    load("", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const replaceUser = (updated) => {
    setUsers((rows) =>
      rows.map((row) => (row.id === updated.id ? updated : row))
    );
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

      replaceUser(updated);
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

      replaceUser(updated);
      setNotice(
        `${updated.username} is now ${updated.is_active ? "active" : "disabled"}.`
      );
    } catch (apiError) {
      setActionError(apiError);
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

      setIssued({ username: data.temporary_password ? resetFor.username : null, password: data.temporary_password });
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

  const counts = useMemo(() => {
    const tally = { "": users?.length || 0 };

    for (const option of FILTERS) {
      if (!option.key) {
        continue;
      }

      tally[option.key] =
        users?.filter((user) => user.role === option.key).length || 0;
    }

    return tally;
  }, [users]);

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

  return (
    <div>
      <AdminPageHeader
        eyebrow="People"
        title="User management"
        description="Every customer and team account. Edit a profile, change a role, set what someone may do, or disable an account without losing its history."
        actions={
          <AdminButton
            onClick={() => load()}
            icon={Search}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </AdminButton>
        }
      />

      {error && (
        <Alert
          tone="error"
          title="Could not load accounts"
          details={error.fieldErrors}
          onRetry={() => load()}
          className="mt-6"
        >
          {error.message}
        </Alert>
      )}

      {notice && (
        <Alert
          tone="success"
          title="Saved"
          onRetry={undefined}
          className="mt-6"
        >
          {notice}
        </Alert>
      )}

      {actionError && (
        <Alert
          tone="error"
          title="Change not saved"
          details={actionError.fieldErrors}
          className="mt-6"
        >
          {actionError.message}
        </Alert>
      )}

      {issued?.password && (
        <Alert tone="info" title="Temporary password" className="mt-6">
          <p>
            Give this to {issued.username} and ask them to change it after
            signing in. It is shown once.
          </p>
          <p className="mt-2 font-mono text-sm text-white">{issued.password}</p>
        </Alert>
      )}

      <div className="relative mt-6">
        <Search
          size={15}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
        />

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              load();
            }
          }}
          placeholder="Search name, username, email or phone"
          aria-label="Search accounts"
          className={`${SEARCH} pl-11 pr-11`}
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              load("", filter);
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 transition hover:text-white"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* The role filter is applied server-side, so the counts come
          from the loaded page rather than a second request. */}
      <AdminFilterTabs
        options={FILTERS.map((option) => ({
          key: option.key,
          label: option.label,
          count: counts[option.key] ?? 0,
        }))}
        value={filter}
        onChange={(next) => {
          setFilter(next);
          load(query, next);
        }}
      />

      {!users && !error && <AdminLoading label="Loading all accounts..." />}

      {users && users.length === 0 && (
        <AdminEmpty
          title="No accounts here"
          body={
            query
              ? `No accounts match "${query}".`
              : "No accounts of this kind yet."
          }
          onRetry={() => load()}
        />
      )}

      {users && users.length > 0 && (
        <div className="mt-4 grid gap-3">
          {users.map((user) => {
            const editing = editingId === user.id;
            const locked = lockReason(user);
            const displayName =
              [user.first_name, user.last_name].filter(Boolean).join(" ") ||
              user.username;

            return (
              <AdminPanel key={user.id}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                      <UserCog size={16} className="text-[#d6a85f]" />
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {displayName}
                        {user.username !== displayName && (
                          <span className="ml-2 font-normal text-white/40">
                            {user.username}
                          </span>
                        )}
                      </p>

                      <p className="mt-1 truncate text-xs text-white/45">
                        {[user.email, user.phone]
                          .filter(Boolean)
                          .join(" · ") || "No contact details on file"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55">
                      {staffRoleLabel(user.role)}
                    </span>

                    {!user.is_active && (
                      <span className="rounded-full border border-[#e05a4f]/40 bg-[#e05a4f]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#e0776b]">
                        Disabled
                      </span>
                    )}

                    {user.id === viewer?.id && (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55">
                        You
                      </span>
                    )}
                  </div>
                </div>

                {!editing && user.permissions?.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-1.5">
                    {user.permissions.slice(0, 6).map((permission) => (
                      <span
                        key={permission}
                        className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] text-white/50"
                      >
                        {permission}
                      </span>
                    ))}

                    {user.permissions.length > 6 && (
                      <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] text-white/40">
                        +{user.permissions.length - 6} more
                      </span>
                    )}
                  </p>
                )}

                {!editing && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
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
                )}

                {locked && !editing && (
                  <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-white/35">
                    <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                    {locked}
                  </p>
                )}

                {editing && draft && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      save(user);
                    }}
                    className="mt-5 space-y-5 border-t border-white/10 pt-5"
                  >
                    <fieldset className="grid gap-4 sm:grid-cols-2">
                      <legend className={LABEL_CLASS}>Profile</legend>

                      <div className="min-w-0">
                        <label className={LABEL_CLASS} htmlFor={`first-${user.id}`}>
                          First name
                        </label>
                        <input
                          id={`first-${user.id}`}
                          value={draft.first_name}
                          onChange={(event) =>
                            setDraft({ ...draft, first_name: event.target.value })
                          }
                          className={`${FIELD} mt-2`}
                        />
                      </div>

                      <div className="min-w-0">
                        <label className={LABEL_CLASS} htmlFor={`last-${user.id}`}>
                          Last name
                        </label>
                        <input
                          id={`last-${user.id}`}
                          value={draft.last_name}
                          onChange={(event) =>
                            setDraft({ ...draft, last_name: event.target.value })
                          }
                          className={`${FIELD} mt-2`}
                        />
                      </div>

                      <div className="min-w-0">
                        <label className={LABEL_CLASS} htmlFor={`email-${user.id}`}>
                          Email
                        </label>
                        <input
                          id={`email-${user.id}`}
                          type="email"
                          value={draft.email}
                          onChange={(event) =>
                            setDraft({ ...draft, email: event.target.value })
                          }
                          className={`${FIELD} mt-2`}
                        />
                      </div>

                      <div className="min-w-0">
                        <label className={LABEL_CLASS} htmlFor={`phone-${user.id}`}>
                          Phone
                        </label>
                        <input
                          id={`phone-${user.id}`}
                          type="tel"
                          value={draft.phone}
                          onChange={(event) =>
                            setDraft({ ...draft, phone: event.target.value })
                          }
                          className={`${FIELD} mt-2`}
                        />
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className={LABEL_CLASS}>Role</legend>

                      <p className="mt-2 text-[11px] leading-5 text-white/35">
                        A customer has no console access. Reception, staff
                        and administrator accounts are limited to the
                        capabilities ticked below — an administrator
                        holds all of them regardless.
                      </p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {user.is_superuser
                          ? [
                              {
                                value: "owner",
                                label: "Owner",
                                hint: "Created with createsuperuser. Not assignable here.",
                              },
                            ]
                          : ASSIGNABLE_ROLES.map((option) => (
                              <label
                                key={option.value}
                                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                                  draft.role === option.value
                                    ? "border-[#d6a85f]/50 bg-[#d6a85f]/10 text-white"
                                    : "border-white/10 bg-white/[0.02] text-white/55 hover:border-white/25"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`role-${user.id}`}
                                  value={option.value}
                                  checked={draft.role === option.value}
                                  onChange={() =>
                                    setDraft({ ...draft, role: option.value })
                                  }
                                  className="accent-[#d6a85f]"
                                />
                                {option.label}
                              </label>
                            ))}
                      </div>
                    </fieldset>

                    {draft.role !== "customer" &&
                      draft.role !== "owner" && (
                        <fieldset>
                          <legend className={LABEL_CLASS}>
                            Capabilities
                          </legend>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {CAPABILITIES.map((capability) => (
                              <label
                                key={capability.value}
                                className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs transition hover:border-white/25"
                              >
                                <input
                                  type="checkbox"
                                  checked={draft.permissions.includes(
                                    capability.value
                                  )}
                                  onChange={() =>
                                    togglePermission(capability.value)
                                  }
                                  className="mt-0.5 accent-[#d6a85f]"
                                />
                                <span>
                                  {capability.label}
                                  <span className="mt-0.5 block text-[10px] text-white/35">
                                    {capability.value}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      )}

                    {draft.role === "admin" && (
                      <p className="flex items-start gap-2 rounded-xl border border-[#d6a85f]/25 bg-[#d6a85f]/10 p-3 text-[11px] leading-5 text-white/60">
                        <ShieldCheck
                          size={13}
                          className="mt-0.5 shrink-0 text-[#d6a85f]"
                        />
                        An administrator manages every account, service,
                        payment and booking without ticking anything above.
                        Ticked capabilities are still stored, so they are
                        what this account falls back to if the role is ever
                        changed.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                      <AdminButton type="submit" tone="primary" icon={Check} disabled={saving}>
                        {saving ? "Saving..." : "Save changes"}
                      </AdminButton>

                      <AdminButton onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </AdminButton>
                    </div>
                  </form>
                )}
              </AdminPanel>
            );
          })}
        </div>
      )}

      {resetFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close password reset"
            onClick={closeReset}
            className="absolute inset-0 bg-black/75"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            className="relative w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0d0d0d] p-5 sm:rounded-3xl"
          >
            <h2 id="reset-title" className="font-serif text-2xl text-white">
              Reset password
            </h2>

            <p className="mt-2 text-xs leading-5 text-white/45">
              Set a password for {resetFor.username}, or leave the field
              blank to have one generated. Hand it over in person — it
              is shown once and cannot be retrieved again.
            </p>

            {issued?.password ? (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                  Temporary password
                </p>
                <p className="mt-2 break-all font-mono text-sm text-white">
                  {issued.password}
                </p>
              </div>
            ) : (
              <form onSubmit={submitReset} className="mt-5 space-y-4">
                <div>
                  <label className={LABEL_CLASS} htmlFor="new-password">
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="text"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Leave blank to generate one"
                    className={`${FIELD} mt-2`}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <AdminButton
                    type="submit"
                    tone="primary"
                    icon={KeyRound}
                    disabled={resetting}
                  >
                    {resetting ? "Resetting..." : "Reset password"}
                  </AdminButton>

                  <AdminButton onClick={closeReset} disabled={resetting}>
                    Cancel
                  </AdminButton>
                </div>
              </form>
            )}

            {issued?.password && (
              <div className="mt-4">
                <AdminButton tone="primary" onClick={closeReset} className="w-full">
                  Done
                </AdminButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
