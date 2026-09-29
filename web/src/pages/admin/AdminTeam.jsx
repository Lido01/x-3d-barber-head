import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Pencil, ShieldCheck, UserPlus, X } from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from "../../components/admin/AdminUi";
import {
  createStaffAccess,
  listRegisteredCustomers,
  listStaffAccess,
  updateStaffAccess,
} from "../../services/authApi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import {
  ASSIGNABLE_ROLES,
  CAPABILITIES,
  staffRoleLabel,
} from "../../utils/staffRole";

/**
 * Team access — who works here and what each of them may do.
 *
 * The same data is editable in user management, and deliberately so:
 * both screens write through the same endpoints, so neither can end up
 * showing a role the other has quietly changed. This one is the
 * quicker path for the common case — granting someone console access
 * for the first time — while user management is the one that also
 * carries the profile and phone.
 *
 * A role is not the same thing as a permission. Choosing
 * "Administrator" grants everything implicitly and hides the checkboxes
 * from mattering; the other roles are exactly the boxes ticked, which
 * is why they stay visible and editable rather than being replaced by
 * a preset the owner has to trust.
 */

const SEARCH =
  "w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

const LABEL_CLASS = "block text-[10px] uppercase tracking-[0.2em] text-white/35";

const DEFAULT_DRAFT = {
  user: "",
  role: "reception",
  permissions: ["bookings.view", "bookings.manage", "customers.view"],
};

