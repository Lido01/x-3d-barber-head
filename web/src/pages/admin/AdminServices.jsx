import { useState } from "react";
import { Pencil, Plus, RefreshCw, Scissors, Trash2 } from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminChip,
  AdminConfirmButton,
  AdminEmpty,
  AdminField,
  AdminFileInput,
  AdminInput,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  AdminSheet,
  AdminTextarea,
} from "../../components/admin/AdminUi";
import { mediaUrl } from "../../services/api";
import { toArray } from "../../utils/toArray";
import {
  createHaircutStyle,
  createService,
  deleteHaircutStyle,
  deleteService,
  listAllServices,
  updateService,
} from "../../services/servicesApi";
import { invalidateQuery, useQuery } from "../../hooks/useQuery";
import { formatDuration, formatPrice } from "../../utils/format";

/**
 * Services and their haircut styles.
 *
 * The add/edit form lives in a sheet rather than expanding inline. An
 * inline form on a phone pushes the row you were reading off the top of
 * the screen, and on a desktop it moves the page under the cursor; a
 * sheet is a fixed panel either way, so what you were looking at stays
 * where you left it.
 *
 * The same shape applies to adding a style, which used to be a
 * three-field form expanding inside each service card — the widest,
 * most cramped version of the same problem, since a card is already
 * holding an image, a price and a list of chips.
 *
 * Both file inputs were the one place a native file picker reliably
 * overflowed a 360px screen: it refuses to shrink below its intrinsic
 * width, so the wrapper has to be `min-w-0` all the way down.
 */

const EMPTY = {
  name: "",
  description: "",
  price: "",
  duration: "",
};

