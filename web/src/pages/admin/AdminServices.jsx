import { useCallback, useEffect, useState } from "react";
import {
  Pencil,
  Plus,
  RefreshCw,
  Scissors,
  Trash2,
  X,
} from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from "../../components/admin/AdminUi";
import { mediaUrl } from "../../services/api";
import {
  createHaircutStyle,
  createService,
  deleteHaircutStyle,
  deleteService,
  listAllServices,
  updateService,
} from "../../services/servicesApi";
import { formatDuration, formatPrice } from "../../utils/format";

/**
 * Services and their haircut styles.
 *
 * The create/edit form and the per-service style form are the two places
 * this screen used to be awkward on a phone: a file input and a submit
 * button side by side in a flex row overflowed at 360px. Both are now
 * single-column with full-width controls, and a file input is given an
 * explicit `w-full min-w-0` because a native file picker refuses to
 * shrink below its intrinsic width otherwise.
 */

const INPUT =
  "w-full min-w-0 rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50 sm:text-sm";

const LABEL =
  "block text-[10px] uppercase tracking-[0.25em] text-white/35";

const FILE_INPUT =
  "w-full min-w-0 text-xs text-white/60 file:mr-3 file:rounded-full file:border-0 file:bg-[#d6a85f] file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-black";

const EMPTY = {
  name: "",
  description: "",
  price: "",
  duration: "",
};

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState(null); // null | "new" | service
  const [form, setForm] = useState(EMPTY);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // style creation inside a service row
  const [styleServiceId, setStyleServiceId] = useState(null);
  const [styleName, setStyleName] = useState("");
  const [styleImage, setStyleImage] = useState(null);
  const [styleSaving, setStyleSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setRefreshing(true);

    return listAllServices()
      .then((data) => {
        setServices(Array.isArray(data) ? data : data?.results || []);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((apiError) => {
        setError(apiError);
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

      setEditing(null);
      load();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service) => {
    if (
      !window.confirm(
        `Delete service "${service.name}"? This also removes its haircut styles.`
      )
    ) {
      return;
    }

    setBusyId(service.id);
    setActionError(null);

    try {
      await deleteService(service.id);
      setServices((rows) => rows.filter((row) => row.id !== service.id));
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
      setStyleServiceId(null);
      load();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setStyleSaving(false);
    }
  };

  const handleDeleteStyle = async (serviceId, styleId) => {
    if (!window.confirm("Delete this haircut style?")) {
      return;
    }

    setActionError(null);

    try {
      await deleteHaircutStyle(serviceId, styleId);
      load();
    } catch (apiError) {
      setActionError(apiError);
    }
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Staff · Management"
        title="Services"
        description="Pricing, durations and haircut styles on the site."
        actions={
          <>
            <AdminButton
              onClick={load}
              icon={RefreshCw}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </AdminButton>

            <AdminButton
              tone={editing === null ? "primary" : "neutral"}
              icon={editing === null ? Plus : X}
              onClick={() =>
                editing === null ? openNew() : setEditing(null)
              }
            >
              {editing === null ? "Add service" : "Cancel"}
            </AdminButton>
          </>
        }
      />

      {actionError && (
        <Alert
          tone="error"
          title="Action failed"
          details={actionError.fieldErrors}
          className="mt-5"
        >
          {actionError.message}
        </Alert>
      )}

      {editing && (
        <form
          onSubmit={handleSave}
          noValidate
          className="mt-6 rounded-2xl border border-white/10 bg-[#111] p-4 sm:p-6"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
            {editing === "new" ? "Add a service" : `Edit #${editing.id}`}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className={LABEL}>Name</label>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((f) => ({ ...f, name: event.target.value }))
                }
                className={`${INPUT} mt-2`}
              />
            </div>

            <div className="min-w-0">
              <label className={LABEL}>Price (ETB)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.price}
                onChange={(event) =>
                  setForm((f) => ({ ...f, price: event.target.value }))
                }
                className={`${INPUT} mt-2`}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className={LABEL}>Duration (minutes)</label>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={form.duration}
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    duration: event.target.value,
                  }))
                }
                className={`${INPUT} mt-2`}
              />
            </div>

            <div className="min-w-0">
              <label className={LABEL}>Image</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setImageFile(event.target.files[0] || null)
                }
                className={`mt-2 ${FILE_INPUT}`}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className={LABEL}>Description</label>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((f) => ({
                  ...f,
                  description: event.target.value,
                }))
              }
              rows={2}
              className={`${INPUT} mt-2 resize-none`}
            />
          </div>

          <AdminButton
            type="submit"
            tone="primary"
            disabled={saving}
            className="mt-5 w-full sm:w-auto"
          >
            {saving ? "Saving..." : "Save service"}
          </AdminButton>
        </form>
      )}

      {loading && <AdminLoading label="Loading services..." />}

      {!loading && error && (
        <Alert
          tone="error"
          title="Could not load services"
          details={error.fieldErrors}
          onRetry={load}
          className="mt-8"
        >
          {error.message}
        </Alert>
      )}

      {!loading && !error && services.length === 0 && (
        <AdminEmpty
          title="Nothing here yet"
          body="Add a service to get started."
          onRetry={load}
        />
      )}

      {!loading && !error && services.length > 0 && (
        <div className="mt-5 grid gap-3">
          {services.map((service) => {
            const styles = Array.isArray(service.styles) ? service.styles : [];
            const busy = busyId === service.id;

            return (
              <AdminPanel key={service.id}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    {service.image ? (
                      <img
                        src={mediaUrl(service.image)}
                        alt={service.name}
                        className="h-14 w-14 shrink-0 rounded-xl object-cover sm:h-16 sm:w-16"
                      />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2a2a2a] to-[#111] sm:h-16 sm:w-16">
                        <Scissors size={20} className="text-[#d6a85f]/50" />
                      </span>
                    )}

                    <div className="min-w-0">
                      <h2 className="break-words font-serif text-lg text-white sm:text-xl">
                        {service.name}
                      </h2>
                      <p className="mt-1 text-[11px] text-white/45">
                        {formatPrice(service.price)} ·{" "}
                        {formatDuration(service.duration)}
                        {styles.length > 0
                          ? ` · ${styles.length} styles`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <AdminButton
                      icon={Pencil}
                      onClick={() => openEdit(service)}
                      disabled={busy}
                    >
                      Edit
                    </AdminButton>

                    <AdminButton
                      tone="danger"
                      icon={Trash2}
                      onClick={() => handleDelete(service)}
                      disabled={busy}
                    >
                      Delete
                    </AdminButton>
                  </div>
                </div>

                {styles.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                    {styles.map((style) => (
                      <span
                        key={style.id}
                        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70"
                      >
                        {style.name}
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteStyle(service.id, style.id)
                          }
                          aria-label={`Delete style ${style.name}`}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-white/35 transition hover:text-[#e0776b]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-white/10 pt-4">
                  {styleServiceId === service.id ? (
                    <form
                      onSubmit={(event) =>
                        handleAddStyle(service.id, event)
                      }
                      className="grid gap-3"
                    >
                      <div className="min-w-0">
                        <label className={LABEL}>
                          New style name
                        </label>
                        <input
                          value={styleName}
                          onChange={(event) =>
                            setStyleName(event.target.value)
                          }
                          className={`${INPUT} mt-1`}
                          placeholder="e.g. High Fade"
                        />
                      </div>

                      <div className="min-w-0">
                        <label className={LABEL}>Image (optional)</label>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) =>
                            setStyleImage(
                              event.target.files[0] || null
                            )
                          }
                          className={`mt-1 ${FILE_INPUT}`}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <AdminButton
                          type="submit"
                          tone="primary"
                          disabled={styleSaving}
                        >
                          {styleSaving ? "Adding..." : "Add style"}
                        </AdminButton>

                        <AdminButton
                          onClick={() => setStyleServiceId(null)}
                          disabled={styleSaving}
                        >
                          Cancel
                        </AdminButton>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStyleServiceId(service.id)}
                      className="inline-flex min-h-10 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#d6a85f] transition hover:text-[#e5bd7a]"
                    >
                      <Plus size={13} /> Add haircut style
                    </button>
                  )}
                </div>
              </AdminPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
