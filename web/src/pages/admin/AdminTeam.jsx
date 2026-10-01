import { useState } from "react";
import { Check, Pencil, ShieldCheck, UserPlus } from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminCheck,
  AdminChip,
  AdminEmpty,
  AdminField,
  AdminLoading,
  AdminSection,
  AdminSelect,
  AdminSheet,
  AdminStatus,
} from "../../components/admin/AdminUi";
import { invalidateQuery, useQuery } from "../../hooks/useQuery";
import { toArray } from "../../utils/toArray";
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
 * carries the profile and phone, and is where a *new* account is
 * created.
 *
 * A role is not the same thing as a permission. Choosing
 * "Administrator" grants everything implicitly and hides the checkboxes
 * from mattering; the other roles are exactly the boxes ticked, which
 * is why they stay visible and editable rather than being replaced by
 * a preset the owner has to trust.
 *
 * Both forms are sheets. Granting access is a decision with
 * consequences, and doing it in a panel that pushes the team list off a
 * phone screen makes it feel like a quick tap rather than one.
 */

const DEFAULT_DRAFT = {
  user: "",
  role: "reception",
  permissions: ["bookings.view", "bookings.manage", "customers.view"],
};

const STAFF_ROLES = ASSIGNABLE_ROLES.filter((role) => role.value !== "customer");

