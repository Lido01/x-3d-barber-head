import { useState } from "react";
import {
  Check,
  Copy,
  Mail,
  MoveHorizontal,
  Pencil,
  Phone,
  RefreshCw,
  Trash2,
  UserPlus,
} from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminChip,
  AdminConfirmButton,
  AdminEmpty,
  AdminField,
  AdminInput,
  AdminLoading,
  AdminPageHeader,
  AdminSearch,
  AdminSheet,
  AdminStatus,
  AdminSwitch,
  AdminTable,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeadCell,
  AdminTableHint,
  AdminTableRow,
} from "../../components/admin/AdminUi";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { EMPTY_LIST, invalidateQuery, useQuery } from "../../hooks/useQuery";
import { useAdminAuth } from "../../context/AdminAuthContext";
import {
  createCustomer,
  deleteCustomer,
  listRegisteredCustomers,
  updateCustomer,
} from "../../services/authApi";
import { hasCapability } from "../../utils/staffRole";
import { toArray } from "../../utils/toArray";
import { formatDate } from "../../utils/format";

/**
 * Customer care — the people who have an account.
 *
 * Search runs on the server. The backend already supports `q`, so typing
 * filters the database instead of downloading every account and
 * filtering in the browser - and the cache key includes the term, so
 * backing out to a previous search shows its results immediately.
 *
 * Three capabilities, deliberately not one:
 *
 *   customers.view     read the directory
 *   customers.manage   add a customer, correct their details, or sign
 *                      them out
 *   customers.delete   remove the account entirely
 *
 * Correcting a phone number and destroying someone's history are not
 * the same amount of trust, so a shop can hand out the first without the
 * second. Delete also lives behind its own confirmation, and the
 * backend refuses an account that has reviews attached.
 *
 * This screen deliberately cannot make staff or change a role. It needs
 * only `customers.manage`, which a receptionist may hold - so if it
 * could grant console access, that one capability would quietly mean
 * "create staff" and the team screen's role gate would be decorative.
 * Staff are managed on the user and team screens.
 *
 * ## A table, because it is a directory
 *
 * A directory is looked things up in, and looking things up needs
 * columns: the name, the handle, when they joined, how to reach them. One
 * card per person showed the name and buried the rest, so answering "when
 * did this person sign up" meant opening each one in turn.
 *
 * The username is the column that sticks to the left edge. It is the
 * stable identifier - the name is editable, the handle is not - and it is
 * what every action on this screen is keyed by.
 *
 * Email and phone are their own columns rather than two stacked link
 * tiles, because on a phone the table scrolls sideways to reach them and
 * a tap target that is 200px wide is much easier to hit than one squeezed
 * into half a card.
 */

const BLANK = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  password: "",
};