export default function AdminTeam() {
  const { account: viewer } = useAdminAuth();

  const [staff, setStaff] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState(null);

  const load = useCallback(async () => {
    try {
      const [members, accounts] = await Promise.all([
        listStaffAccess(),
        listRegisteredCustomers(),
      ]);

      setStaff(members);
      setCustomers(accounts);
      setError(null);
    } catch (apiError) {
      setError(apiError);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDraftPermission = (capability) =>
    setDraft((value) => ({
      ...value,
      permissions: value.permissions.includes(capability)
        ? value.permissions.filter((item) => item !== capability)
        : [...value.permissions, capability],
    }));

  const create = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await createStaffAccess({ ...draft, user: Number(draft.user) });

      setDraft(DEFAULT_DRAFT);
      setNotice("Access granted.");
      await load();
    } catch (apiError) {
      setError(apiError);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (member) => {
    setEditingId(member.id);
    setEdit({
      role: member.role,
      permissions: [...(member.permissions || [])],
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit(null);
  };

  const saveMember = async (member) => {
    setSaving(true);
    setError(null);

    try {
      await updateStaffAccess(member.id, {
        role: edit.role,
        permissions: edit.permissions,
      });

      cancelEdit();
      setNotice(`Updated access for ${member.username}.`);
      await load();
    } catch (apiError) {
      setError(apiError);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (member) => {
    setError(null);

    try {
      await updateStaffAccess(member.id, { is_active: !member.is_active });
      await load();
    } catch (apiError) {
      setError(apiError);
    }
  };

  /**
   * Why a member's controls are unavailable, if they are.
   *
   * The server refuses to let anyone revoke their own access or remove
   * the last administrator, so the button is disabled with the reason
   * attached rather than failing after the tap.
   */
  const lockReason = (member) => {
    if (member.user === viewer?.id && member.is_active) {
      return "You cannot revoke your own access.";
    }

    return null;
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="People"
        title="Team & permissions"
        description="Give reception and staff exactly the access they need. An administrator manages the whole shop without anything ticked."
        actions={
          <Link
            to="/admin/users"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
          >
            Edit profiles
          </Link>
        }
      />

      {error && (
        <Alert
          tone="error"
          title="Could not update access"
          details={error.fieldErrors}
          className="mt-6"
        >
          {error.message}
        </Alert>
      )}

      {notice && (
        <Alert tone="success" title="Saved" className="mt-6">
          {notice}
        </Alert>
      )}

      {!staff ? (
        <AdminLoading label="Loading team access..." />
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
          <AdminPanel>
            <div className="flex items-center gap-3">
              <ShieldCheck className="shrink-0 text-[#d6a85f]" />

              <div>
                <p className="font-semibold text-white">Add a team member</p>
                <p className="mt-1 text-xs text-white/45">
                  Select an existing account, then assign their work access.
                </p>
              </div>
            </div>

            <form onSubmit={create} className="mt-6 space-y-4">
              <div>
                <label className={LABEL_CLASS} htmlFor="new-member">
                  Account
                </label>

                <select
                  id="new-member"
                  required
                  value={draft.user}
                  onChange={(event) =>
                    setDraft({ ...draft, user: event.target.value })
                  }
                  className={`${SEARCH} mt-2`}
                >
                  <option value="">Choose an account</option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name || customer.username} —{" "}
                      {customer.email}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-[11px] leading-5 text-white/35">
                  Only customers without console access are listed. To
                  change someone who is already on the team, edit them
                  below.
                </p>
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="new-role">
                  Role
                </label>

                <select
                  id="new-role"
                  value={draft.role}
                  onChange={(event) =>
                    setDraft({ ...draft, role: event.target.value })
                  }
                  className={`${SEARCH} mt-2`}
                >
                  {ASSIGNABLE_ROLES.filter((role) => role.value !== "customer").map(
                    (role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {draft.role !== "admin" ? (
                <fieldset>
                  <legend className={LABEL_CLASS}>Capabilities</legend>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {CAPABILITIES.map((capability) => (
                      <label
                        key={capability.value}
                        className="flex cursor-pointer items-start gap-2 rounded-lg bg-white/[0.03] p-2.5 text-xs text-white/70"
                      >
                        <input
                          type="checkbox"
                          checked={draft.permissions.includes(
                            capability.value
                          )}
                          onChange={() =>
                            toggleDraftPermission(capability.value)
                          }
                          className="mt-0.5 accent-[#d6a85f]"
                        />
                        {capability.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <p className="flex items-start gap-2 rounded-xl border border-[#d6a85f]/25 bg-[#d6a85f]/10 p-3 text-[11px] leading-5 text-white/60">
                  <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#d6a85f]" />
                  An administrator manages every account, service,
                  payment and booking. Nothing needs ticking.
                </p>
              )}

              <AdminButton
                type="submit"
                tone="primary"
                icon={UserPlus}
                disabled={saving}
              >
                {saving ? "Granting..." : "Grant access"}
              </AdminButton>
            </form>
          </AdminPanel>

          <AdminPanel>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#d6a85f]">
              Active team
            </p>

            <div className="mt-4 space-y-3">
              {staff.map((member) => {
                const editing = editingId === member.id;
                const locked = lockReason(member);
                const displayName = member.full_name || member.username;

                return (
                  <div
                    key={member.id}
                    className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {displayName}
                        </p>

                        <p className="mt-1 truncate text-xs text-white/40">
                          {member.email} · {staffRoleLabel(member.role)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleActive(member)}
                          disabled={Boolean(locked)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                            member.is_active
                              ? "bg-[#d6a85f]/15 text-[#d6a85f]"
                              : "bg-white/10 text-white/45"
                          }`}
                        >
                          {member.is_active ? "Active" : "Disabled"}
                        </button>

                        <AdminButton
                          icon={editing ? X : Pencil}
                          onClick={() =>
                            editing ? cancelEdit() : startEdit(member)
                          }
                        >
                          {editing ? "Cancel" : "Edit"}
                        </AdminButton>
                      </div>
                    </div>

                    {locked && (
                      <p className="mt-3 text-[11px] text-white/35">{locked}</p>
                    )}

                    {!editing && (
                      <p className="mt-3 text-xs leading-5 text-white/45">
                        {member.role === "admin"
                          ? "All capabilities"
                          : member.permissions.join(" · ") ||
                            "No explicit capabilities"}
                      </p>
                    )}

                    {editing && edit && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveMember(member);
                        }}
                        className="mt-4 space-y-4 border-t border-white/10 pt-4"
                      >
                        <div>
                          <label className={LABEL_CLASS} htmlFor={`role-${member.id}`}>
                            Role
                          </label>

                          <select
                            id={`role-${member.id}`}
                            value={edit.role}
                            onChange={(event) =>
                              setEdit({ ...edit, role: event.target.value })
                            }
                            className={`${SEARCH} mt-2`}
                          >
                            {ASSIGNABLE_ROLES.filter(
                              (role) => role.value !== "customer"
                            ).map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {edit.role !== "admin" && (
                          <fieldset>
                            <legend className={LABEL_CLASS}>
                              Capabilities
                            </legend>

                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {CAPABILITIES.map((capability) => (
                                <label
                                  key={capability.value}
                                  className="flex cursor-pointer items-start gap-2 rounded-lg bg-white/[0.03] p-2.5 text-xs text-white/70"
                                >
                                  <input
                                    type="checkbox"
                                    checked={edit.permissions.includes(
                                      capability.value
                                    )}
                                    onChange={() =>
                                      setEdit({
                                        ...edit,
                                        permissions: edit.permissions.includes(
                                          capability.value
                                        )
                                          ? edit.permissions.filter(
                                              (item) => item !== capability.value
                                            )
                                          : [...edit.permissions, capability.value],
                                      })
                                    }
                                    className="mt-0.5 accent-[#d6a85f]"
                                  />
                                  {capability.label}
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <AdminButton
                            type="submit"
                            tone="primary"
                            icon={Check}
                            disabled={saving}
                          >
                            {saving ? "Saving..." : "Save access"}
                          </AdminButton>

                          <AdminButton onClick={cancelEdit} disabled={saving}>
                            Cancel
                          </AdminButton>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}

              {staff.length === 0 && (
                <p className="py-8 text-center text-sm text-white/40">
                  No team members added yet.
                </p>
              )}
            </div>
          </AdminPanel>
        </div>
      )}
    </div>
  );
}