export default function AdminTeam() {
  const { account: viewer } = useAdminAuth();

  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);

  const [granting, setGranting] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_DRAFT);

  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState(null);

  const {
    data: staff,
    error,
  } = useQuery("/accounts/staff/", listStaffAccess, {
    scope: "staff",
    select: toArray,
  });

  // Same endpoint and same key as the customers screen, so opening this
  // page after that one costs no request. Granting console access is
  // almost always done right after looking someone up there.
  const { data: customers } = useQuery(
    "/accounts/customers/",
    listRegisteredCustomers,
    {
      scope: "staff",
      staleMs: 60 * 1000,
      select: toArray,
    }
  );

  // `staff` is left undefined while loading, which is what the spinner
  // below keys off; the account picker needs a real array to map over.
  const customerRows = customers || [];
  const members = staff || [];

  const toggleDraftPermission = (capability) =>
    setDraft((value) => ({
      ...value,
      permissions: value.permissions.includes(capability)
        ? value.permissions.filter((item) => item !== capability)
        : [...value.permissions, capability],
    }));

  /**
   * A change here alters who may use the console, so the account list is
   * dropped with it - otherwise a freshly promoted colleague would be
   * missing from the picker that is supposed to have just gained them.
   */
  const refreshAccounts = () => {
    invalidateQuery("accounts/staff");
    invalidateQuery("accounts/customers");
    invalidateQuery("accounts/users");
  };

  const closeGrant = () => {
    setGranting(false);
    setDraft(DEFAULT_DRAFT);
    setActionError(null);
  };

  const create = async (event) => {
    event.preventDefault();

    if (!draft.user) {
      setActionError({
        message: "Choose an account to grant access to.",
        fieldErrors: {},
      });

      return;
    }

    setSaving(true);
    setActionError(null);

    try {
      await createStaffAccess({ ...draft, user: Number(draft.user) });

      closeGrant();
      setNotice("Access granted.");
      refreshAccounts();
    } catch (apiError) {
      setActionError(apiError);
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
    setActionError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit(null);
    setActionError(null);
  };

  const saveMember = async (member) => {
    setSaving(true);
    setActionError(null);

    try {
      await updateStaffAccess(member.id, {
        role: edit.role,
        permissions: edit.permissions,
      });

      cancelEdit();
      setNotice(`Updated access for ${member.username}.`);
      refreshAccounts();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (member) => {
    setActionError(null);

    try {
      await updateStaffAccess(member.id, { is_active: !member.is_active });
      refreshAccounts();
    } catch (apiError) {
      setActionError(apiError);
    }
  };

  /**
   * Why a member's controls are unavailable, if they are.
   *
   * The server refuses to let anyone revoke their own access or remove
   * the last administrator, so the button is disabled with the reason
   * attached rather than letting them tap and read a 400.
   */
  const lockReason = (member) => {
    if (member.id === viewer?.id) {
      return "You cannot change your own access.";
    }

    return null;
  };

  return (
    <div className="space-y-5">
      <AdminPageHeaderTeamNotice
        notice={notice}
        onDismiss={() => setNotice(null)}
      />

      {!staff && <AdminLoading label="Loading team access..." />}

      {staff && (
        <>
          {error && (
            <Alert
              tone="error"
              title="Could not load team access"
              details={error.fieldErrors}
            >
              {error.message}
            </Alert>
          )}

          <AdminSection
            title="Active team"
            description="Everyone with console access, and what each of them may do."
            actions={
              <AdminButton
                tone="primary"
                icon={UserPlus}
                onClick={() => {
                  setDraft(DEFAULT_DRAFT);
                  setActionError(null);
                  setGranting(true);
                }}
              >
                Grant access
              </AdminButton>
            }
            bodyClassName="p-4 sm:p-5"
          >
            {members.length === 0 ? (
              <AdminEmpty
                title="No team members yet"
                body="Nobody has console access beyond you. Grant it to someone to let them work the bookings or payments."
                action={
                  <AdminButton
                    tone="primary"
                    icon={UserPlus}
                    onClick={() => {
                      setDraft(DEFAULT_DRAFT);
                      setActionError(null);
                      setGranting(true);
                    }}
                  >
                    Grant the first one
                  </AdminButton>
                }
              />
            ) : (
              <ul className="grid gap-3">
                {members.map((member) => {
                  const locked = lockReason(member);
                  const displayName = member.full_name || member.username;

                  return (
                    <li
                      key={member.id}
                      className=" rounded-xl border border-console-line bg-console-sunken p-3.5 sm:p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-console-ink">
                            {displayName}
                          </p>

                          <p className="mt-0.5 truncate text-xs text-console-muted">
                            {member.email}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <AdminStatus
                            status={member.is_active ? "active" : "disabled"}
                          />
                          <AdminChip tone="info">
                            {staffRoleLabel(member.role)}
                          </AdminChip>

                          <AdminButton
                            size="sm"
                            icon={Pencil}
                            disabled={Boolean(locked)}
                            onClick={() => startEdit(member)}
                          >
                            Edit
                          </AdminButton>
                        </div>
                      </div>

                      {locked && (
                        <p className="mt-2.5 text-[11px] text-console-muted">
                          {locked}
                        </p>
                      )}

                      {member.role === "admin" ? (
                        <p className="mt-2.5 text-[11px] leading-5 text-console-muted">
                          All capabilities — nothing to tick.
                        </p>
                      ) : member.permissions?.length > 0 ? (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {member.permissions.map((permission) => (
                            <AdminChip key={permission}>{permission}</AdminChip>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2.5 text-[11px] leading-5 text-console-bad">
                          No capabilities — this account can sign in but
                          cannot do anything.
                        </p>
                      )}

                      <div className="mt-3.5 flex flex-wrap gap-2 border-t border-console-line pt-3.5">
                        <AdminButton
                          size="sm"
                          tone={member.is_active ? "danger" : "neutral"}
                          disabled={Boolean(locked)}
                          onClick={() => toggleActive(member)}
                        >
                          {member.is_active ? "Disable access" : "Restore access"}
                        </AdminButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminSection>
        </>
      )}

      {/* --- Grant console access to an existing account ------------- */}
      <AdminSheet
        open={granting}
        onClose={closeGrant}
        title="Grant console access"
        description="For an account that already exists. To create a new one, use User management."
        footer={
          <>
            <AdminButton onClick={closeGrant} disabled={saving}>
              Cancel
            </AdminButton>

            <AdminButton
              type="submit"
              form="grant-form"
              tone="primary"
              icon={UserPlus}
              loading={saving}
            >
              Grant access
            </AdminButton>
          </>
        }
      >
        <form id="grant-form" onSubmit={create} className="space-y-5">
          {actionError && (
            <Alert tone="error" title="Could not grant access" details={actionError.fieldErrors}>
              {actionError.message}
            </Alert>
          )}

          <AdminField
            label="Account"
            required
            error={actionError?.fieldErrors?.user}
            hint="Only accounts without console access are listed. To change someone already on the team, edit them below."
          >
            <AdminSelect
              required
              value={draft.user}
              onChange={(event) =>
                setDraft({ ...draft, user: event.target.value })
              }
            >
              <option value="">Choose an account</option>

              {customerRows.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name || customer.username} — {customer.email}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField label="Role" required>
            <AdminSelect
              value={draft.role}
              onChange={(event) =>
                setDraft({ ...draft, role: event.target.value })
              }
            >
              {STAFF_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          {draft.role !== "admin" ? (
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
                    onChange={() => toggleDraftPermission(capability.value)}
                  />
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="flex items-start gap-2 rounded-xl border border-console-accent/30 bg-console-accent-soft p-3 text-[11px] leading-5 text-console-accent-strong">
              <ShieldCheck size={13} className="mt-0.5 shrink-0" />
              An administrator manages every account, service, payment and
              booking — including creating and disabling other
              administrators.
            </p>
          )}
        </form>
      </AdminSheet>

      {/* --- Edit one member's role and capabilities ---------------- */}
      <AdminSheet
        open={Boolean(editingId && edit)}
        onClose={cancelEdit}
        title="Edit access"
        description="Role and capabilities for this team member."
        footer={
          <>
            <AdminButton onClick={cancelEdit} disabled={saving}>
              Cancel
            </AdminButton>

            <AdminButton
              type="submit"
              form="edit-access-form"
              tone="primary"
              icon={Check}
              loading={saving}
              onClick={() => {
                const member = members.find((row) => row.id === editingId);

                if (member) {
                  saveMember(member);
                }
              }}
            >
              Save access
            </AdminButton>
          </>
        }
      >
        {edit && (
          <form id="edit-access-form" onSubmit={saveMember} className="space-y-5">
            {actionError && (
              <Alert tone="error" title="Could not save" details={actionError.fieldErrors}>
                {actionError.message}
              </Alert>
            )}

            <AdminField label="Role" required>
              <AdminSelect
                value={edit.role}
                onChange={(event) =>
                  setEdit({ ...edit, role: event.target.value })
                }
              >
                {STAFF_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>

            {edit.role !== "admin" && (
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
                      checked={edit.permissions.includes(capability.value)}
                      onChange={(checked) =>
                        setEdit({
                          ...edit,
                          permissions: checked
                            ? [...edit.permissions, capability.value]
                            : edit.permissions.filter(
                                (item) => item !== capability.value
                              ),
                        })
                      }
                    />
                  ))}
                </div>
              </fieldset>
            )}

            {edit.role === "admin" && (
              <p className="flex items-start gap-2 rounded-xl border border-console-accent/30 bg-console-accent-soft p-3 text-[11px] leading-5 text-console-accent-strong">
                <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                An administrator holds every capability. Anything already
                ticked stays stored and becomes what this account falls
                back to if the role is changed later.
              </p>
            )}

            <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
          </form>
        )}
      </AdminSheet>
    </div>
  );
}

/**
 * The page header, split out only so the success notice can sit directly
 * under it without either of them becoming a wall of markup.
 */
function AdminPageHeaderTeamNotice({ notice, onDismiss }) {
  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-console-accent">
            People
          </p>

          <h1 className="mt-1.5 font-serif text-3xl leading-tight text-console-ink sm:text-4xl">
            Team access
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-console-muted">
            Who works here and what each of them may do. An administrator
            manages the whole shop without anything ticked.
          </p>
        </div>
      </div>

      {notice && (
        <Alert tone="success" title={notice}>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </Alert>
      )}
    </header>
  );
}