export default function AdminCustomers() {
  const { account } = useAdminAuth();

  const [query, setQuery] = useState("");

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK);

  const [editing, setEditing] = useState(null);
  const [edit, setEdit] = useState(null);

  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [issued, setIssued] = useState(null);

  const canManage = hasCapability(account, "customers.manage");
  const canDelete = hasCapability(account, "customers.delete");

  // The field stays instant; only the request waits for a pause in typing.
  const search = useDebouncedValue(query, 300);

  const {
    data,
    loading,
    error,
    isFetching: refreshing,
    refetch: load,
  } = useQuery(
    "/accounts/customers/",
    (signal) => listRegisteredCustomers({ query: search, signal }),
    {
      params: { q: search },
      scope: "staff",
      staleMs: 60 * 1000,
      select: toArray,
    }
  );

  const customers = data || EMPTY_LIST;

  /** A change here is also visible on the user and team screens. */
  const refreshAccounts = () => {
    invalidateQuery("accounts/customers");
    invalidateQuery("accounts/users");
  };

  const openAdd = () => {
    setDraft(BLANK);
    setActionError(null);
    setAdding(true);
  };

  const submitCreate = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setActionError(null);

    try {
      const created = await createCustomer(draft);

      refreshAccounts();
      setNotice(`${created.username} can now sign in.`);
      setDraft(BLANK);
      setAdding(false);

      // Hold the account so the one-time password survives into the
      // sheet that shows it.
      setIssued(created);
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (event) => {
    event.preventDefault();

    if (saving || !editing) {
      return;
    }

    setSaving(true);
    setActionError(null);

    try {
      await updateCustomer(editing.id, {
        email: edit.email,
        first_name: edit.first_name,
        last_name: edit.last_name,
        phone: edit.phone,
        is_active: edit.is_active,
      });

      refreshAccounts();
      setEditing(null);
      setNotice(`Saved changes to ${editing.username}.`);
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Enable or disable.
   *
   * Disabling is the ordinary answer to "this person must not sign in
   * again" and keeps their reviews attached. It is behind a native
   * confirm because on a phone this button is often under a thumb.
   */
  const toggleActive = async (customer) => {
    const nextActive = !customer.is_active;

    if (
      !nextActive &&
      !window.confirm(
        `Disable ${customer.username}? They will be signed out and cannot sign in or leave a review until this is undone. Their history is kept.`
      )
    ) {
      return;
    }

    setBusyId(customer.id);
    setActionError(null);

    try {
      await updateCustomer(customer.id, { is_active: nextActive });

      refreshAccounts();
      setNotice(
        `${customer.username} is now ${nextActive ? "active" : "disabled"}.`,
      );
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (customer) => {
    setBusyId(customer.id);
    setActionError(null);

    try {
      await deleteCustomer(customer.id);

      refreshAccounts();
      setNotice(`Deleted ${customer.username}.`);
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const fieldError = (name) => actionError?.fieldErrors?.[name];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Staff · Customer care"
        title="Customers"
        description={
          customers.length === 1
            ? "1 registered account · tap email or phone to contact."
            : `${customers.length} registered accounts · tap email or phone to contact.`
        }
        actions={
          <>
            <AdminButton icon={RefreshCw} onClick={load} loading={refreshing}>
              Refresh
            </AdminButton>

            {canManage && (
              <AdminButton tone="primary" icon={UserPlus} onClick={openAdd}>
                Add customer
              </AdminButton>
            )}
          </>
        }
      />

      {actionError && !adding && !editing && (
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

      <AdminSearch
        value={query}
        onChange={setQuery}
        placeholder="Search name, email or phone"
      />

      {loading && <AdminLoading label="Loading registered customers..." />}

      {!loading && error && (
        <Alert
          tone="error"
          title="Could not load customers"
          details={error.fieldErrors}
          onRetry={load}
        >
          {error.message}
        </Alert>
      )}

      {!loading && !error && customers.length === 0 && (
        <AdminEmpty
          title={query ? "No matching customers" : "No registered customers"}
          body={
            query
              ? `No customer matches “${query}”.`
              : "New account registrations will appear here."
          }
          onRetry={load}
          action={
            canManage ? (
              <AdminButton tone="primary" icon={UserPlus} onClick={openAdd}>
                Add the first one
              </AdminButton>
            ) : null
          }
        />
      )}

      {!loading && !error && customers.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-console-muted">
              Showing {customers.length}{query ? ` matching “${query}”` : ""}
            </p>

            <p className="hidden items-center gap-1.5 text-[11px] text-console-faint sm:flex">
              <MoveHorizontal size={12} />
              Scroll the table sideways to reach every column
            </p>
          </div>

          <AdminTable
            label="Customers"
            caption="Registered customer accounts, with their contact details and when they joined."
            minWidth="min-w-[62rem]"
          >
            <AdminTableHead>
              <tr>
                <AdminTableHeadCell sticky width="10rem">
                  Account
                </AdminTableHeadCell>
                <AdminTableHeadCell width="14rem">Name</AdminTableHeadCell>
                <AdminTableHeadCell width="10rem">Joined</AdminTableHeadCell>
                <AdminTableHeadCell width="16rem">Email</AdminTableHeadCell>
                <AdminTableHeadCell width="12rem">Phone</AdminTableHeadCell>
                {canManage && (
                  <AdminTableHeadCell width="17rem">
                    Actions
                  </AdminTableHeadCell>
                )}
              </tr>
            </AdminTableHead>

            <tbody>
              {customers.map((customer) => {
                const name = customer.full_name || customer.username;
                const busy = busyId === customer.id;

                return (
                  <AdminTableRow key={customer.id}>
                    <AdminTableCell sticky>
                      <span className="font-mono text-sm text-console-ink">
                        @{customer.username}
                      </span>

                      <div className="mt-2">
                        {!customer.is_active ? (
                          <AdminStatus status="disabled" />
                        ) : (
                          <AdminChip tone="good">Active</AdminChip>
                        )}
                      </div>
                    </AdminTableCell>

                    <AdminTableCell>
                      <span className="block break-words font-medium text-console-ink">
                        {name}
                      </span>
                    </AdminTableCell>

                    <AdminTableCell>
                      <span className="block whitespace-nowrap text-xs tabular-nums text-console-muted">
                        {formatDate(customer.created_at)}
                      </span>
                    </AdminTableCell>

                    <AdminTableCell>
                      {customer.email ? (
                        <a
                          href={`mailto:${customer.email}`}
                          className="inline-flex items-center gap-1.5 break-all text-console-body transition hover:text-console-accent"
                        >
                          <Mail size={13} className="shrink-0" />
                          {customer.email}
                        </a>
                      ) : (
                        <span className="text-console-faint">—</span>
                      )}
                    </AdminTableCell>

                    <AdminTableCell>
                      {customer.phone ? (
                        <a
                          href={`tel:${customer.phone}`}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums text-console-body transition hover:text-console-accent"
                        >
                          <Phone size={13} className="shrink-0" />
                          {customer.phone}
                        </a>
                      ) : (
                        <span className="text-console-faint">—</span>
                      )}
                    </AdminTableCell>

                    {canManage && (
                      <AdminTableCell>
                        <div className="flex flex-wrap gap-2">
                          <AdminButton
                            icon={Pencil}
                            loading={busy}
                            onClick={() => {
                              setEditing(customer);
                              setEdit({
                                email: customer.email || "",
                                first_name: customer.first_name || "",
                                last_name: customer.last_name || "",
                                phone: customer.phone || "",
                                is_active: customer.is_active,
                              });
                              setActionError(null);
                            }}
                          >
                            Edit
                          </AdminButton>

                          <AdminButton
                            tone={customer.is_active ? "danger" : "neutral"}
                            loading={busy}
                            onClick={() => toggleActive(customer)}
                          >
                            {customer.is_active ? "Disable" : "Enable"}
                          </AdminButton>

                          {canDelete && (
                            <AdminConfirmButton
                              icon={Trash2}
                              loading={busy}
                              message={`Permanently delete ${customer.username}? This cannot be undone. If they have left reviews the server will refuse and you should disable them instead.`}
                              onConfirm={() => handleDelete(customer)}
                            >
                              Delete
                            </AdminConfirmButton>
                          )}
                        </div>
                      </AdminTableCell>
                    )}
                  </AdminTableRow>
                );
              })}
            </tbody>
          </AdminTable>

          <AdminTableHint>
            Swipe the table sideways for the rest of each row.
          </AdminTableHint>
        </>
      )}

      {/* --- Add a customer ----------------------------------------- */}
      <AdminSheet
        open={adding}
        onClose={() => {
          setAdding(false);
          setDraft(BLANK);
          setActionError(null);
        }}
        title="Add a customer"
        description="A walk-in who wants an account so they can leave a review. This cannot create staff."
        footer={
          <>
            <AdminButton
              onClick={() => {
                setAdding(false);
                setDraft(BLANK);
                setActionError(null);
              }}
              disabled={saving}
            >
              Cancel
            </AdminButton>

            <AdminButton
              type="submit"
              form="customer-form"
              tone="primary"
              icon={UserPlus}
              loading={saving}
            >
              Add customer
            </AdminButton>
          </>
        }
      >
        <form id="customer-form" onSubmit={submitCreate} className="space-y-4">
          {actionError && (
            <Alert
              tone="error"
              title="Could not add the customer"
              details={actionError.fieldErrors}
            >
              {actionError.message}
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField
              label="Username"
              required
              error={fieldError("username")}
              hint="What they type to sign in."
            >
              <AdminInput
                value={draft.username}
                autoCapitalize="none"
                autoComplete="off"
                invalid={Boolean(fieldError("username"))}
                onChange={(event) =>
                  setDraft({ ...draft, username: event.target.value })
                }
              />
            </AdminField>

            <AdminField label="Email" required error={fieldError("email")}>
              <AdminInput
                type="email"
                value={draft.email}
                invalid={Boolean(fieldError("email"))}
                onChange={(event) =>
                  setDraft({ ...draft, email: event.target.value })
                }
              />
            </AdminField>

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

            <AdminField label="Phone" error={fieldError("phone")}>
              <AdminInput
                type="tel"
                value={draft.phone}
                onChange={(event) =>
                  setDraft({ ...draft, phone: event.target.value })
                }
              />
            </AdminField>

            <AdminField
              label="Password"
              error={fieldError("password")}
              hint="Leave blank and one is generated. Shown once."
            >
              <AdminInput
                value={draft.password}
                autoComplete="new-password"
                invalid={Boolean(fieldError("password"))}
                onChange={(event) =>
                  setDraft({ ...draft, password: event.target.value })
                }
              />
            </AdminField>
          </div>
        </form>
      </AdminSheet>

      {/* --- Edit a customer ---------------------------------------- */}
      <AdminSheet
        open={Boolean(editing && edit)}
        onClose={() => {
          setEditing(null);
          setActionError(null);
        }}
        title="Edit customer"
        description={editing ? `@${editing.username}` : ""}
        footer={
          <>
            <AdminButton
              onClick={() => {
                setEditing(null);
                setActionError(null);
              }}
              disabled={saving}
            >
              Cancel
            </AdminButton>

            <AdminButton
              type="submit"
              form="edit-customer-form"
              tone="primary"
              loading={saving}
            >
              Save changes
            </AdminButton>
          </>
        }
      >
        {editing && edit && (
          <form
            id="edit-customer-form"
            onSubmit={submitEdit}
            className="space-y-4"
          >
            {actionError && (
              <Alert
                tone="error"
                title="Could not save"
                details={actionError.fieldErrors}
              >
                {actionError.message}
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="First name" error={fieldError("first_name")}>
                <AdminInput
                  value={edit.first_name}
                  onChange={(event) =>
                    setEdit({ ...edit, first_name: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Last name" error={fieldError("last_name")}>
                <AdminInput
                  value={edit.last_name}
                  onChange={(event) =>
                    setEdit({ ...edit, last_name: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Email" error={fieldError("email")}>
                <AdminInput
                  type="email"
                  value={edit.email}
                  invalid={Boolean(fieldError("email"))}
                  onChange={(event) =>
                    setEdit({ ...edit, email: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Phone" error={fieldError("phone")}>
                <AdminInput
                  type="tel"
                  value={edit.phone}
                  onChange={(event) =>
                    setEdit({ ...edit, phone: event.target.value })
                  }
                />
              </AdminField>
            </div>

            <div className="rounded-xl border border-console-line bg-console-sunken p-3.5">
              <AdminSwitch
                checked={edit.is_active}
                onChange={(value) => setEdit({ ...edit, is_active: value })}
                label={edit.is_active ? "Account is active" : "Account is disabled"}
                description={
                  edit.is_active
                    ? "Can sign in and leave a review."
                    : "Cannot sign in. Their history is kept."
                }
              />
            </div>

            <p className="text-[11px] leading-5 text-console-muted">
              The username cannot be changed here — it is the login
              identity, and renaming it out from under the person using it
              breaks the idea of a stable handle.
            </p>
          </form>
        )}
      </AdminSheet>

      {/* --- The generated password, shown once --------------------- */}
      <AdminSheet
        open={Boolean(issued?.temporary_password)}
        onClose={() => setIssued(null)}
        title="Customer added"
        description="This password is shown once and cannot be retrieved again."
        footer={
          <AdminButton tone="primary" block onClick={() => setIssued(null)}>
            Done
          </AdminButton>
        }
      >
        {issued?.temporary_password && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-console-body">
              <Check size={15} className="shrink-0 text-console-good" />
              <span>
                <strong className="font-semibold">{issued.username}</strong>{" "}
                can sign in as a customer.
              </span>
            </div>

            <div className="rounded-xl border border-console-accent/30 bg-console-accent-soft p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-console-accent-strong">
                Temporary password
              </p>

              <p className="mt-2 select-all break-all font-mono text-lg text-console-ink">
                {issued.temporary_password}
              </p>
            </div>

            <AdminButton
              block
              icon={Copy}
              onClick={() => {
                navigator.clipboard?.writeText(issued.temporary_password);
              }}
            >
              Copy to clipboard
            </AdminButton>

            <p className="text-xs leading-6 text-console-muted">
              Hand it over in person. The shop has no outbound mail, so
              there is no reset link waiting in an inbox — if it is lost,
              disable the account and add them again.
            </p>
          </div>
        )}
      </AdminSheet>
    </div>
  );
}
