import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Scissors, Trash2, X } from "lucide-react";

import Alert from "../../components/ui/Alert";
import Spinner from "../../components/ui/Spinner";
import { mediaUrl } from "../../services/api";
import {
  createHaircutStyle,
  createService,
  deleteHaircutStyle,
  deleteService,
  listServices,
  updateService,
} from "../../services/servicesApi";
import { formatDuration, formatPrice } from "../../utils/format";

const INPUT =
  "w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

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

  const [editing, setEditing] = useState(null); // null | "new" | service
  const [form, setForm] = useState(EMPTY);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // style creation inside a service row
  const [styleServiceId, setStyleServiceId] = useState(null);
  const [styleName, setStyleName] = useState("");
  const [styleImage, setStyleImage] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    return listServices()
      .then((data) => {
        setServices(Array.isArray(data) ? data : data?.results || []);
        setLoading(false);
      })
      .catch((apiError) => {
        setError(apiError);
        setLoading(false);
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
      setActionError({ message: "A service name is required.", fieldErrors: {} });
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

    if (!styleName.trim()) {
      return;
    }

    setActionError(null);

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
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
            Staff · Management
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-none sm:text-5xl">
            Services
          </h1>
          <p className="mt-3 text-xs text-white/35">
            Pricing, durations and haircut styles on the site.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => (editing === null ? openNew() : setEditing(null))}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-black transition ${
              editing === null
                ? "bg-[#d6a85f] hover:bg-[#e5bd7a]"
                : "border border-white/15 text-white/60 hover:text-white"
            }`}
          >
            {editing === null ? (
              <>
                <Plus size={14} /> Add service
              </>
            ) : (
              <>
                <X size={14} /> Cancel
              </>
            )}
          </button>
        </div>
      </div>

      {actionError && (
        <Alert
          tone="error"
          title="Action failed"
          details={actionError.fieldErrors}
          className="mt-6"
        >
          {actionError.message}
        </Alert>
      )}

      {editing && (
        <form
          onSubmit={handleSave}
          noValidate
          className="mt-7 rounded-2xl border border-white/10 bg-[#111] p-6"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
            {editing === "new" ? "Add a service" : `Edit #${editing.id}`}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Name
              </label>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((f) => ({ ...f, name: event.target.value }))
                }
                className={`${INPUT} mt-2`}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Price (ETB)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) =>
                  setForm((f) => ({ ...f, price: event.target.value }))
                }
                className={`${INPUT} mt-2`}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Duration (minutes)
              </label>
              <input
                type="number"
                min="1"
                value={form.duration}
                onChange={(event) =>
                  setForm((f) => ({ ...f, duration: event.target.value }))
                }
                className={`${INPUT} mt-2`}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Image
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setImageFile(event.target.files[0] || null)}
                className="mt-2 w-full text-xs text-white/60 file:mr-3 file:rounded-full file:border-0 file:bg-[#d6a85f] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-black"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((f) => ({ ...f, description: event.target.value }))
              }
              rows={2}
              className={`${INPUT} mt-2 resize-none`}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 rounded-full bg-[#d6a85f] px-6 py-2.5 text-xs font-semibold text-black transition hover:bg-[#e5bd7a] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save service"}
          </button>
        </form>
      )}

      {loading && (
        <div className="mt-8 flex justify-center rounded-2xl border border-white/10 bg-[#111] py-16">
          <Spinner label="Loading services..." />
        </div>
      )}

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
        <Alert tone="info" title="Nothing here yet" onRetry={load} className="mt-8">
          Add a service to get started.
        </Alert>
      )}

      {!loading && !error && services.length > 0 && (
        <div className="mt-8 grid gap-4">
          {services.map((service) => {
            const styles = Array.isArray(service.styles) ? service.styles : [];
            const busy = busyId === service.id;

            return (
              <article
                key={service.id}
                className="rounded-2xl border border-white/10 bg-[#111] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    {service.image ? (
                      <img
                        src={mediaUrl(service.image)}
                        alt={service.name}
                        className="h-16 w-16 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-[#2a2a2a] to-[#111]">
                        <Scissors size={20} className="text-[#d6a85f]/50" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <h2 className="font-serif text-xl text-white">
                        {service.name}
                      </h2>
                      <p className="mt-1 text-[11px] text-white/45">
                        {formatPrice(service.price)} ·{" "}
                        {formatDuration(service.duration)}
                        {styles.length > 0 ? ` · ${styles.length} styles` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(service)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-[11px] font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white disabled:opacity-60"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(service)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#e05a4f]/40 px-3 py-2 text-[11px] font-semibold text-[#e0776b] transition hover:bg-[#e05a4f]/10 disabled:opacity-60"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>

                {styles.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                    {styles.map((style) => (
                      <span
                        key={style.id}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70"
                      >
                        {style.name}
                        <button
                          type="button"
                          onClick={() => handleDeleteStyle(service.id, style.id)}
                          aria-label={`Delete style ${style.name}`}
                          className="text-white/35 transition hover:text-[#e0776b]"
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
                      onSubmit={(event) => handleAddStyle(service.id, event)}
                      className="flex flex-wrap items-end gap-3"
                    >
                      <div className="min-w-48 flex-1">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                          New style name
                        </label>
                        <input
                          value={styleName}
                          onChange={(event) => setStyleName(event.target.value)}
                          className={`${INPUT} mt-1 py-2.5`}
                          placeholder="e.g. High Fade"
                        />
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) =>
                            setStyleImage(event.target.files[0] || null)
                          }
                          className="text-xs text-white/50 file:mr-2 file:rounded-full file:border-0 file:bg-[#d6a85f] file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-black"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="rounded-full bg-[#d6a85f] px-4 py-2.5 text-[11px] font-semibold text-black transition hover:bg-[#e5bd7a]"
                        >
                          Add style
                        </button>
                        <button
                          type="button"
                          onClick={() => setStyleServiceId(null)}
                          className="rounded-full border border-white/15 px-4 py-2.5 text-[11px] font-semibold text-white/60 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStyleServiceId(service.id)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#d6a85f] transition hover:text-[#e5bd7a]"
                    >
                      <Plus size={13} /> Add haircut style
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