export default function AdminServices() {
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [editing, setEditing] = useState(null); // null | "new" | service
  const [form, setForm] = useState(EMPTY);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // style creation, for one service at a time
  const [styleFor, setStyleFor] = useState(null);
  const [styleName, setStyleName] = useState("");
  const [styleImage, setStyleImage] = useState(null);
  const [styleSaving, setStyleSaving] = useState(false);

  // Scope "staff", not "public": the same endpoint returns every service
  // to staff and only the active ones to the public, and the two answers
  // must never be served to each other.
  const {
    data: services,
    loading,
    error,
    isFetching: refreshing,
    refetch: load,
  } = useQuery("/services/", listAllServices, {
    scope: "staff",
    select: toArray,
  });

  const rows = services || [];

  /**
   * A write here changes what the storefront shows as well as this table,
   * so both cached views are dropped. The list refetches in the
   * background: the rows already on screen stay put instead of the table
   * blanking behind a spinner.
   */
  const refreshBothViews = () => invalidateQuery("services");

  const closeServiceSheet = () => {
    setEditing(null);
    setImageFile(null);
    setActionError(null);
  };

  const openNew = () => {
    setEditing("new");
    setForm(EMPTY);
    setImageFile(null);
    setActionError(null);
  };

  const openEdit = (service) => {
    setEditing(service);
    setForm({
      name: service.name,
      description: service.description || "",
      price: service.price,
      duration: service.duration,
    });
    setImageFile(null);
    setActionError(null);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setActionError(null);

    if (!form.name.trim()) {
      setActionError({
        message: "A service name is required.",
        fieldErrors: {},
      });
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.price,
      duration: form.duration,
      image: imageFile || undefined,
    };

    try {
      if (editing === "new") {
        await createService(payload);
      } else {
        await updateService(editing.id, payload);
      }

      closeServiceSheet();
      refreshBothViews();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service) => {
    setBusyId(service.id);
    setActionError(null);

    try {
      await deleteService(service.id);
      refreshBothViews();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const handleAddStyle = async (serviceId, event) => {
    event.preventDefault();

    if (!styleName.trim() || styleSaving) {
      return;
    }

    setActionError(null);
    setStyleSaving(true);

    try {
      await createHaircutStyle(serviceId, {
        name: styleName.trim(),
        image: styleImage || undefined,
      });
      setStyleName("");
      setStyleImage(null);
      setStyleFor(null);
      refreshBothViews();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setStyleSaving(false);
    }
  };

  const handleDeleteStyle = async (serviceId, style) => {
    setBusyId(serviceId);
    setActionError(null);

    try {
      await deleteHaircutStyle(serviceId, style.id);
      refreshBothViews();
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
        eyebrow="Staff · Management"
        title="Services"
        description="Pricing, durations and the haircut styles shown on each service."
        actions={
          <>
            <AdminButton onClick={load} icon={RefreshCw} loading={refreshing}>
              Refresh
            </AdminButton>

            <AdminButton
              tone="primary"
              icon={Plus}
              onClick={editing ? closeServiceSheet : openNew}
            >
              {editing ? "Cancel" : "Add service"}
            </AdminButton>
          </>
        }
      />

      {actionError && !editing && !styleFor && (
        <Alert tone="error" title="Action failed" details={actionError.fieldErrors}>
          {actionError.message}
        </Alert>
      )}

      {loading && <AdminLoading label="Loading services..." />}

      {!loading && error && (
        <Alert
          tone="error"
          title="Could not load services"
          details={error.fieldErrors}
          onRetry={load}
        >
          {error.message}
        </Alert>
      )}

      {!loading && !error && rows.length === 0 && (
        <AdminEmpty
          title="No services yet"
          body="Add the first service to start taking bookings against it."
          onRetry={load}
          action={
            <AdminButton tone="primary" icon={Plus} onClick={openNew}>
              Add a service
            </AdminButton>
          }
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <ul className="grid gap-3">
          {rows.map((service) => {
            const styles = Array.isArray(service.styles) ? service.styles : [];
            const busy = busyId === service.id;

            return (
              <li key={service.id}>
                <AdminPanel>
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      {service.image ? (
                        <img
                          src={mediaUrl(service.image)}
                          alt=""
                          loading="lazy"
                          className="h-14 w-14 shrink-0 rounded-xl object-cover sm:h-16 sm:w-16"
                        />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-console-sunken sm:h-16 sm:w-16">
                          <Scissors size={20} className="text-console-faint" />
                        </span>
                      )}

                      <div className="min-w-0">
                        <h2 className="break-words font-serif text-lg leading-tight text-console-ink sm:text-xl">
                          {service.name}
                        </h2>

                        <p className="mt-1 text-xs text-console-muted">
                          {formatPrice(service.price)} ·{" "}
                          {formatDuration(service.duration)}
                        </p>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {!service.is_active && (
                            <AdminChip tone="bad">Hidden</AdminChip>
                          )}

                          {styles.length > 0 && (
                            <AdminChip>
                              {styles.length}{" "}
                              {styles.length === 1 ? "style" : "styles"}
                            </AdminChip>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <AdminButton
                        icon={Pencil}
                        loading={busy}
                        onClick={() => openEdit(service)}
                      >
                        Edit
                      </AdminButton>

                      <AdminConfirmButton
                        icon={Trash2}
                        loading={busy}
                        message={`Delete service "${service.name}"? This also removes its haircut styles, and it disappears from the storefront.`}
                        onConfirm={() => handleDelete(service)}
                      >
                        Delete
                      </AdminConfirmButton>
                    </div>
                  </div>

                  {styles.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-2 border-t border-console-line pt-4">
                      {styles.map((style) => (
                        <li key={style.id}>
                          <span className="inline-flex min-h-10 items-center gap-1 rounded-full border border-console-line bg-console-sunken pl-3 pr-1 text-xs text-console-body">
                            {style.name}

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteStyle(service.id, style)
                              }
                              disabled={busy}
                              aria-label={`Delete style ${style.name}`}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-console-faint transition hover:bg-console-bad-soft hover:text-console-bad disabled:opacity-50"
                            >
                              <Trash2 size={13} />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 border-t border-console-line pt-4">
                    <AdminButton
                      size="sm"
                      icon={Plus}
                      onClick={() => {
                        setStyleFor(service);
                        setStyleName("");
                        setStyleImage(null);
                        setActionError(null);
                      }}
                    >
                      Add haircut style
                    </AdminButton>
                  </div>
                </AdminPanel>
              </li>
            );
          })}
        </ul>
      )}

      {/* --- Add or edit a service ----------------------------------- */}
      <AdminSheet
        open={Boolean(editing)}
        onClose={closeServiceSheet}
        title={editing === "new" ? "Add a service" : "Edit service"}
        description={
          editing === "new"
            ? "What customers see on the booking form."
            : `Editing #${editing?.id}.`
        }
        footer={
          <>
            <AdminButton onClick={closeServiceSheet} disabled={saving}>
              Cancel
            </AdminButton>

            <AdminButton
              type="submit"
              form="service-form"
              tone="primary"
              loading={saving}
            >
              {saving ? "Saving..." : "Save service"}
            </AdminButton>
          </>
        }
      >
        {editing && (
          <form id="service-form" onSubmit={handleSave} noValidate className="space-y-4">
            {actionError && (
              <Alert tone="error" title="Could not save" details={actionError.fieldErrors}>
                {actionError.message}
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Name" required error={fieldError("name")}>
                <AdminInput
                  value={form.name}
                  invalid={Boolean(fieldError("name"))}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, name: event.target.value }))
                  }
                />
              </AdminField>

              <AdminField
                label="Price (ETB)"
                error={fieldError("price")}
              >
                <AdminInput
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.price}
                  invalid={Boolean(fieldError("price"))}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, price: event.target.value }))
                  }
                />
              </AdminField>

              <AdminField
                label="Duration (minutes)"
                error={fieldError("duration")}
                hint="Sets the slot length on the booking form."
              >
                <AdminInput
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={form.duration}
                  invalid={Boolean(fieldError("duration"))}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, duration: event.target.value }))
                  }
                />
              </AdminField>

              <AdminField
                label={editing === "new" ? "Image" : "Replace image"}
                error={fieldError("image")}
                hint="JPG, PNG or WebP, up to 5MB."
              >
                <AdminFileInput
                  id="service-image"
                  accept="image/jpeg,image/png,image/webp"
                  invalid={Boolean(fieldError("image"))}
                  onChange={(event) =>
                    setImageFile(event.target.files[0] || null)
                  }
                />
              </AdminField>
            </div>

            <AdminField label="Description" error={fieldError("description")}>
              <AdminTextarea
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm((f) => ({ ...f, description: event.target.value }))
                }
              />
            </AdminField>

            {editing !== "new" && !editing.is_active && (
              <p className="text-[11px] leading-5 text-console-muted">
                This service is hidden from the storefront. Make it active
                again from the list to bring it back.
              </p>
            )}
          </form>
        )}
      </AdminSheet>

      {/* --- Add a haircut style to one service ---------------------- */}
      <AdminSheet
        open={Boolean(styleFor)}
        onClose={() => {
          setStyleFor(null);
          setStyleName("");
          setStyleImage(null);
          setActionError(null);
        }}
        title="Add a haircut style"
        description={styleFor ? `A variation of "${styleFor.name}".` : ""}
        footer={
          <>
            <AdminButton
              onClick={() => {
                setStyleFor(null);
                setStyleName("");
                setStyleImage(null);
              }}
              disabled={styleSaving}
            >
              Cancel
            </AdminButton>

            <AdminButton
              type="submit"
              form="style-form"
              tone="primary"
              loading={styleSaving}
            >
              {styleSaving ? "Adding..." : "Add style"}
            </AdminButton>
          </>
        }
      >
        {styleFor && (
          <form
            id="style-form"
            onSubmit={(event) => handleAddStyle(styleFor.id, event)}
            className="space-y-4"
          >
            {actionError && (
              <Alert tone="error" title="Could not add the style" details={actionError.fieldErrors}>
                {actionError.message}
              </Alert>
            )}

            <AdminField
              label="Style name"
              required
              error={fieldError("name")}
              hint="What customers pick when booking this service."
            >
              <AdminInput
                value={styleName}
                placeholder="e.g. High Fade"
                invalid={Boolean(fieldError("name"))}
                onChange={(event) => setStyleName(event.target.value)}
              />
            </AdminField>

            <AdminField
              label="Image (optional)"
              error={fieldError("image")}
            >
              <AdminFileInput
                id="style-image"
                accept="image/jpeg,image/png,image/webp"
                invalid={Boolean(fieldError("image"))}
                onChange={(event) =>
                  setStyleImage(event.target.files[0] || null)
                }
              />
            </AdminField>
          </form>
        )}
      </AdminSheet>
    </div>
  );
}
